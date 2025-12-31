import * as mysql from 'mysql2/promise';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * MySQL connection provider
 */
export class MySQLProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port || 3306,
            database: config.database,
            user: config.username,
            password: credentials.password,
            ssl: config.ssl ? {} : undefined
        });

        this.connections.set(config.id, connection);
    }

    async disconnect(connectionId: string): Promise<void> {
        const connection = this.getConnection(connectionId);
        if (connection) {
            await connection.end();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const connection = await mysql.createConnection({
                host: config.host,
                port: config.port || 3306,
                database: config.database,
                user: config.username,
                password: credentials.password,
                ssl: config.ssl ? {} : undefined
            });

            await connection.end();
            return true;
        } catch (error) {
            console.error('MySQL connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            throw new Error('No active connection');
        }

        // Get list of databases
        const [dbRows] = await connection.query('SHOW DATABASES');
        const databases = [];

        for (const dbRow of dbRows as any[]) {
            const dbName = Object.values(dbRow)[0] as string;
            
            // Skip system databases
            if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(dbName)) {
                continue;
            }

            // Get tables for each database
            const [tableRows] = await connection.query(`SHOW TABLES FROM \`${dbName}\``);
            const tables = (tableRows as any[]).map((t: any) => Object.values(t)[0] as string);

            databases.push({
                name: dbName,
                type: 'database',
                children: tables.map((t: string) => ({ name: t, type: 'table' }))
            });
        }

        return databases;
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            throw new Error('No active connection');
        }

        const [rows] = await connection.query(query);
        return rows;
    }
}
