import { Client } from 'pg';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * PostgreSQL connection provider
 * Handles secure PostgreSQL connections
 */
export class PostgreSQLProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        const client = new Client({
            host: config.host,
            port: config.port || 5432,
            database: config.database,
            user: config.username,
            password: credentials.password,
            ssl: config.ssl ? { rejectUnauthorized: false } : false
        });

        await client.connect();
        this.connections.set(config.id, client);
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            await client.end();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const client = new Client({
                host: config.host,
                port: config.port || 5432,
                database: config.database,
                user: config.username,
                password: credentials.password,
                ssl: config.ssl ? { rejectUnauthorized: false } : false
            });

            await client.connect();
            await client.end();
            return true;
        } catch (error) {
            console.error('PostgreSQL connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // Get list of databases
        const dbResult = await client.query(`
            SELECT datname FROM pg_database 
            WHERE datistemplate = false
        `);

        const databases = [];
        for (const row of dbResult.rows) {
            const dbName = row.datname;
            
            // Get tables for each schema in current database
            const tableResult = await client.query(`
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name
            `);

            const tables = tableResult.rows.map((t: any) => `${t.table_schema}.${t.table_name}`);
            
            databases.push({
                name: dbName,
                type: 'database',
                children: tables.map((t: string) => ({ name: t, type: 'table' }))
            });
        }

        return databases;
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const result = await client.query(query);
        return result.rows;
    }
}
