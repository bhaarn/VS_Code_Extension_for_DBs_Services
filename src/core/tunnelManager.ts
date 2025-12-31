import { Client } from 'ssh2';
import * as vscode from 'vscode';
import * as net from 'net';
import { SecretManager } from './secretManager';

interface TunnelConfig {
    sshHost: string;
    sshPort: number;
    sshUsername: string;
    targetHost: string;
    targetPort: number;
}

interface ActiveTunnel {
    client: Client;
    server: net.Server;
    localPort: number;
    config: TunnelConfig;
}

/**
 * SSH Tunnel Manager
 * Manages SSH tunnels for database connections through bastion/jump hosts
 */
export class TunnelManager {
    private activeTunnels: Map<string, ActiveTunnel> = new Map();
    private secretManager: SecretManager;

    constructor(secretManager: SecretManager) {
        this.secretManager = secretManager;
    }

    /**
     * Establish SSH tunnel for a connection
     * Returns the local port to connect to
     */
    async createTunnel(
        connectionId: string,
        tunnelConfig: TunnelConfig,
        sshCredentials: { password?: string; privateKey?: string }
    ): Promise<number> {
        // Check if tunnel already exists
        if (this.activeTunnels.has(connectionId)) {
            const existing = this.activeTunnels.get(connectionId)!;
            return existing.localPort;
        }

        return new Promise((resolve, reject) => {
            const client = new Client();
            const server = net.createServer();

            // Find available local port
            server.listen(0, 'localhost', () => {
                const address = server.address() as net.AddressInfo;
                const localPort = address.port;

                console.log(`SSH tunnel local port: ${localPort}`);

                // Handle incoming connections to local port
                server.on('connection', (socket) => {
                    // Forward through SSH tunnel
                    client.forwardOut(
                        'localhost',
                        localPort,
                        tunnelConfig.targetHost,
                        tunnelConfig.targetPort,
                        (err, stream) => {
                            if (err) {
                                socket.end();
                                console.error('SSH tunnel forward error:', err);
                                return;
                            }

                            // Pipe data between local socket and remote stream
                            socket.pipe(stream);
                            stream.pipe(socket);

                            socket.on('error', (err: Error) => {
                                console.error('Tunnel socket error:', err);
                            });

                            stream.on('error', (err: Error) => {
                                console.error('Tunnel stream error:', err);
                            });
                        }
                    );
                });

                // Connect SSH client
                client.on('ready', () => {
                    console.log(`SSH tunnel established: ${tunnelConfig.sshHost}:${tunnelConfig.sshPort} -> ${tunnelConfig.targetHost}:${tunnelConfig.targetPort}`);
                    
                    // Store active tunnel
                    this.activeTunnels.set(connectionId, {
                        client,
                        server,
                        localPort,
                        config: tunnelConfig
                    });

                    resolve(localPort);
                });

                client.on('error', (err) => {
                    console.error('SSH client error:', err);
                    server.close();
                    reject(new Error(`SSH tunnel error: ${err.message}`));
                });

                client.on('close', () => {
                    console.log('SSH tunnel closed');
                    this.activeTunnels.delete(connectionId);
                });

                // Connect with credentials
                const connectConfig: any = {
                    host: tunnelConfig.sshHost,
                    port: tunnelConfig.sshPort,
                    username: tunnelConfig.sshUsername,
                    readyTimeout: 30000,
                    keepaliveInterval: 10000
                };

                if (sshCredentials.privateKey) {
                    connectConfig.privateKey = sshCredentials.privateKey;
                } else if (sshCredentials.password) {
                    connectConfig.password = sshCredentials.password;
                } else {
                    reject(new Error('SSH credentials required (password or private key)'));
                    return;
                }

                client.connect(connectConfig);
            });

            server.on('error', (err) => {
                console.error('Tunnel server error:', err);
                reject(new Error(`Failed to create local tunnel server: ${err.message}`));
            });
        });
    }

    /**
     * Close SSH tunnel for a connection
     */
    async closeTunnel(connectionId: string): Promise<void> {
        const tunnel = this.activeTunnels.get(connectionId);
        if (!tunnel) {
            return;
        }

        return new Promise((resolve) => {
            tunnel.server.close(() => {
                tunnel.client.end();
                this.activeTunnels.delete(connectionId);
                console.log(`SSH tunnel closed for connection: ${connectionId}`);
                resolve();
            });
        });
    }

    /**
     * Check if tunnel exists for connection
     */
    hasTunnel(connectionId: string): boolean {
        return this.activeTunnels.has(connectionId);
    }

    /**
     * Get local port for existing tunnel
     */
    getLocalPort(connectionId: string): number | undefined {
        return this.activeTunnels.get(connectionId)?.localPort;
    }

    /**
     * Close all tunnels (cleanup on deactivation)
     */
    async closeAllTunnels(): Promise<void> {
        const closePromises = Array.from(this.activeTunnels.keys()).map(id => 
            this.closeTunnel(id)
        );
        await Promise.all(closePromises);
    }

    /**
     * Get tunnel status for UI
     */
    getTunnelStatus(connectionId: string): { active: boolean; localPort?: number; config?: TunnelConfig } {
        const tunnel = this.activeTunnels.get(connectionId);
        if (!tunnel) {
            return { active: false };
        }

        return {
            active: true,
            localPort: tunnel.localPort,
            config: tunnel.config
        };
    }
}
