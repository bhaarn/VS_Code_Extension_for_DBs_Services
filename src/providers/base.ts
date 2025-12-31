import { ConnectionConfig } from '../core/types';

/**
 * Base interface for all connection providers
 * Each database/service type implements this interface
 */
export interface IConnectionProvider {
    /**
     * Connect to the database/service
     * @param config Connection configuration
     * @param credentials Secure credentials
     */
    connect(config: ConnectionConfig, credentials: any): Promise<void>;

    /**
     * Disconnect from the database/service
     * @param connectionId Connection identifier
     */
    disconnect(connectionId: string): Promise<void>;

    /**
     * Test connection without establishing permanent connection
     * @param config Connection configuration
     * @param credentials Secure credentials
     */
    testConnection(config: ConnectionConfig, credentials: any): Promise<boolean>;

    /**
     * Get connection metadata (tables, databases, etc.)
     * @param connectionId Connection identifier
     */
    getMetadata(connectionId: string): Promise<any>;

    /**
     * Execute a query
     * @param connectionId Connection identifier
     * @param targetOrQuery Target database/collection/table OR query string for services
     * @param query Query string (optional for services that use targetOrQuery as query)
     */
    executeQuery?(connectionId: string, targetOrQuery: string, query?: string): Promise<any>;
}

/**
 * Abstract base class for connection providers
 * Provides common functionality
 */
export abstract class BaseConnectionProvider implements IConnectionProvider {
    protected connections: Map<string, any> = new Map();

    abstract connect(config: ConnectionConfig, credentials: any): Promise<void>;
    abstract disconnect(connectionId: string): Promise<void>;
    abstract testConnection(config: ConnectionConfig, credentials: any): Promise<boolean>;
    abstract getMetadata(connectionId: string): Promise<any>;

    /**
     * Check if connection exists
     */
    protected hasConnection(connectionId: string): boolean {
        return this.connections.has(connectionId);
    }

    /**
     * Get active connection
     */
    protected getConnection(connectionId: string): any {
        return this.connections.get(connectionId);
    }

    /**
     * Sanitize connection string to prevent injection
     */
    protected sanitizeConnectionString(str: string): string {
        // Remove any suspicious characters
        return str.replace(/[;&|`$]/g, '');
    }
}
