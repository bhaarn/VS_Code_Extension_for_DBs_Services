import * as vscode from 'vscode';
import { SecretManager } from './secretManager';
import { ConnectionConfig, ConnectionStatus, ConnectionType } from './types';
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

    constructor(secretManager: SecretManager, context: vscode.ExtensionContext) {
        this.secretManager = secretManager;
        this.context = context;
        this.loadConnections();
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
}
