import * as neo4j from 'neo4j-driver';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * Neo4J connection provider
 */
export class Neo4JProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        // Use bolt:// for local connections, neo4j:// for remote
        const uri = `bolt://${config.host}:${config.port || 7687}`;
        
        const driver = neo4j.driver(
            uri,
            neo4j.auth.basic(config.username || '', credentials.password || ''),
            { 
                encrypted: false, // Disable encryption for local connections
                trust: 'TRUST_ALL_CERTIFICATES'
            }
        );

        // Verify connectivity
        await driver.verifyConnectivity();
        
        this.connections.set(config.id, driver);
    }

    async disconnect(connectionId: string): Promise<void> {
        const driver = this.getConnection(connectionId);
        if (driver) {
            await driver.close();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const uri = `bolt://${config.host}:${config.port || 7687}`;
            
            const driver = neo4j.driver(
                uri,
                neo4j.auth.basic(config.username || '', credentials.password || ''),
                { 
                    encrypted: false,
                    trust: 'TRUST_ALL_CERTIFICATES'
                }
            );

            await driver.verifyConnectivity();
            await driver.close();
            return true;
        } catch (error) {
            console.error('Neo4J connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const driver = this.getConnection(connectionId);
        if (!driver) {
            throw new Error('No active connection');
        }

        const session = driver.session();
        try {
            // Get node labels
            const labelResult = await session.run('CALL db.labels()');
            const labels = labelResult.records.map((record: any) => record.get(0));

            // Get relationship types
            const relResult = await session.run('CALL db.relationshipTypes()');
            const relationships = relResult.records.map((record: any) => record.get(0));

            return [{
                name: 'Graph',
                type: 'database',
                children: [
                    ...labels.map((l: string) => ({ name: l, type: 'label' })),
                    ...relationships.map((r: string) => ({ name: r, type: 'relationship' }))
                ]
            }];
        } finally {
            await session.close();
        }
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const driver = this.getConnection(connectionId);
        if (!driver) {
            throw new Error('No active connection');
        }

        const session = driver.session();
        try {
            const result = await session.run(query);
            return result.records.map((record: any) => record.toObject());
        } finally {
            await session.close();
        }
    }
}
