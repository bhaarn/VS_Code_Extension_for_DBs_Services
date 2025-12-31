import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

export class DockerProvider extends BaseConnectionProvider {
    private axios: any;

    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            // Lazy load axios
            this.axios = require('axios');
            
            const baseURL = `http://${config.host}:${config.port || 2375}`;
            const client = this.axios.create({
                baseURL,
                timeout: 10000
            });

            // Test connection by getting version
            await client.get('/version');
            
            this.connections.set(config.id, client);
        } catch (error: any) {
            throw new Error(`Failed to connect to Docker: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        this.connections.delete(connectionId);
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const axios = require('axios');
            const baseURL = `http://${config.host}:${config.port || 2375}`;
            const client = axios.create({
                baseURL,
                timeout: 10000
            });
            
            await client.get('/version');
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
                { name: 'Containers', type: 'category', children: [] },
                { name: 'Images', type: 'category', children: [] },
                { name: 'Volumes', type: 'category', children: [] },
                { name: 'Networks', type: 'category', children: [] }
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
                case 'containers':
                case 'ps':
                    // List all containers
                    const allContainers = parts.includes('--all') || parts.includes('-a');
                    const response = await client.get('/containers/json', {
                        params: { all: allContainers }
                    });
                    return { 
                        containers: response.data.map((c: any) => ({
                            id: c.Id.substring(0, 12),
                            name: c.Names[0].replace('/', ''),
                            image: c.Image,
                            status: c.Status,
                            state: c.State,
                            ports: c.Ports
                        }))
                    };

                case 'images':
                case 'image':
                    // List images
                    const imagesResponse = await client.get('/images/json');
                    return {
                        images: imagesResponse.data.map((img: any) => ({
                            id: img.Id.substring(7, 19),
                            tags: img.RepoTags || ['<none>'],
                            size: `${(img.Size / 1024 / 1024).toFixed(2)} MB`,
                            created: new Date(img.Created * 1000).toLocaleDateString()
                        }))
                    };

                case 'volumes':
                case 'volume':
                    // List volumes
                    const volumesResponse = await client.get('/volumes');
                    return {
                        volumes: volumesResponse.data.Volumes?.map((vol: any) => ({
                            name: vol.Name,
                            driver: vol.Driver,
                            mountpoint: vol.Mountpoint
                        })) || []
                    };

                case 'networks':
                case 'network':
                    // List networks
                    const networksResponse = await client.get('/networks');
                    return {
                        networks: networksResponse.data.map((net: any) => ({
                            id: net.Id.substring(0, 12),
                            name: net.Name,
                            driver: net.Driver,
                            scope: net.Scope
                        }))
                    };

                case 'inspect':
                    // Inspect container, image, volume, or network
                    const type = parts[1]; // container, image, volume, network
                    const id = parts[2];
                    const inspectResponse = await client.get(`/${type}s/${id}/json`);
                    return inspectResponse.data;

                case 'logs':
                    // Get container logs
                    const containerId = parts[1];
                    const logsResponse = await client.get(`/containers/${containerId}/logs`, {
                        params: { stdout: true, stderr: true, tail: parts[2] || 100 }
                    });
                    return { logs: logsResponse.data };

                case 'stats':
                    // Get container stats
                    const statsContainerId = parts[1];
                    const statsResponse = await client.get(`/containers/${statsContainerId}/stats`, {
                        params: { stream: false }
                    });
                    return statsResponse.data;

                default:
                    throw new Error(`Unknown command: ${command}. Supported: containers, images, volumes, networks, inspect, logs, stats`);
            }
        } catch (error: any) {
            throw new Error(`Docker command failed: ${error.message}`);
        }
    }
}
