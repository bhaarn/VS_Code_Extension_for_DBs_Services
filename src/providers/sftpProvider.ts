import { Client as SFTPClient } from 'ssh2';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * SFTP connection provider
 */
export class SFTPProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = new SFTPClient();

            client.on('ready', () => {
                this.connections.set(config.id, client);
                resolve();
            });

            client.on('error', (err) => {
                reject(err);
            });

            client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: credentials.password,
                readyTimeout: 10000
            });
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
            const client = new SFTPClient();

            client.on('ready', () => {
                client.end();
                resolve(true);
            });

            client.on('error', () => {
                resolve(false);
            });

            client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: credentials.password,
                readyTimeout: 10000
            });
        });
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            client.sftp((err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                // List root directory
                sftp.readdir('/', (err: Error | undefined, list: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const items = list.map((item: any) => ({
                        name: item.filename,
                        type: item.attrs.isDirectory() ? 'directory' : 'file',
                        size: item.attrs.size,
                        modified: new Date(item.attrs.mtime * 1000)
                    }));

                    resolve([{
                        name: 'Root',
                        type: 'directory',
                        children: items
                    }]);
                });
            });
        });
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // Parse SFTP commands
        // Format: "list /path" or "get /path/file" or "put /local/file /remote/file"
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const path = parts[1] || '/';

        return new Promise((resolve, reject) => {
            client.sftp((err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                switch (command) {
                    case 'list':
                    case 'ls':
                        sftp.readdir(path, (err: Error | undefined, list: any[]) => {
                            if (err) reject(err);
                            else resolve(list.map((item: any) => ({
                                name: item.filename,
                                type: item.attrs.isDirectory() ? 'directory' : 'file',
                                size: item.attrs.size,
                                permissions: item.attrs.mode,
                                modified: new Date(item.attrs.mtime * 1000)
                            })));
                        });
                        break;

                    case 'stat':
                        sftp.stat(path, (err: Error | undefined, stats: any) => {
                            if (err) reject(err);
                            else resolve({
                                size: stats.size,
                                mode: stats.mode,
                                uid: stats.uid,
                                gid: stats.gid,
                                atime: new Date(stats.atime * 1000),
                                mtime: new Date(stats.mtime * 1000)
                            });
                        });
                        break;

                    case 'exists':
                        sftp.stat(path, (err: Error | undefined, stats: any) => {
                            resolve({ exists: !err, isDirectory: stats?.isDirectory() });
                        });
                        break;

                    default:
                        reject(new Error(`Unknown command: ${command}. Supported: list, ls, stat, exists`));
                }
            });
        });
    }

    // Additional helper methods for file operations
    async listDirectory(connectionId: string, path: string = '/'): Promise<any[]> {
        return this.executeQuery(connectionId, `list ${path}`);
    }

    async getFileStats(connectionId: string, path: string): Promise<any> {
        return this.executeQuery(connectionId, `stat ${path}`);
    }

    // Upload file
    async uploadFile(connectionId: string, localPath: string, remotePath: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            client.sftp((err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                sftp.fastPut(localPath, remotePath, (err: Error | undefined) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    // Download file
    async downloadFile(connectionId: string, remotePath: string, localPath: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            client.sftp((err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                sftp.fastGet(remotePath, localPath, (err: Error | undefined) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    // Download directory recursively
    async downloadDirectory(connectionId: string, remotePath: string, localPath: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const fs = require('fs');
        const path = require('path');

        return new Promise((resolve, reject) => {
            client.sftp(async (err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                const downloadRecursive = async (remote: string, local: string) => {
                    return new Promise<void>(async (res, rej) => {
                        sftp.readdir(remote, async (err: Error | undefined, list: any[]) => {
                            if (err) {
                                rej(err);
                                return;
                            }

                            // Create local directory
                            if (!fs.existsSync(local)) {
                                fs.mkdirSync(local, { recursive: true });
                            }

                            for (const item of list) {
                                const remotePath = `${remote}/${item.filename}`;
                                const localPath = path.join(local, item.filename);

                                if (item.attrs.isDirectory()) {
                                    await downloadRecursive(remotePath, localPath);
                                } else {
                                    await new Promise<void>((resolveFile, rejectFile) => {
                                        sftp.fastGet(remotePath, localPath, (err: Error | undefined) => {
                                            if (err) rejectFile(err);
                                            else resolveFile();
                                        });
                                    });
                                }
                            }
                            res();
                        });
                    });
                };

                try {
                    await downloadRecursive(remotePath, localPath);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Upload directory recursively
    async uploadDirectory(connectionId: string, localPath: string, remotePath: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const fs = require('fs');
        const path = require('path');

        return new Promise((resolve, reject) => {
            client.sftp(async (err: Error | undefined, sftp: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                const uploadRecursive = async (local: string, remote: string) => {
                    return new Promise<void>(async (res, rej) => {
                        try {
                            const items = fs.readdirSync(local, { withFileTypes: true });

                            // Create remote directory
                            await new Promise<void>((resolveDir, rejectDir) => {
                                sftp.mkdir(remote, (err: any) => {
                                    if (err && err.code !== 4) { // Ignore 'file already exists' error
                                        rejectDir(err);
                                    } else {
                                        resolveDir();
                                    }
                                });
                            });

                            for (const item of items) {
                                const localItemPath = path.join(local, item.name);
                                const remoteItemPath = `${remote}/${item.name}`;

                                if (item.isDirectory()) {
                                    await uploadRecursive(localItemPath, remoteItemPath);
                                } else {
                                    await new Promise<void>((resolveFile, rejectFile) => {
                                        sftp.fastPut(localItemPath, remoteItemPath, (err: Error | undefined) => {
                                            if (err) rejectFile(err);
                                            else resolveFile();
                                        });
                                    });
                                }
                            }
                            res();
                        } catch (error) {
                            rej(error);
                        }
                    });
                };

                try {
                    await uploadRecursive(localPath, remotePath);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}
