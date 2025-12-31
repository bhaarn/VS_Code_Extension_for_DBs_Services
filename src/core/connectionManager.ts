import * as vscode from 'vscode';
import { SecretManager } from './secretManager';
import { ConnectionConfig, ConnectionStatus, ConnectionType, ConnectionGroup, ConnectionMetadata } from './types';
import { IConnectionProvider } from '../providers/base';

/**
 * Central connection manager
 * Handles all database and service connections with security
 */
export class ConnectionManager {
    private connections: Map<string, ConnectionConfig> = new Map();
    private connectionStatus: Map<string, ConnectionStatus> = new Map();
    private providers: Map<ConnectionType, IConnectionProvider> = new Map();
    private secretManager: SecretManager;
    private context: vscode.ExtensionContext;
    private groups: Map<string, ConnectionGroup> = new Map();
    private metadata: Map<string, ConnectionMetadata> = new Map();

    constructor(secretManager: SecretManager, context: vscode.ExtensionContext) {
        this.secretManager = secretManager;
        this.context = context;
        this.loadConnections();
        this.loadGroups();
        this.loadMetadata();
    }

    /**
     * Get or create a provider for the given connection type (lazy loading)
     */
    private async getProvider(type: ConnectionType): Promise<IConnectionProvider | null> {
        if (this.providers.has(type)) {
            return this.providers.get(type)!;
        }

        try {
            let provider: IConnectionProvider | null = null;
            
            switch (type) {
                case ConnectionType.PostgreSQL:
                    const { PostgreSQLProvider } = await import('../providers/postgresqlProvider');
                    provider = new PostgreSQLProvider();
                    break;
                case ConnectionType.MySQL:
                    const { MySQLProvider } = await import('../providers/mysqlProvider');
                    provider = new MySQLProvider();
                    break;
                case ConnectionType.SQLite:
                    const { SQLiteProvider } = await import('../providers/sqliteProvider');
                    provider = new SQLiteProvider();
                    break;
                case ConnectionType.MongoDB:
                    const { MongoDBProvider } = await import('../providers/mongodbProvider');
                    provider = new MongoDBProvider();
                    break;
                case ConnectionType.Neo4J:
                    const { Neo4JProvider } = await import('../providers/neo4jProvider');
                    provider = new Neo4JProvider();
                    break;
                case ConnectionType.MariaDB:
                    const { MariaDBProvider } = await import('../providers/mariadbProvider');
                    provider = new MariaDBProvider();
                    break;
                case ConnectionType.Redis:
                    const { RedisProvider } = await import('../providers/redisProvider');
                    provider = new RedisProvider();
                    break;
                case ConnectionType.FTP:
                    const { FTPProvider } = await import('../providers/ftpProvider');
                    provider = new FTPProvider();
                    break;
                case ConnectionType.SFTP:
                    const { SFTPProvider } = await import('../providers/sftpProvider');
                    provider = new SFTPProvider();
                    break;
                case ConnectionType.RabbitMQ:
                    const { RabbitMQProvider } = await import('../providers/rabbitmqProvider');
                    provider = new RabbitMQProvider();
                    break;
                case ConnectionType.Kafka:
                    const { KafkaProvider } = await import('../providers/kafkaProvider');
                    provider = new KafkaProvider();
                    break;
                case ConnectionType.BullMQ:
                    const { BullMQProvider } = await import('../providers/bullmqProvider');
                    provider = new BullMQProvider();
                    break;
                case ConnectionType.SSH:
                    const { SSHProvider } = await import('../providers/sshProvider');
                    provider = new SSHProvider();
                    break;
                case ConnectionType.Docker:
                    const { DockerProvider } = await import('../providers/dockerProvider');
                    provider = new DockerProvider();
                    break;
                case ConnectionType.Elasticsearch:
                    const { ElasticsearchProvider } = await import('../providers/elasticsearchProvider');
                    provider = new ElasticsearchProvider();
                    break;
                default:
                    vscode.window.showWarningMessage(`Provider for ${type} not yet implemented`);
                    return null;
            }

            if (provider) {
                this.providers.set(type, provider);
            }
            return provider;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load provider for ${type}: ${error.message}`);
            console.error(`Provider loading error:`, error);
            return null;
        }
    }

    /**
     * Load saved connections from workspace state
     */
    private loadConnections(): void {
        const savedConnections = this.context.workspaceState.get<ConnectionConfig[]>('connections', []);
        savedConnections.forEach(conn => {
            this.connections.set(conn.id, conn);
        });
    }

    /**
     * Save connections to workspace state (without sensitive data)
     */
    private async saveConnections(): Promise<void> {
        const connectionsArray = Array.from(this.connections.values());
        await this.context.workspaceState.update('connections', connectionsArray);
    }

    /**
     * Add a new connection
     */
    async addConnection(config: ConnectionConfig, credentials: any): Promise<void> {
        // Validate connection string/config
        this.validateConnectionConfig(config);

        // Store connection config (without credentials)
        this.connections.set(config.id, config);

        // Store credentials securely
        await this.secretManager.storeCredentials(config.id, credentials);

        // Save to workspace state
        await this.saveConnections();

        vscode.window.showInformationMessage(`Connection "${config.name}" added successfully`);
    }

    /**
     * Update existing connection
     */
    async updateConnection(config: ConnectionConfig, credentials?: any): Promise<void> {
        if (!this.connections.has(config.id)) {
            throw new Error(`Connection ${config.id} not found`);
        }

        this.validateConnectionConfig(config);
        this.connections.set(config.id, config);

        if (credentials) {
            await this.secretManager.storeCredentials(config.id, credentials);
        }

        await this.saveConnections();
        vscode.window.showInformationMessage(`Connection "${config.name}" updated successfully`);
    }

    /**
     * Delete a connection
     */
    async deleteConnection(connectionId: string): Promise<void> {
        // Disconnect if connected
        if (this.isConnected(connectionId)) {
            await this.disconnect(connectionId);
        }

        // Remove connection
        this.connections.delete(connectionId);
        this.connectionStatus.delete(connectionId);

        // Delete credentials
        await this.secretManager.deleteCredentials(connectionId);

        // Save state
        await this.saveConnections();

        vscode.window.showInformationMessage('Connection deleted successfully');
    }

    /**
     * Connect to a database/service
     */
    async connect(connectionId: string): Promise<void> {
        const config = this.connections.get(connectionId);
        if (!config) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        const provider = await this.getProvider(config.type);
        if (!provider) {
            throw new Error(`Provider for ${config.type} not available`);
        }

        try {
            // Get credentials securely
            const credentials = await this.secretManager.getCredentials(connectionId);
            if (!credentials) {
                throw new Error('No credentials found. Please edit connection and re-enter credentials.');
            }

            // Connect using provider
            await provider.connect(config, credentials);

            // Update status
            this.connectionStatus.set(connectionId, {
                id: connectionId,
                connected: true,
                lastConnected: new Date()
            });

            vscode.window.showInformationMessage(`Connected to "${config.name}"`);
        } catch (error: any) {
            this.connectionStatus.set(connectionId, {
                id: connectionId,
                connected: false,
                error: error.message
            });
            vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from a database/service
     */
    async disconnect(connectionId: string): Promise<void> {
        const config = this.connections.get(connectionId);
        if (!config) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        const provider = await this.getProvider(config.type);
        if (provider && this.isConnected(connectionId)) {
            await provider.disconnect(connectionId);
        }

        this.connectionStatus.set(connectionId, {
            id: connectionId,
            connected: false
        });

        vscode.window.showInformationMessage(`Disconnected from "${config.name}"`);
    }

    /**
     * Get all connections
     */
    getConnections(): ConnectionConfig[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get connection by ID
     */
    getConnection(connectionId: string): ConnectionConfig | undefined {
        return this.connections.get(connectionId);
    }

    /**
     * Check if connection is active
     */
    isConnected(connectionId: string): boolean {
        const status = this.connectionStatus.get(connectionId);
        return status?.connected ?? false;
    }

    /**
     * Get connection status
     */
    getConnectionStatus(connectionId: string): ConnectionStatus | undefined {
        return this.connectionStatus.get(connectionId);
    }

    /**
     * Get provider for a connection (public method for query execution)
     */
    async getProviderForConnection(connectionId: string): Promise<IConnectionProvider | null> {
        const config = this.connections.get(connectionId);
        if (!config) {
            return null;
        }
        return await this.getProvider(config.type);
    }

    /**
     * Validate connection configuration
     */
    private validateConnectionConfig(config: ConnectionConfig): void {
        if (!config.id || !config.name || !config.type) {
            throw new Error('Invalid connection configuration: missing required fields');
        }

        // Type-specific validation
        switch (config.type) {
            case ConnectionType.SQLite:
                // SQLite doesn't need host/port
                if (!config.database) {
                    throw new Error('Database file path is required for SQLite');
                }
                break;
            case ConnectionType.Docker:
                // Docker can use Unix socket (no host/port) or HTTP (requires host/port)
                // If host is provided and not 'local' or 'unix', port is required
                if (config.host && config.host !== 'local' && config.host !== 'unix' && !config.host.startsWith('/')) {
                    if (!config.port) {
                        throw new Error('Port is required when using remote Docker host');
                    }
                }
                break;
            default:
                if (!config.host) {
                    throw new Error('Host is required for this connection type');
                }
                if (!config.port) {
                    throw new Error('Port is required for this connection type');
                }
                // Username/password are optional for local development databases
        }
    }

    /**
     * Get password for a connection (for export purposes)
     */
    async getPassword(connectionId: string): Promise<string | undefined> {
        const credentials = await this.secretManager.getCredentials(connectionId);
        if (!credentials) {
            return undefined;
        }
        
        // Return password property if it exists and is a string
        if (typeof credentials.password === 'string') {
            return credentials.password;
        }
        
        // If credentials itself is a string (legacy format)
        if (typeof credentials === 'string') {
            return credentials;
        }
        
        return undefined;
    }

    // ============ Group Management ============

    /**
     * Load groups from workspace state
     */
    private loadGroups(): void {
        const storedGroups = this.context.workspaceState.get<ConnectionGroup[]>('connectionGroups', []);
        this.groups.clear();
        storedGroups.forEach(group => this.groups.set(group.id, group));
    }

    /**
     * Save groups to workspace state
     */
    private saveGroups(): void {
        const groupsArray = Array.from(this.groups.values());
        this.context.workspaceState.update('connectionGroups', groupsArray);
    }

    /**
     * Load metadata from workspace state
     */
    private loadMetadata(): void {
        const storedMetadata = this.context.workspaceState.get<ConnectionMetadata[]>('connectionMetadata', []);
        this.metadata.clear();
        storedMetadata.forEach(meta => this.metadata.set(meta.connectionId, meta));
    }

    /**
     * Save metadata to workspace state
     */
    private saveMetadata(): void {
        const metadataArray = Array.from(this.metadata.values());
        this.context.workspaceState.update('connectionMetadata', metadataArray);
    }

    /**
     * Create a new connection group
     */
    async createGroup(name: string, description?: string): Promise<ConnectionGroup> {
        const group: ConnectionGroup = {
            id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            description,
            connectionIds: [],
            createdAt: new Date().toISOString()
        };
        this.groups.set(group.id, group);
        this.saveGroups();
        return group;
    }

    /**
     * Update a connection group
     */
    async updateGroup(groupId: string, updates: Partial<Omit<ConnectionGroup, 'id' | 'createdAt'>>): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) {
            throw new Error(`Group ${groupId} not found`);
        }
        Object.assign(group, updates);
        this.saveGroups();
    }

    /**
     * Delete a connection group
     */
    async deleteGroup(groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) {
            throw new Error(`Group ${groupId} not found`);
        }
        
        // Remove group assignment from metadata
        group.connectionIds.forEach(connId => {
            const meta = this.metadata.get(connId);
            if (meta && meta.groupId === groupId) {
                meta.groupId = undefined;
            }
        });
        
        this.groups.delete(groupId);
        this.saveGroups();
        this.saveMetadata();
    }

    /**
     * Get all groups
     */
    getGroups(): ConnectionGroup[] {
        return Array.from(this.groups.values());
    }

    /**
     * Get a group by ID
     */
    getGroup(groupId: string): ConnectionGroup | undefined {
        return this.groups.get(groupId);
    }

    /**
     * Add connection to group
     */
    async addConnectionToGroup(connectionId: string, groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) {
            throw new Error(`Group ${groupId} not found`);
        }
        
        // Initialize metadata if not exists
        let meta = this.metadata.get(connectionId);
        if (!meta) {
            meta = {
                connectionId,
                isFavorite: false
            };
            this.metadata.set(connectionId, meta);
        }
        
        // Remove from old group if exists
        if (meta.groupId && meta.groupId !== groupId) {
            const oldGroup = this.groups.get(meta.groupId);
            if (oldGroup) {
                oldGroup.connectionIds = oldGroup.connectionIds.filter(id => id !== connectionId);
            }
        }
        
        // Add to new group
        meta.groupId = groupId;
        if (!group.connectionIds.includes(connectionId)) {
            group.connectionIds.push(connectionId);
        }
        
        this.saveGroups();
        this.saveMetadata();
    }

    /**
     * Remove connection from group
     */
    async removeConnectionFromGroup(connectionId: string): Promise<void> {
        const meta = this.metadata.get(connectionId);
        if (!meta || !meta.groupId) {
            return;
        }
        
        const group = this.groups.get(meta.groupId);
        if (group) {
            group.connectionIds = group.connectionIds.filter(id => id !== connectionId);
        }
        
        meta.groupId = undefined;
        this.saveGroups();
        this.saveMetadata();
    }

    /**
     * Toggle favorite status for a connection
     */
    async toggleFavorite(connectionId: string): Promise<boolean> {
        let meta = this.metadata.get(connectionId);
        if (!meta) {
            meta = {
                connectionId,
                isFavorite: true
            };
            this.metadata.set(connectionId, meta);
        } else {
            meta.isFavorite = !meta.isFavorite;
        }
        this.saveMetadata();
        return meta.isFavorite;
    }

    /**
     * Get metadata for a connection
     */
    getMetadata(connectionId: string): ConnectionMetadata | undefined {
        return this.metadata.get(connectionId);
    }

    /**
     * Get all favorite connections
     */
    getFavoriteConnections(): ConnectionConfig[] {
        const favorites: ConnectionConfig[] = [];
        this.metadata.forEach((meta, connectionId) => {
            if (meta.isFavorite) {
                const conn = this.connections.get(connectionId);
                if (conn) {
                    favorites.push(conn);
                }
            }
        });
        return favorites;
    }

    /**
     * Get connections in a group
     */
    getConnectionsInGroup(groupId: string): ConnectionConfig[] {
        const group = this.groups.get(groupId);
        if (!group) {
            return [];
        }
        return group.connectionIds
            .map(id => this.connections.get(id))
            .filter((conn): conn is ConnectionConfig => conn !== undefined);
    }

    /**
     * Get ungrouped connections
     */
    getUngroupedConnections(): ConnectionConfig[] {
        const ungrouped: ConnectionConfig[] = [];
        this.connections.forEach((conn, connectionId) => {
            const meta = this.metadata.get(connectionId);
            if (!meta || !meta.groupId) {
                ungrouped.push(conn);
            }
        });
        return ungrouped;
    }
}
