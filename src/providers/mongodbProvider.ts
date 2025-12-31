import { MongoClient } from 'mongodb';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * MongoDB connection provider
 */
export class MongoDBProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        let uri: string;
        
        // Build URI based on whether authentication is used
        if (config.username && credentials.password) {
            uri = `mongodb://${config.username}:${encodeURIComponent(credentials.password)}@${config.host}:${config.port || 27017}/${config.database || ''}`;
        } else {
            // No authentication (common for local development)
            uri = `mongodb://${config.host}:${config.port || 27017}/${config.database || ''}`;
        }
        
        const client = new MongoClient(uri, {
            ssl: config.ssl,
            serverSelectionTimeoutMS: 5000
        });

        await client.connect();
        this.connections.set(config.id, client);
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            await client.close();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            let uri: string;
            
            // Build URI based on whether authentication is used
            if (config.username && credentials.password) {
                uri = `mongodb://${config.username}:${encodeURIComponent(credentials.password)}@${config.host}:${config.port || 27017}/${config.database || ''}`;
            } else {
                // No authentication (common for local development)
                uri = `mongodb://${config.host}:${config.port || 27017}/${config.database || ''}`;
            }
            
            const client = new MongoClient(uri, {
                ssl: config.ssl,
                serverSelectionTimeoutMS: 5000
            });

            await client.connect();
            await client.close();
            return true;
        } catch (error) {
            console.error('MongoDB connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // List all databases
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        return dbs.databases.map((db: any) => db.name);
    }

    async executeQuery(connectionId: string, collectionName: string, query: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            // Parse the query as JSON
            const queryObj = JSON.parse(query);
            
            // Get the current database from the connection
            // We need to store which database was selected
            const db = client.db();
            const collection = db.collection(collectionName);
            
            // Execute find query
            const results = await collection.find(queryObj).limit(100).toArray();
            return results;
        } catch (error: any) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }
}
