import { Client as SSHClient } from 'ssh2';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * SSH connection provider
 */
export class SSHProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = new SSHClient();

            client.on('ready', () => {
                this.connections.set(config.id, client);
                resolve();
            });

            client.on('error', (err) => {
                reject(err);
            });

            const connectConfig: any = {
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: credentials.password,
                readyTimeout: 10000
            };

            // Support for SSH key authentication
            if (credentials.privateKey) {
                connectConfig.privateKey = credentials.privateKey;
                delete connectConfig.password;
            }

            client.connect(connectConfig);
        });
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            client.end();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        return new Promise((resolve) => {
            const client = new SSHClient();

            client.on('ready', () => {
                client.end();
                resolve(true);
            });

            client.on('error', () => {
                resolve(false);
            });

            const connectConfig: any = {
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: credentials.password,
                readyTimeout: 10000
            };

            if (credentials.privateKey) {
                connectConfig.privateKey = credentials.privateKey;
                delete connectConfig.password;
            }

            client.connect(connectConfig);
        });
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // SSH doesn't have traditional "metadata" like databases
        // Return a category that can be clicked to execute commands
        return [{
            name: 'Execute Command',
            type: 'category',
            children: []
        }];
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            client.exec(query, (err: any, stream: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                let stdout = '';
                let stderr = '';

                stream.on('close', (code: number, signal: any) => {
                    resolve({
                        exitCode: code,
                        signal: signal,
                        stdout: stdout,
                        stderr: stderr
                    });
                });

                stream.on('data', (data: any) => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', (data: any) => {
                    stderr += data.toString();
                });
            });
        });
    }
}
