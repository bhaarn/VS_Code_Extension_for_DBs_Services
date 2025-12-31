import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

export class ElasticsearchProvider extends BaseConnectionProvider {
    private axios: any;

    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            // Lazy load axios
            this.axios = require('axios');
            
            const auth = credentials.username && credentials.password 
                ? { username: credentials.username, password: credentials.password }
                : undefined;

            const baseURL = `http://${config.host}:${config.port || 9200}`;
            const client = this.axios.create({
                baseURL,
                timeout: 10000,
                auth
            });

            // Test connection
            await client.get('/');
            
            this.connections.set(config.id, client);
        } catch (error: any) {
            throw new Error(`Failed to connect to Elasticsearch: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        this.connections.delete(connectionId);
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const axios = require('axios');
            const auth = credentials.username && credentials.password 
                ? { username: credentials.username, password: credentials.password }
                : undefined;

            const baseURL = `http://${config.host}:${config.port || 9200}`;
            const client = axios.create({
                baseURL,
                timeout: 10000,
                auth
            });
            
            await client.get('/');
            return true;
        } catch (error) {
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            return [
                { name: 'Indices', type: 'category', children: [] },
                { name: 'Cluster', type: 'category', children: [] },
                { name: 'Search', type: 'category', children: [] }
            ];
        } catch (error: any) {
            throw new Error(`Failed to get metadata: ${error.message}`);
        }
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        try {
            switch (command) {
                case 'indices':
                case 'list_indices':
                    // List all indices
                    const response = await client.get('/_cat/indices?format=json');
                    return {
                        indices: response.data.map((idx: any) => ({
                            name: idx.index,
                            health: idx.health,
                            status: idx.status,
                            docs_count: idx['docs.count'],
                            size: idx['store.size']
                        }))
                    };

                case 'cluster':
                case 'cluster_health':
                    // Get cluster health
                    const healthResponse = await client.get('/_cluster/health');
                    return healthResponse.data;

                case 'nodes':
                case 'cluster_nodes':
                    // Get cluster nodes
                    const nodesResponse = await client.get('/_cat/nodes?format=json');
                    return { nodes: nodesResponse.data };

                case 'create_index':
                    // Create index: create_index <name>
                    const indexName = parts[1];
                    await client.put(`/${indexName}`);
                    return { success: true, message: `Index '${indexName}' created` };

                case 'delete_index':
                    // Delete index: delete_index <name>
                    const deleteIndexName = parts[1];
                    await client.delete(`/${deleteIndexName}`);
                    return { success: true, message: `Index '${deleteIndexName}' deleted` };

                case 'index':
                    // Index document: index <index> <json>
                    const targetIndex = parts[1];
                    const docData = JSON.parse(parts.slice(2).join(' '));
                    const indexResponse = await client.post(`/${targetIndex}/_doc`, docData);
                    return indexResponse.data;

                case 'search':
                    // Search: search <index> <query_json>
                    const searchIndex = parts[1];
                    if (parts.length > 2) {
                        const searchQuery = JSON.parse(parts.slice(2).join(' '));
                        const searchResponse = await client.post(`/${searchIndex}/_search`, searchQuery);
                        return {
                            hits: searchResponse.data.hits.hits.map((hit: any) => ({
                                id: hit._id,
                                score: hit._score,
                                source: hit._source
                            })),
                            total: searchResponse.data.hits.total
                        };
                    } else {
                        // Search all
                        const searchAllResponse = await client.get(`/${searchIndex}/_search`);
                        return {
                            hits: searchAllResponse.data.hits.hits.map((hit: any) => ({
                                id: hit._id,
                                score: hit._score,
                                source: hit._source
                            })),
                            total: searchAllResponse.data.hits.total
                        };
                    }

                case 'get':
                    // Get document: get <index> <id>
                    const getIndex = parts[1];
                    const docId = parts[2];
                    const getResponse = await client.get(`/${getIndex}/_doc/${docId}`);
                    return getResponse.data;

                case 'delete':
                    // Delete document: delete <index> <id>
                    const delIndex = parts[1];
                    const delDocId = parts[2];
                    const deleteResponse = await client.delete(`/${delIndex}/_doc/${delDocId}`);
                    return deleteResponse.data;

                case 'mapping':
                    // Get index mapping: mapping <index>
                    const mappingIndex = parts[1];
                    const mappingResponse = await client.get(`/${mappingIndex}/_mapping`);
                    return mappingResponse.data;

                case 'stats':
                    // Get index stats: stats <index>
                    const statsIndex = parts[1];
                    const statsResponse = await client.get(`/${statsIndex}/_stats`);
                    return statsResponse.data;

                default:
                    throw new Error(`Unknown command: ${command}. Supported: indices, cluster, nodes, create_index, delete_index, index, search, get, delete, mapping, stats`);
            }
        } catch (error: any) {
            throw new Error(`Elasticsearch command failed: ${error.message}`);
        }
    }
}
