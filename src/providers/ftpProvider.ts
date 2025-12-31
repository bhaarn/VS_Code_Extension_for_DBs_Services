import { Client as FTPClient } from 'basic-ftp';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * FTP connection provider (for ProFTPD, vsftpd, etc.)
 */
export class FTPProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        const client = new FTPClient();
        client.ftp.verbose = true; // Enable verbose for debugging

        try {
            await client.access({
                host: config.host,
                port: config.port || 21,
                user: config.username || 'anonymous',
                password: credentials.password || '',
                secure: false,
                secureOptions: {
                    rejectUnauthorized: false
                }
            });

            // Test connection by listing current directory
            await client.pwd();

            this.connections.set(config.id, client);
        } catch (error: any) {
            client.close();
            throw new Error(`FTP connection failed: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            client.close();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        const client = new FTPClient();
        client.ftp.verbose = true;

        try {
            await client.access({
                host: config.host,
                port: config.port || 21,
                user: config.username || 'anonymous',
                password: credentials.password || '',
                secure: false,
                secureOptions: {
                    rejectUnauthorized: false
                }
            });
            
            // Test by getting current directory
            await client.pwd();
            
            client.close();
            return true;
        } catch (error: any) {
            console.error('FTP connection test failed:', error);
            client.close();
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            // List root directory
            const list = await client.list('/');
            
            const items = list.map((item: any) => ({
                name: item.name,
                type: item.isDirectory ? 'directory' : 'file',
                size: item.size,
                modified: item.modifiedAt
            }));

            return [{
                name: 'Root',
                type: 'directory',
                children: items
            }];
        } catch (error: any) {
            throw new Error(`Failed to list directory: ${error.message}`);
        }
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // Parse FTP commands
        // Format: "list /path" or "pwd" or "cd /path"
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const path = parts[1] || '/';

        try {
            switch (command) {
                case 'list':
                case 'ls':
                    const list = await client.list(path);
                    return list.map((item: any) => ({
                        name: item.name,
                        type: item.isDirectory ? 'directory' : 'file',
                        size: item.size,
                        permissions: item.permissions,
                        modified: item.modifiedAt,
                        user: item.user,
                        group: item.group
                    }));

                case 'pwd':
                    return { currentDirectory: await client.pwd() };

                case 'cd':
                    await client.cd(path);
                    return { currentDirectory: await client.pwd() };

                case 'size':
                    const size = await client.size(path);
                    return { path, size };

                default:
                    throw new Error(`Unknown command: ${command}. Supported: list, ls, pwd, cd, size`);
            }
        } catch (error: any) {
            throw new Error(`FTP command failed: ${error.message}`);
        }
    }

    // Additional helper methods
    async listDirectory(connectionId: string, path: string = '/'): Promise<any[]> {
        return this.executeQuery(connectionId, `list ${path}`);
    }

    async getCurrentDirectory(connectionId: string): Promise<string> {
        const result: any = await this.executeQuery(connectionId, 'pwd');
        return result.currentDirectory;
    }

    // Upload directory recursively
    async uploadDirectory(connectionId: string, localPath: string, remotePath: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const fs = require('fs');
        const path = require('path');

        const uploadRecursive = async (local: string, remote: string) => {
            const items = fs.readdirSync(local, { withFileTypes: true });

            for (const item of items) {
                const localItemPath = path.join(local, item.name);
                const remoteItemPath = `${remote}/${item.name}`;

                if (item.isDirectory()) {
                    // Create remote directory
                    try {
                        await client.ensureDir(remoteItemPath);
                    } catch (e) {
                        // Directory might already exist
                    }
                    // Recursively upload subdirectory
                    await uploadRecursive(localItemPath, remoteItemPath);
                } else {
                    // Upload file
                    await client.uploadFrom(localItemPath, remoteItemPath);
                }
            }
        };

        // Ensure base remote directory exists
        try {
            await client.ensureDir(remotePath);
        } catch (e) {
            // Directory might already exist
        }

        await uploadRecursive(localPath, remotePath);
    }
}
