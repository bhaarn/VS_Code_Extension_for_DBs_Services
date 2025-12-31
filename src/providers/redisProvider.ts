import { createClient, RedisClientType } from 'redis';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * Redis connection provider
 */
export class RedisProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        const client: RedisClientType = createClient({
            socket: {
                host: config.host,
                port: config.port || 6379
            },
            password: credentials.password,
            database: config.database ? parseInt(config.database) : 0
        });

        await client.connect();
        this.connections.set(config.id, client);
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            await client.quit();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const client: RedisClientType = createClient({
                socket: {
                    host: config.host,
                    port: config.port || 6379
                },
                password: credentials.password,
                database: config.database ? parseInt(config.database) : 0
            });

            await client.connect();
            await client.ping();
            await client.quit();
            return true;
        } catch (error) {
            console.error('Redis connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const dbSize = await client.dbSize();
        
        // Get sample keys (limited to 100)
        const keys = await client.keys('*');
        const sampleKeys = keys.slice(0, 100);

        return [{
            name: 'Keys',
            type: 'database',
            children: sampleKeys.map((k: string) => ({ name: k, type: 'key' }))
        }];
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // Parse Redis command (e.g., "GET key1" or "SET key1 value1")
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toUpperCase();
        const args = parts.slice(1);

        // Execute Redis command
        const result = await client.sendCommand([command, ...args]);
        return { command, args, result };
    }
}
