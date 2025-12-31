export enum ConnectionType {
    PostgreSQL = 'postgresql',
    MySQL = 'mysql',
    SQLite = 'sqlite',
    MongoDB = 'mongodb',
    Neo4J = 'neo4j',
    MariaDB = 'mariadb',
    Redis = 'redis',
    BullMQ = 'bullmq',
    Elasticsearch = 'elasticsearch',
    SSH = 'ssh',
    Docker = 'docker',
    FTP = 'ftp',
    SFTP = 'sftp',
    Kafka = 'kafka',
    RabbitMQ = 'rabbitmq'
}

export interface ConnectionConfig {
    id: string;
    name: string;
    type: ConnectionType;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    // Note: password is NOT stored here, managed by SecretManager
    ssl?: boolean;
    sshTunnel?: {
        enabled: boolean;
        host: string;
        port: number;
        username: string;
        // SSH password/key also managed by SecretManager
    };
    // Additional type-specific options
    options?: Record<string, any>;
}

export interface ConnectionStatus {
    id: string;
    connected: boolean;
    lastConnected?: Date;
    error?: string;
}

export interface QueryHistoryEntry {
    id: string;
    connectionId: string;
    connectionName: string;
    query: string;
    timestamp: string;
    executionTime?: number;
    success: boolean;
    error?: string;
}

export interface SavedQuery {
    id: string;
    name: string;
    description?: string;
    query: string;
    connectionId?: string;
    connectionType?: ConnectionType;
    folderId?: string;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
}

export interface SavedQueryFolder {
    id: string;
    name: string;
    parentId?: string;
    createdAt: string;
}

export interface ConnectionGroup {
    id: string;
    name: string;
    description?: string;
    connectionIds: string[];
    color?: string;
    createdAt: string;
}

export interface ConnectionMetadata {
    connectionId: string;
    isFavorite: boolean;
    groupId?: string;
    notes?: string;
}
