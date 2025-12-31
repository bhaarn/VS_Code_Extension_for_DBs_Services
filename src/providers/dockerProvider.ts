import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

export class DockerProvider extends BaseConnectionProvider {
    private axios: any;

    private createClient(config: ConnectionConfig): any {
        const axios = require('axios');
        
        // Check if using Unix socket (local Docker) or HTTP (remote Docker)
        // If host is 'local' or 'unix' or starts with '/', use Unix socket
        const isUnixSocket = !config.host || 
                            config.host === 'local' || 
                            config.host === 'unix' || 
                            config.host.startsWith('/');

        if (isUnixSocket) {
            // Use Unix socket for local Docker
            const socketPath = config.host?.startsWith('/') 
                ? config.host 
                : (process.platform === 'win32' 
                    ? '//./pipe/docker_engine' 
                    : '/var/run/docker.sock');
            
            return axios.create({
                socketPath,
                baseURL: 'http://localhost', // Required for axios even with socketPath
                timeout: 10000
            });
        } else {
            // Use HTTP for remote Docker
            const baseURL = `http://${config.host}:${config.port || 2375}`;
            return axios.create({
                baseURL,
                timeout: 10000
            });
        }
    }

    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            // Lazy load axios
            this.axios = require('axios');
            
            const client = this.createClient(config);

            // Test connection by getting version
            await client.get('/version');
            
            this.connections.set(config.id, client);
        } catch (error: any) {
            throw new Error(`Failed to connect to Docker: ${error.message || error}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        this.connections.delete(connectionId);
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const client = this.createClient(config);
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
                    // List all containers (including stopped ones)
                    const response = await client.get('/containers/json', {
                        params: { all: true }
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
                            id: net.Id,
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

    /**
     * Start a container
     */
    async startContainer(connectionId: string, containerId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.post(`/containers/${containerId}/start`);
        } catch (error: any) {
            throw new Error(`Failed to start container: ${error.message}`);
        }
    }

    /**
     * Stop a container
     */
    async stopContainer(connectionId: string, containerId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.post(`/containers/${containerId}/stop`);
        } catch (error: any) {
            throw new Error(`Failed to stop container: ${error.message}`);
        }
    }

    /**
     * Restart a container
     */
    async restartContainer(connectionId: string, containerId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.post(`/containers/${containerId}/restart`);
        } catch (error: any) {
            throw new Error(`Failed to restart container: ${error.message}`);
        }
    }

    /**
     * Remove a container
     */
    async removeContainer(connectionId: string, containerId: string, force: boolean = false): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.delete(`/containers/${containerId}`, {
                params: { force, v: true }
            });
        } catch (error: any) {
            throw new Error(`Failed to remove container: ${error.message}`);
        }
    }

    /**
     * Remove an image
     */
    async removeImage(connectionId: string, imageId: string, force: boolean = false): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.delete(`/images/${imageId}`, {
                params: { force }
            });
        } catch (error: any) {
            throw new Error(`Failed to remove image: ${error.message}`);
        }
    }

    /**
     * Remove a volume
     */
    async removeVolume(connectionId: string, volumeName: string, force: boolean = false): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.delete(`/volumes/${volumeName}`, {
                params: { force }
            });
        } catch (error: any) {
            throw new Error(`Failed to remove volume: ${error.message}`);
        }
    }

    /**
     * Remove a network
     */
    async removeNetwork(connectionId: string, networkId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            await client.delete(`/networks/${networkId}`);
        } catch (error: any) {
            throw new Error(`Failed to remove network: ${error.message}`);
        }
    }

    /**
     * View container logs
     */
    async viewContainerLogs(connectionId: string, containerId: string, tail: number = 100): Promise<string> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            const response = await client.get(`/containers/${containerId}/logs`, {
                params: { stdout: true, stderr: true, tail, timestamps: true }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get container logs: ${error.message}`);
        }
    }

    /**
     * Inspect container, image, volume, or network
     */
    async inspectResource(connectionId: string, resourceType: 'container' | 'image' | 'volume' | 'network', resourceId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            let endpoint: string;
            if (resourceType === 'container') {
                endpoint = `/containers/${resourceId}/json`;
            } else if (resourceType === 'image') {
                endpoint = `/images/${resourceId}/json`;
            } else if (resourceType === 'volume') {
                endpoint = `/volumes/${resourceId}`;
            } else {
                endpoint = `/networks/${resourceId}`;
            }
            const response = await client.get(endpoint);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to inspect ${resourceType}: ${error.message}`);
        }
    }
}
