import * as vscode from 'vscode';
import { ConnectionManager } from '../core/connectionManager';
import { ConnectionConfig, ConnectionType } from '../core/types';

/**
 * Utility to execute query with timing
 */
async function executeQueryWithTiming<T>(
    queryFn: () => Promise<T>,
    queryText: string
): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    try {
        const result = await queryFn();
        const executionTime = Date.now() - startTime;
        return { result, executionTime };
    } catch (error) {
        const executionTime = Date.now() - startTime;
        throw error;
    }
}

/**
 * Format execution time for display
 */
function formatExecutionTime(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)}s`;
    } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(2);
        return `${minutes}m ${seconds}s`;
    }
}

export class ConnectionExplorer implements vscode.TreeDataProvider<ConnectionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionItem | undefined | null | void> = new vscode.EventEmitter<ConnectionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined | null | void> = this._onDidChangeTreeData.event;
    public queryHistory?: any; // Set by extension.ts

    constructor(
        private context: vscode.ExtensionContext,
        private connectionManager: ConnectionManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private async logQueryToHistory(connectionId: string, query: string, executionTime: number, success: boolean, error?: string): Promise<void> {
        if (this.queryHistory) {
            const connections = await this.connectionManager.getConnections();
            const connection = connections.find(c => c.id === connectionId);
            const connectionName = connection ? connection.name : 'Unknown';
            
            await this.queryHistory.addToHistory(
                connectionId,
                connectionName,
                query,
                executionTime,
                success,
                error
            );
        }
    }

    getTreeItem(element: ConnectionItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConnectionItem): Thenable<ConnectionItem[]> {
        if (!element) {
            // Root level - show all connections
            const connections = this.connectionManager.getConnections();
            return Promise.resolve(connections.map((conn: ConnectionConfig) => new ConnectionItem(
                conn,
                this.connectionManager.isConnected(conn.id),
                'connection'
            )));
        } else if (element.contextValue === 'connection' && element.isConnected) {
            // Show databases for connected connection
            return this.getDatabases(element);
        } else if (element.contextValue === 'database') {
            // Show collections/tables/labels/keys for database
            return this.getCollections(element);
        } else if (element.contextValue === 'directory') {
            // Show subdirectories and files for FTP/SFTP directories
            return this.getDirectoryContents(element);
        } else if (element.contextValue && element.contextValue.startsWith('category-')) {
            // Categories can have children - fetch them dynamically
            return this.getCategoryChildren(element);
        }
        return Promise.resolve([]);
    }

    private async getCategoryChildren(categoryItem: ConnectionItem): Promise<ConnectionItem[]> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(categoryItem.config.id);
            if (!provider || !provider.executeQuery) {
                return [];
            }

            const categoryName = categoryItem.label as string;
            const providerType = categoryItem.config.type;

            // Determine which command to run based on category and provider
            let command = '';
            if (providerType === ConnectionType.RabbitMQ) {
                if (categoryName.toLowerCase() === 'queues') {
                    command = 'queues';
                } else if (categoryName.toLowerCase() === 'exchanges') {
                    command = 'exchanges';
                }
            } else if (providerType === ConnectionType.BullMQ) {
                if (categoryName.toLowerCase() === 'queues') {
                    command = 'queues';
                }
            } else if (providerType === ConnectionType.Kafka) {
                if (categoryName.toLowerCase() === 'topics') {
                    command = 'topics';
                } else if (categoryName.toLowerCase() === 'brokers') {
                    return []; // Brokers are static
                }
            } else if (providerType === ConnectionType.SSH) {
                return []; // SSH doesn't have listable children
            } else if (providerType === ConnectionType.Docker) {
                const catLower = categoryName.toLowerCase();
                if (catLower === 'containers') {
                    command = 'containers';
                } else if (catLower === 'images') {
                    command = 'images';
                } else if (catLower === 'volumes') {
                    command = 'volumes';
                } else if (catLower === 'networks') {
                    command = 'networks';
                }
            } else if (providerType === ConnectionType.Elasticsearch) {
                const catLower = categoryName.toLowerCase();
                if (catLower === 'indices') {
                    command = 'indices';
                } else if (catLower === 'cluster' || catLower === 'search') {
                    return []; // These are action categories, not listable
                }
            }

            if (!command) {
                return [];
            }

            // Execute the command to get the list
            const { result } = await executeQueryWithTiming(
                () => provider.executeQuery!(categoryItem.config.id, command),
                command
            );

            // Parse the result and create child items
            const children: ConnectionItem[] = [];
            
            if (providerType === ConnectionType.BullMQ && result.queues) {
                // BullMQ returns { queues: ['queue1', 'queue2', ...] }
                result.queues.forEach((queueName: string) => {
                    children.push(new ConnectionItem(
                        categoryItem.config,
                        true,
                        'queue',
                        queueName
                    ));
                });
            } else if (providerType === ConnectionType.RabbitMQ) {
                // RabbitMQ returns queues or exchanges array
                if (result.queues && Array.isArray(result.queues)) {
                    result.queues.forEach((queueName: string) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'queue',
                            queueName
                        ));
                    });
                } else if (result.exchanges && Array.isArray(result.exchanges)) {
                    result.exchanges.forEach((exchangeName: string) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'exchange',
                            exchangeName
                        ));
                    });
                }
                // If no items but has a message, return empty (will show expansion arrow but empty list)
                return children;
            } else if (providerType === ConnectionType.Kafka) {
                // Kafka returns topics array or object with topics
                const topics = Array.isArray(result) ? result : (result.topics || []);
                topics.forEach((topic: any) => {
                    const topicName = typeof topic === 'string' ? topic : topic.name;
                    children.push(new ConnectionItem(
                        categoryItem.config,
                        true,
                        'topic',
                        topicName
                    ));
                });
            } else if (providerType === ConnectionType.Docker) {
                // Docker returns containers, images, volumes, networks
                if (result.containers) {
                    result.containers.forEach((container: any) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'container',
                            `${container.name} (${container.state})`
                        ));
                    });
                } else if (result.images) {
                    result.images.forEach((image: any) => {
                        const tag = Array.isArray(image.tags) ? image.tags[0] : image.tags;
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'image',
                            tag
                        ));
                    });
                } else if (result.volumes) {
                    result.volumes.forEach((volume: any) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'volume',
                            volume.name
                        ));
                    });
                } else if (result.networks) {
                    result.networks.forEach((network: any) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'network',
                            network.name
                        ));
                    });
                }
            } else if (providerType === ConnectionType.Elasticsearch) {
                // Elasticsearch returns indices
                if (result.indices) {
                    result.indices.forEach((index: any) => {
                        children.push(new ConnectionItem(
                            categoryItem.config,
                            true,
                            'index',
                            `${index.name} (${index.docs_count} docs)`
                        ));
                    });
                }
            }

            return children;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch category children: ${error.message}`);
            return [];
        }
    }

    private async getDatabases(connectionItem: ConnectionItem): Promise<ConnectionItem[]> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(connectionItem.config.id);
            if (!provider || !provider.executeQuery) {
                return [];
            }

            const metadata = await provider.getMetadata(connectionItem.config.id);
            
            if (Array.isArray(metadata)) {
                return metadata.map((db: any) => {
                    // Handle different metadata types
                    if (typeof db === 'string') {
                        // Simple string (MongoDB databases)
                        return new ConnectionItem(
                            { ...connectionItem.config, database: db },
                            true,
                            'database',
                            db
                        );
                    } else if (db.type === 'category') {
                        // Category items for service providers (RabbitMQ, Kafka, BullMQ, SSH)
                        // Use provider-specific context value to show correct menu items
                        const contextValue = `category-${connectionItem.config.type.toLowerCase()}`;
                        return new ConnectionItem(
                            connectionItem.config,
                            true,
                            contextValue,
                            db.name
                        );
                    } else {
                        // Database objects for SQL databases
                        return new ConnectionItem(
                            { ...connectionItem.config, database: db.name },
                            true,
                            'database',
                            db.name
                        );
                    }
                });
            }
            
            return [];
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch databases: ${error.message}`);
            return [];
        }
    }

    private async getCollections(databaseItem: ConnectionItem): Promise<ConnectionItem[]> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(databaseItem.config.id);
            if (!provider || !provider.executeQuery) {
                return [];
            }

            // For MongoDB, we need to connect to the specific database and list collections
            if (databaseItem.config.type === ConnectionType.MongoDB) {
                const client = (provider as any).getConnection(databaseItem.config.id);
                if (client) {
                    const db = client.db(databaseItem.label as string);
                    const collections = await db.listCollections().toArray();
                    return collections.map((c: any) => new ConnectionItem(
                        { ...databaseItem.config, database: databaseItem.label as string },
                        true,
                        'collection',
                        c.name
                    ));
                }
            }
            
            // For SQL databases and others, get from metadata
            const metadata = await provider.getMetadata(databaseItem.config.id);
            if (Array.isArray(metadata)) {
                const dbMetadata = metadata.find(db => db.name === databaseItem.label);
                if (dbMetadata && dbMetadata.children) {
                    return dbMetadata.children.map((child: any) => new ConnectionItem(
                        { ...databaseItem.config, database: databaseItem.label as string },
                        true,
                        child.type, // 'table', 'collection', 'label', 'key'
                        child.name
                    ));
                }
            }
            
            return [];
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch collections: ${error.message}`);
            return [];
        }
    }

    private async getMetadata(connectionId: string, database?: string): Promise<any> {
        // Get metadata from connection manager
        const provider = await this.connectionManager.getProviderForConnection(connectionId);
        if (provider) {
            return await provider.getMetadata(connectionId);
        }
        return [];
    }

    private async getDirectoryContents(directoryItem: ConnectionItem): Promise<ConnectionItem[]> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(directoryItem.config.id);
            if (!provider || !provider.executeQuery) {
                return [];
            }

            const path = directoryItem.label as string;
            const { result } = await executeQueryWithTiming(
                () => provider.executeQuery!(directoryItem.config.id, `list ${path}`),
                `list ${path}`
            );
            
            if (Array.isArray(result)) {
                return result.map((item: any) => {
                    const fullPath = path.endsWith('/') ? `${path}${item.name}` : `${path}/${item.name}`;
                    return new ConnectionItem(
                        directoryItem.config,
                        true,
                        item.type, // 'directory' or 'file'
                        fullPath
                    );
                });
            }
            
            return [];
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to list directory: ${error.message}`);
            return [];
        }
    }

    async addConnection(): Promise<void> {
        // Step 1: Select connection type
        const connectionTypes = [
            { label: '$(database) PostgreSQL', value: ConnectionType.PostgreSQL },
            { label: '$(database) MySQL', value: ConnectionType.MySQL },
            { label: '$(database) SQLite', value: ConnectionType.SQLite },
            { label: '$(database) MongoDB', value: ConnectionType.MongoDB },
            { label: '$(database) Neo4J', value: ConnectionType.Neo4J },
            { label: '$(database) MariaDB', value: ConnectionType.MariaDB },
            { label: '$(circuit-board) Redis', value: ConnectionType.Redis },
            { label: '$(server) BullMQ', value: ConnectionType.BullMQ },
            { label: '$(search) Elasticsearch', value: ConnectionType.Elasticsearch },
            { label: '$(terminal) SSH', value: ConnectionType.SSH },
            { label: '$(package) Docker', value: ConnectionType.Docker },
            { label: '$(cloud-upload) FTP', value: ConnectionType.FTP },
            { label: '$(file-symlink-directory) SFTP', value: ConnectionType.SFTP },
            { label: '$(broadcast) Kafka', value: ConnectionType.Kafka },
            { label: '$(inbox) RabbitMQ', value: ConnectionType.RabbitMQ }
        ];

        const selectedType = await vscode.window.showQuickPick(connectionTypes, {
            placeHolder: 'Select connection type'
        });

        if (!selectedType) {
            return;
        }

        const type = selectedType.value;

        // Step 2: Collect connection details
        const name = await vscode.window.showInputBox({
            prompt: 'Connection name',
            placeHolder: 'My Database'
        });

        if (!name) {
            return;
        }

        let config: ConnectionConfig = {
            id: `${type}-${Date.now()}`,
            name,
            type
        };

        // SQLite special handling
        if (type === ConnectionType.SQLite) {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'SQLite Database': ['db', 'sqlite', 'sqlite3'] }
            });

            if (!files || files.length === 0) {
                return;
            }

            config.database = files[0].fsPath;

            // SQLite doesn't need credentials
            await this.connectionManager.addConnection(config, {});
            this.refresh();
            return;
        }

        // Other connections need host/port
        const host = await vscode.window.showInputBox({
            prompt: 'Host (press Enter for localhost)',
            value: 'localhost',
            placeHolder: 'localhost'
        });

        if (host === undefined) {
            return;
        }

        const portStr = await vscode.window.showInputBox({
            prompt: 'Port (press Enter for default)',
            value: this.getDefaultPort(type).toString(),
            placeHolder: this.getDefaultPort(type).toString()
        });

        if (portStr === undefined) {
            return;
        }

        const database = await vscode.window.showInputBox({
            prompt: `Database name (optional, press Enter to skip)`,
            placeHolder: `${type === ConnectionType.PostgreSQL ? 'postgres' : type === ConnectionType.MySQL || type === ConnectionType.MariaDB ? 'mysql' : type === ConnectionType.MongoDB ? 'admin' : 'mydb'}`,
            value: ''
        });

        const username = await vscode.window.showInputBox({
            prompt: 'Username (leave empty if no authentication)',
            placeHolder: 'Leave empty for local MongoDB without auth'
        });

        // Only ask for password if username was provided
        let password = '';
        if (username) {
            const pwd = await vscode.window.showInputBox({
                prompt: 'Password',
                password: true
            });
            if (pwd === undefined) {
                return;
            }
            password = pwd || '';
        }

        config.host = host || 'localhost';
        config.port = parseInt(portStr) || this.getDefaultPort(type);
        config.database = database || undefined;
        config.username = username || undefined;

        const credentials = { password };

        try {
            await this.connectionManager.addConnection(config, credentials);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to add connection: ${error.message}`);
        }
    }

    async editConnection(item: ConnectionItem): Promise<void> {
        const config = item.config;
        
        // Step 1: Edit connection name
        const name = await vscode.window.showInputBox({
            prompt: 'Connection name',
            value: config.name,
            placeHolder: config.name
        });

        if (name === undefined) {
            return;
        }

        // SQLite special handling
        if (config.type === ConnectionType.SQLite) {
            const changeFile = await vscode.window.showQuickPick(['Keep current file', 'Select new file'], {
                placeHolder: `Current: ${config.database}`
            });

            if (!changeFile) {
                return;
            }

            let dbPath = config.database;
            if (changeFile === 'Select new file') {
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'SQLite Database': ['db', 'sqlite', 'sqlite3'] }
                });

                if (!files || files.length === 0) {
                    return;
                }
                dbPath = files[0].fsPath;
            }

            const updatedConfig: ConnectionConfig = {
                ...config,
                name: name || config.name,
                database: dbPath
            };

            await this.connectionManager.updateConnection(updatedConfig);
            this.refresh();
            return;
        }

        // For other connections
        const host = await vscode.window.showInputBox({
            prompt: 'Host',
            value: config.host || 'localhost',
            placeHolder: 'localhost'
        });

        if (host === undefined) {
            return;
        }

        const portStr = await vscode.window.showInputBox({
            prompt: 'Port',
            value: (config.port || this.getDefaultPort(config.type)).toString(),
            placeHolder: this.getDefaultPort(config.type).toString()
        });

        if (portStr === undefined) {
            return;
        }

        const database = await vscode.window.showInputBox({
            prompt: 'Database name (optional)',
            value: config.database || '',
            placeHolder: config.database || 'mydb'
        });

        const username = await vscode.window.showInputBox({
            prompt: 'Username (leave empty if no authentication)',
            value: config.username || '',
            placeHolder: config.username || 'Leave empty for no auth'
        });

        // Ask if they want to update password
        const updatePassword = await vscode.window.showQuickPick(
            ['Keep current password', 'Enter new password'],
            { placeHolder: 'Password options' }
        );

        if (!updatePassword) {
            return;
        }

        let credentials = undefined;
        if (updatePassword === 'Enter new password') {
            const password = await vscode.window.showInputBox({
                prompt: 'New Password',
                password: true
            });

            if (password === undefined) {
                return;
            }

            credentials = { password };
        }

        const updatedConfig: ConnectionConfig = {
            ...config,
            name: name || config.name,
            host: host || 'localhost',
            port: parseInt(portStr) || this.getDefaultPort(config.type),
            database: database || undefined,
            username: username || undefined
        };

        try {
            await this.connectionManager.updateConnection(updatedConfig, credentials);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to update connection: ${error.message}`);
        }
    }

    async deleteConnection(item: ConnectionItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Delete connection "${item.config.name}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await this.connectionManager.deleteConnection(item.config.id);
                this.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to delete connection: ${error.message}`);
            }
        }
    }

    async connect(item: ConnectionItem): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Connecting to ${item.config.name}...`,
                cancellable: false
            }, async () => {
                await this.connectionManager.connect(item.config.id);
            });
            this.refresh();
        } catch (error: any) {
            // Error already shown by connectionManager
        }
    }

    async disconnect(item: ConnectionItem): Promise<void> {
        try {
            await this.connectionManager.disconnect(item.config.id);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error.message}`);
        }
    }

    async queryCollection(item: ConnectionItem): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter MongoDB query (JavaScript object)',
            placeHolder: '{}',
            value: '{}'
        });

        if (!query) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Query execution not supported for this connection type');
            }

            // Show progress and track execution time
            const startTime = Date.now();
            const results = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Querying ${item.label}...`,
                cancellable: false
            }, async () => {
                // For MongoDB, we need to pass database info
                if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                    const client = (provider as any).getConnection(item.config.id);
                    if (client) {
                        const queryObj = JSON.parse(query);
                        const db = client.db(item.config.database);
                        const labelText = typeof item.label === 'string' ? item.label : (item.label?.label || '');
                        const collection = db.collection(labelText);
                        return await collection.find(queryObj).limit(100).toArray();
                    }
                }
                const labelText = typeof item.label === 'string' ? item.label : (item.label?.label || '');
                return await provider.executeQuery!(item.config.id, labelText, query);
            });
            const executionTime = Date.now() - startTime;
            
            // Build full query for history (with collection and database context for MongoDB)
            const labelText = typeof item.label === 'string' ? item.label : (item.label?.label || '');
            let fullQuery = query;
            if (item.config.type === ConnectionType.MongoDB) {
                // Include database context in the query for MongoDB
                const dbComment = item.config.database ? `// Database: ${item.config.database}\n` : '';
                fullQuery = `${dbComment}db.${labelText}.find(${query})`;
            }
            
            // Log to query history
            await this.logQueryToHistory(item.config.id, fullQuery, executionTime, true);
            
            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(results, null, 2),
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage(`Found ${Array.isArray(results) ? results.length : 0} documents in ${formatExecutionTime(executionTime)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Query failed: ${error.message}`);
            // Log failed query to history
            const labelText = typeof item.label === 'string' ? item.label : (item.label?.label || '');
            let fullQuery = query;
            if (item.config.type === ConnectionType.MongoDB) {
                const dbComment = item.config.database ? `// Database: ${item.config.database}\n` : '';
                fullQuery = `${dbComment}db.${labelText}.find(${query})`;
            }
            await this.logQueryToHistory(item.config.id, fullQuery, 0, false, error.message);
        }
    }

    async insertDocument(item: ConnectionItem): Promise<void> {
        const document = await vscode.window.showInputBox({
            prompt: 'Enter document to insert (JSON format)',
            placeHolder: '{"name": "John", "age": 30}',
            validateInput: (value) => {
                try {
                    JSON.parse(value);
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!document) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                const client = (provider as any).getConnection(item.config.id);
                if (client) {
                    const docObj = JSON.parse(document);
                    const db = client.db(item.config.database);
                    const collection = db.collection(item.label || '');
                    const result = await collection.insertOne(docObj);
                    vscode.window.showInformationMessage(`Document inserted with ID: ${result.insertedId}`);
                    this.refresh();
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Insert failed: ${error.message}`);
        }
    }

    async insertMultipleDocuments(item: ConnectionItem): Promise<void> {
        const documents = await vscode.window.showInputBox({
            prompt: 'Enter documents to insert (JSON array format)',
            placeHolder: '[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]',
            validateInput: (value) => {
                try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed)) {
                        return 'Must be a JSON array';
                    }
                    if (parsed.length === 0) {
                        return 'Array cannot be empty';
                    }
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!documents) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                const client = (provider as any).getConnection(item.config.id);
                if (client) {
                    const docsArray = JSON.parse(documents);
                    const db = client.db(item.config.database);
                    const collection = db.collection(item.label || '');
                    const result = await collection.insertMany(docsArray);
                    vscode.window.showInformationMessage(`Inserted ${result.insertedCount} documents`);
                    this.refresh();
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Bulk insert failed: ${error.message}`);
        }
    }

    async updateDocument(item: ConnectionItem): Promise<void> {
        const filter = await vscode.window.showInputBox({
            prompt: 'Enter filter to find document (JSON format)',
            placeHolder: '{"_id": "..."}',
            validateInput: (value) => {
                try {
                    JSON.parse(value);
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!filter) {
            return;
        }

        const update = await vscode.window.showInputBox({
            prompt: 'Enter update operation (JSON format)',
            placeHolder: '{"$set": {"name": "Jane"}}',
            validateInput: (value) => {
                try {
                    JSON.parse(value);
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!update) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                const client = (provider as any).getConnection(item.config.id);
                if (client) {
                    const filterObj = JSON.parse(filter);
                    const updateObj = JSON.parse(update);
                    const db = client.db(item.config.database);
                    const collection = db.collection(item.label || '');
                    const result = await collection.updateMany(filterObj, updateObj);
                    vscode.window.showInformationMessage(`Updated ${result.modifiedCount} document(s)`);
                    this.refresh();
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Update failed: ${error.message}`);
        }
    }

    async deleteDocument(item: ConnectionItem): Promise<void> {
        const filter = await vscode.window.showInputBox({
            prompt: 'Enter filter to find document(s) to delete (JSON format)',
            placeHolder: '{"_id": "..."}',
            validateInput: (value) => {
                try {
                    JSON.parse(value);
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (!filter) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Delete document(s) matching: ${filter}?`,
            { modal: true },
            'Delete One',
            'Delete Many'
        );

        if (!confirm) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                const client = (provider as any).getConnection(item.config.id);
                if (client) {
                    const filterObj = JSON.parse(filter);
                    const db = client.db(item.config.database);
                    const collection = db.collection(item.label || '');
                    
                    let result;
                    if (confirm === 'Delete One') {
                        result = await collection.deleteOne(filterObj);
                    } else {
                        result = await collection.deleteMany(filterObj);
                    }
                    
                    vscode.window.showInformationMessage(`Deleted ${result.deletedCount} document(s)`);
                    this.refresh();
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Delete failed: ${error.message}`);
        }
    }

    async runMongoScript(item: ConnectionItem): Promise<void> {
        // Create a new untitled document for the user to write their script
        const doc = await vscode.workspace.openTextDocument({
            content: `// MongoDB Playground - ${item.label}\n// Database: ${item.config.database}\n\n// Example queries:\n// db.${item.label}.find({})\n// db.${item.label}.aggregate([{$match: {age: {$gt: 25}}}])\n// db.${item.label}.insertMany([{name: "Test"}])\n\n`,
            language: 'javascript'
        });

        const editor = await vscode.window.showTextDocument(doc);

        // Loop to allow multiple executions
        let continueExecuting = true;
        while (continueExecuting) {
            // Add a command to execute the script
            const executeButton = await vscode.window.showInformationMessage(
                'Write your MongoDB script and click "Execute" to run it',
                'Execute',
                'Close'
            );

            if (executeButton === 'Execute') {
                const script = editor.document.getText();
                if (!script.trim()) {
                    vscode.window.showWarningMessage('Script is empty');
                    continue; // Ask again
                }

                try {
                    const provider = await this.connectionManager.getProviderForConnection(item.config.id);
                    if (!provider || !provider.executeQuery) {
                        throw new Error('Provider not available');
                    }

                    if (item.config.type === ConnectionType.MongoDB && item.config.database) {
                        const client = (provider as any).getConnection(item.config.id);
                        if (client) {
                            const db = client.db(item.config.database);
                            
                            // Parse and execute the script with timing
                            const startTime = Date.now();
                            const results = await this.executeMongoScript(db, script, (item.label as string) || '');
                            const executionTime = Date.now() - startTime;
                            
                            // Log to query history
                            await this.logQueryToHistory(item.config.id, script, executionTime, true);
                            
                            // Show results in a new document
                            const resultDoc = await vscode.workspace.openTextDocument({
                                content: JSON.stringify(results, null, 2),
                                language: 'json'
                            });
                            await vscode.window.showTextDocument(resultDoc, { viewColumn: vscode.ViewColumn.Beside });
                            
                            vscode.window.showInformationMessage(`Script executed successfully in ${formatExecutionTime(executionTime)}`);
                        }
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Script execution failed: ${error.message}`);
                    // Log failed query to history
                    await this.logQueryToHistory(item.config.id, script, 0, false, error.message);
                }
            } else {
                // User clicked "Close" or dismissed the dialog
                continueExecuting = false;
            }
        }
    }

    private async executeMongoScript(db: any, script: string, collectionName: string): Promise<any> {
        // Remove comments and clean up the script
        const cleanScript = script
            .split('\n')
            .filter(line => !line.trim().startsWith('//'))
            .join('\n')
            .trim();

        // Create a safe execution context with db and collection
        const collection = db.collection(collectionName);
        
        // Helper object to mimic MongoDB shell
        const dbProxy = {
            [collectionName]: collection,
            collection: (name: string) => db.collection(name)
        };

        try {
            // Try to evaluate common MongoDB operations
            // This is a simplified version - for full playground support, you'd need a proper parser
            
            // Match db.collection.find(...)
            // Use [\s\S]*? to match any character including newlines (non-greedy)
            const findMatch = cleanScript.match(/db\.\w+\.find\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (findMatch) {
                const query = findMatch[1].trim() || '{}';
                const queryObj = eval(`(${query})`);
                return await collection.find(queryObj).limit(100).toArray();
            }

            // Match db.collection.aggregate(...)
            const aggMatch = cleanScript.match(/db\.\w+\.aggregate\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (aggMatch) {
                const pipeline = eval(`(${aggMatch[1]})`);
                return await collection.aggregate(pipeline).toArray();
            }

            // Match db.collection.insertMany(...)
            const insertManyMatch = cleanScript.match(/db\.\w+\.insertMany\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (insertManyMatch) {
                const docs = eval(`(${insertManyMatch[1]})`);
                const result = await collection.insertMany(docs);
                return { insertedCount: result.insertedCount, insertedIds: result.insertedIds };
            }

            // Match db.collection.insertOne(...)
            const insertOneMatch = cleanScript.match(/db\.\w+\.insertOne\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (insertOneMatch) {
                const doc = eval(`(${insertOneMatch[1]})`);
                const result = await collection.insertOne(doc);
                return { insertedId: result.insertedId };
            }

            // Match db.collection.updateMany(...)
            const updateManyMatch = cleanScript.match(/db\.\w+\.updateMany\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (updateManyMatch) {
                // Parse the arguments properly
                const argsStr = updateManyMatch[1];
                const args = this.parseMongoArguments(argsStr);
                if (args.length !== 2) {
                    throw new Error('updateMany requires exactly 2 arguments: filter and update');
                }
                const filter = eval(`(${args[0]})`);
                const update = eval(`(${args[1]})`);
                const result = await collection.updateMany(filter, update);
                return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
            }

            // Match db.collection.deleteMany(...)
            const deleteManyMatch = cleanScript.match(/db\.\w+\.deleteMany\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (deleteManyMatch) {
                const filter = eval(`(${deleteManyMatch[1]})`);
                const result = await collection.deleteMany(filter);
                return { deletedCount: result.deletedCount };
            }

            // Match db.collection.countDocuments(...)
            const countMatch = cleanScript.match(/db\.\w+\.countDocuments\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (countMatch) {
                const filter = eval(`(${countMatch[1].trim() || '{}'})`);
                return { count: await collection.countDocuments(filter) };
            }

            throw new Error('Unsupported operation. Supported: find, aggregate, insertOne, insertMany, updateMany, deleteMany, countDocuments');
        } catch (error: any) {
            throw new Error(`Script parsing/execution failed: ${error.message}`);
        }
    }

    private parseMongoArguments(argsStr: string): string[] {
        // Simple parser to split arguments by top-level commas
        const args: string[] = [];
        let currentArg = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];
            const prevChar = i > 0 ? argsStr[i - 1] : '';

            // Handle string literals
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            if (!inString) {
                // Track depth of brackets
                if (char === '{' || char === '[' || char === '(') {
                    depth++;
                } else if (char === '}' || char === ']' || char === ')') {
                    depth--;
                } else if (char === ',' && depth === 0) {
                    // Top-level comma - split here
                    args.push(currentArg.trim());
                    currentArg = '';
                    continue;
                }
            }

            currentArg += char;
        }

        if (currentArg.trim()) {
            args.push(currentArg.trim());
        }

        return args;
    }

    // SQL Script Execution
    async runSQLScript(item: ConnectionItem): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `-- SQL Script - ${item.label}\n-- Database: ${item.config.database}\n\n-- Example queries:\n-- SELECT * FROM ${item.label} LIMIT 10;\n-- INSERT INTO ${item.label} (column1) VALUES ('value1');\n\n`,
            language: 'sql'
        });

        const editor = await vscode.window.showTextDocument(doc);

        let continueExecuting = true;
        while (continueExecuting) {
            const executeButton = await vscode.window.showInformationMessage(
                'Write your SQL script and click "Execute" to run it',
                'Execute',
                'Close'
            );

            if (executeButton === 'Execute') {
                const script = editor.document.getText();
                if (!script.trim()) {
                    vscode.window.showWarningMessage('Script is empty');
                    continue;
                }

                try {
                    const provider = await this.connectionManager.getProviderForConnection(item.config.id);
                    if (!provider || !provider.executeQuery) {
                        throw new Error('Provider not available');
                    }

                    // For SQL databases, we need to select the database first
                    const dbName = item.config.database;
                    
                    // For MySQL/MariaDB, execute USE database first if needed
                    if (dbName && [ConnectionType.MySQL, ConnectionType.MariaDB].includes(item.config.type)) {
                        try {
                            await provider.executeQuery(item.config.id, `USE \`${dbName}\``);
                        } catch (error) {
                            // Ignore if already using the database
                        }
                    }
                    
                    // Split by semicolon for multiple statements
                    const statements = script.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
                    const results = [];
                    let totalExecutionTime = 0;

                    for (const statement of statements) {
                        const trimmedStatement = statement.trim();
                        if (trimmedStatement) {
                            const { result, executionTime } = await executeQueryWithTiming(
                                () => provider.executeQuery!(item.config.id, trimmedStatement),
                                trimmedStatement
                            );
                            results.push(result);
                            totalExecutionTime += executionTime;
                            
                            // Log to history with database context
                            let queryToLog = trimmedStatement;
                            if (dbName) {
                                if ([ConnectionType.MySQL, ConnectionType.MariaDB].includes(item.config.type)) {
                                    queryToLog = `USE \`${dbName}\`;\n${trimmedStatement}`;
                                } else if (item.config.type === ConnectionType.PostgreSQL) {
                                    // PostgreSQL connects to a specific database, but we can add a comment for clarity
                                    queryToLog = `-- Database: ${dbName}\n${trimmedStatement}`;
                                }
                            }
                            await this.logQueryToHistory(item.config.id, queryToLog, executionTime, true);
                        }
                    }

                    const resultDoc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(results, null, 2),
                        language: 'json'
                    });
                    await vscode.window.showTextDocument(resultDoc, { viewColumn: vscode.ViewColumn.Beside });
                    
                    vscode.window.showInformationMessage(`SQL script executed successfully in ${formatExecutionTime(totalExecutionTime)}`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`SQL execution failed: ${error.message}`);
                }
            } else {
                continueExecuting = false;
            }
        }
    }

    // Cypher Script Execution
    async runCypherScript(item: ConnectionItem): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `// Cypher Script - Neo4j\n// Label: ${item.label}\n\n// Visualize graph with relationships:\nMATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50\n\n// Example queries:\n// MATCH (n:${item.label}) RETURN n LIMIT 10;\n// CREATE (n:${item.label} {name: 'Example'}) RETURN n;\n\n`,
            language: 'cypher'
        });

        const editor = await vscode.window.showTextDocument(doc);

        let continueExecuting = true;
        while (continueExecuting) {
            const executeButton = await vscode.window.showInformationMessage(
                'Write your Cypher script and click "Execute" to run it',
                'Execute',
                'Close'
            );

            if (executeButton === 'Execute') {
                const script = editor.document.getText();
                if (!script.trim()) {
                    vscode.window.showWarningMessage('Script is empty');
                    continue;
                }

                try {
                    const provider = await this.connectionManager.getProviderForConnection(item.config.id);
                    if (!provider || !provider.executeQuery) {
                        throw new Error('Provider not available');
                    }

                    // Clean script from comments and split by semicolon
                    const statements = script
                        .split('\n')
                        .filter(line => !line.trim().startsWith('//'))
                        .join('\n')
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

                    const results: any[] = [];
                    let totalExecutionTime = 0;
                    
                    for (const statement of statements) {
                        const { result, executionTime } = await executeQueryWithTiming(
                            () => provider.executeQuery!(item.config.id, statement),
                            statement
                        );
                        results.push(...result);
                        totalExecutionTime += executionTime;
                        
                        // Log to history
                        await this.logQueryToHistory(item.config.id, statement, executionTime, true);
                    }

                    // Show graph visualization for Neo4j
                    this.showNeo4jGraphVisualization(results);
                    
                    vscode.window.showInformationMessage(`Cypher script executed successfully (${statements.length} statement${statements.length > 1 ? 's' : ''}) in ${formatExecutionTime(totalExecutionTime)}`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Cypher execution failed: ${error.message}`);
                }
            } else {
                continueExecuting = false;
            }
        }
    }

    // Redis Command Execution
    async runRedisCommand(item: ConnectionItem): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `# Redis Commands\n# Key: ${item.label}\n\n# Example commands:\n# GET ${item.label}\n# SET mykey "myvalue"\n# HGETALL myhash\n\n`,
            language: 'redis'
        });

        const editor = await vscode.window.showTextDocument(doc);

        let continueExecuting = true;
        while (continueExecuting) {
            const executeButton = await vscode.window.showInformationMessage(
                'Write your Redis commands and click "Execute" to run them',
                'Execute',
                'Close'
            );

            if (executeButton === 'Execute') {
                const script = editor.document.getText();
                if (!script.trim()) {
                    vscode.window.showWarningMessage('Script is empty');
                    continue;
                }

                try {
                    const provider = await this.connectionManager.getProviderForConnection(item.config.id);
                    if (!provider || !provider.executeQuery) {
                        throw new Error('Provider not available');
                    }

                    // Clean and execute each command
                    const commands = script.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
                    const results = [];
                    let totalExecutionTime = 0;

                    for (const command of commands) {
                        const { result, executionTime } = await executeQueryWithTiming(
                            () => provider.executeQuery!(item.config.id, command.trim()),
                            command.trim()
                        );
                        totalExecutionTime += executionTime;
                        results.push(result);
                    }

                    const resultDoc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(results, null, 2),
                        language: 'json'
                    });
                    await vscode.window.showTextDocument(resultDoc, { viewColumn: vscode.ViewColumn.Beside });
                    
                    vscode.window.showInformationMessage(`Redis commands executed successfully in ${formatExecutionTime(totalExecutionTime)}`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Redis execution failed: ${error.message}`);
                }
            } else {
                continueExecuting = false;
            }
        }
    }

    public showNeo4jGraphVisualization(data: any[]): void {
        const panel = vscode.window.createWebviewPanel(
            'neo4jGraph',
            'Neo4j Graph Visualization',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        // Parse Neo4j result data to extract nodes and relationships
        const nodes: any[] = [];
        const edges: any[] = [];
        const nodeMap = new Map<string, any>();

        data.forEach((record: any) => {
            Object.values(record).forEach((value: any) => {
                if (value && typeof value === 'object') {
                    // Check if it's a node (has labels and properties)
                    if (value.labels && value.identity !== undefined) {
                        const nodeId = value.identity.toString();
                        if (!nodeMap.has(nodeId)) {
                            nodeMap.set(nodeId, true);
                            nodes.push({
                                id: nodeId,
                                label: value.labels.join(', ') + '\n' + Object.entries(value.properties || {})
                                    .slice(0, 2)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join('\n'),
                                title: JSON.stringify(value.properties, null, 2),
                                group: value.labels[0] || 'Node'
                            });
                        }
                    }
                    // Check if it's a relationship
                    if (value.type && value.start !== undefined && value.end !== undefined) {
                        edges.push({
                            from: value.start.toString(),
                            to: value.end.toString(),
                            label: value.type,
                            arrows: 'to'
                        });
                    }
                }
            });
        });

        panel.webview.html = this.getNeo4jGraphHTML(nodes, edges);
    }

    private getNeo4jGraphHTML(nodes: any[], edges: any[]): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neo4j Graph</title>
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif;
            background: #1e1e1e;
            color: #cccccc;
        }
        #graph { 
            width: 100%; 
            height: 100vh; 
            border: none;
        }
        .info {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(30, 30, 30, 0.9);
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #444;
        }
        .legend {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(30, 30, 30, 0.9);
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #444;
            max-width: 200px;
        }
        .legend-item {
            margin: 5px 0;
            display: flex;
            align-items: center;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 10px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="info">
        <strong>Neo4j Graph Visualization</strong><br>
        Nodes: ${nodes.length} | Relationships: ${edges.length}<br>
        <small>Click nodes to see details</small>
    </div>
    <div id="graph"></div>
    <script>
        const nodes = new vis.DataSet(${JSON.stringify(nodes)});
        const edges = new vis.DataSet(${JSON.stringify(edges)});

        const container = document.getElementById('graph');
        const data = { nodes, edges };
        const options = {
            nodes: {
                shape: 'dot',
                size: 20,
                font: {
                    size: 12,
                    color: '#ffffff'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                color: { 
                    color: '#848484',
                    highlight: '#4fc3f7'
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                },
                font: {
                    size: 11,
                    color: '#cccccc',
                    strokeWidth: 0
                },
                smooth: {
                    type: 'continuous'
                }
            },
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -30000,
                    springConstant: 0.04,
                    springLength: 150
                },
                stabilization: {
                    iterations: 200
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                zoomView: true,
                dragView: true
            },
            groups: {
                // Auto-generate colors for different node types
            }
        };

        const network = new vis.Network(container, data, options);

        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = nodes.get(nodeId);
                console.log('Clicked node:', node);
            }
        });

        // Auto-fit after stabilization
        network.once('stabilizationIterationsDone', function() {
            network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        });
    </script>
</body>
</html>`;
    }

    // SQL Insert Operation
    async insertRow(item: ConnectionItem): Promise<void> {
        const tableName = item.label || 'table';
        
        const columnsInput = await vscode.window.showInputBox({
            prompt: 'Column names (comma-separated)',
            placeHolder: 'name, age, email'
        });

        if (!columnsInput) {
            return;
        }

        const valuesInput = await vscode.window.showInputBox({
            prompt: 'Values (comma-separated, use quotes for strings)',
            placeHolder: "'John', 30, 'john@example.com'"
        });

        if (!valuesInput) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const query = `INSERT INTO ${tableName} (${columnsInput}) VALUES (${valuesInput})`;
            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, query),
                query
            );

            // Log to history
            await this.logQueryToHistory(item.config.id, query, executionTime, true);

            vscode.window.showInformationMessage(`Row inserted successfully in ${formatExecutionTime(executionTime)}: ${JSON.stringify(result)}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Insert failed: ${error.message}`);
        }
    }

    // SQL Update Operation
    async updateRow(item: ConnectionItem): Promise<void> {
        const tableName = item.label || 'table';
        
        const setClause = await vscode.window.showInputBox({
            prompt: 'SET clause (e.g., name = "John", age = 30)',
            placeHolder: 'column1 = value1, column2 = value2'
        });

        if (!setClause) {
            return;
        }

        const whereClause = await vscode.window.showInputBox({
            prompt: 'WHERE clause (e.g., id = 1)',
            placeHolder: 'id = 1'
        });

        if (!whereClause) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, query),
                query
            );

            // Log to history
            await this.logQueryToHistory(item.config.id, query, executionTime, true);

            vscode.window.showInformationMessage(`Rows updated successfully in ${formatExecutionTime(executionTime)}: ${JSON.stringify(result)}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Update failed: ${error.message}`);
        }
    }

    // SQL Delete Operation
    async deleteRow(item: ConnectionItem): Promise<void> {
        const tableName = item.label || 'table';
        
        const whereClause = await vscode.window.showInputBox({
            prompt: 'WHERE clause (e.g., id = 1)',
            placeHolder: 'id = 1'
        });

        if (!whereClause) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete rows from ${tableName} where ${whereClause}?`,
            'Yes',
            'No'
        );

        if (confirm !== 'Yes') {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, query),
                query
            );

            // Log to history
            await this.logQueryToHistory(item.config.id, query, executionTime, true);

            vscode.window.showInformationMessage(`Rows deleted successfully in ${formatExecutionTime(executionTime)}: ${JSON.stringify(result)}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Delete failed: ${error.message}`);
        }
    }

    // SFTP Directory Listing
    async listSFTPDirectory(item: ConnectionItem): Promise<void> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            // Use the item's path if it's a directory, otherwise ask for path
            let path = '/';
            if (item.contextValue === 'directory' && item.label) {
                path = item.label as string;
            } else {
                const inputPath = await vscode.window.showInputBox({
                    prompt: 'Enter directory path to list',
                    value: '/',
                    placeHolder: '/path/to/directory'
                });
                if (!inputPath) {
                    return;
                }
                path = inputPath;
            }

        const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, `list ${path}`),
                `list ${path}`
            );
            vscode.window.showInformationMessage(`Directory listed successfully in ${formatExecutionTime(executionTime)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`FTP operation failed: ${error.message}`);
        }
    }

    private showFileBrowser(files: any[], currentPath: string, item: ConnectionItem, protocol: string = 'FTP'): void {
        const panel = vscode.window.createWebviewPanel(
            'fileBrowser',
            `${protocol} Browser - ${currentPath}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        const fileRows = files.map(file => {
            const perms = typeof file.permissions === 'object' ? 
                JSON.stringify(file.permissions) : 
                (file.permissions || '-');
            return `
            <tr>
                <td><span class="icon">${file.type === 'directory' ? '📁' : '📄'}</span></td>
                <td>${file.name}</td>
                <td>${file.type}</td>
                <td>${file.size || '-'}</td>
                <td>${file.modified ? new Date(file.modified).toLocaleString() : '-'}</td>
                <td>${perms}</td>
            </tr>
        `;
        }).join('');

        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #cccccc;
        }
        .header {
            margin-bottom: 20px;
            padding: 15px;
            background: #252526;
            border-radius: 5px;
            border: 1px solid #3c3c3c;
        }
        .path {
            font-size: 16px;
            font-weight: bold;
            color: #4fc3f7;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #252526;
            border-radius: 5px;
            overflow: hidden;
        }
        th {
            background: #2d2d30;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #3c3c3c;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #3c3c3c;
        }
        tr:hover {
            background: #2a2d2e;
        }
        .icon {
            font-size: 20px;
        }
        .stats {
            margin-top: 15px;
            padding: 10px;
            background: #252526;
            border-radius: 5px;
            border: 1px solid #3c3c3c;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="path">📂 ${currentPath}</div>
        <div>Total items: ${files.length}</div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Icon</th>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
                <th>Permissions</th>
            </tr>
        </thead>
        <tbody>
            ${fileRows}
        </tbody>
    </table>
    
    <div class="stats">
        Directories: ${files.filter(f => f.type === 'directory').length} | 
        Files: ${files.filter(f => f.type === 'file').length}
    </div>
</body>
</html>`;
    }

    // FTP Upload
    async uploadFTPFile(item: ConnectionItem): Promise<void> {
        try {
            // Ask user to select local file
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select file to upload'
            });

            if (!files || files.length === 0) {
                return;
            }

            const localPath = files[0].fsPath;
            const fileName = localPath.split('/').pop() || 'file';
            
            // Get remote path - use current directory
            let remotePath = '/';
            if (item.contextValue === 'directory' && item.label) {
                remotePath = item.label as string;
            }
            
            // Ensure path starts with /
            if (!remotePath.startsWith('/')) {
                remotePath = '/' + remotePath;
            }
            
            // Ensure path ends with / for directory
            if (!remotePath.endsWith('/')) {
                remotePath += '/';
            }

            // Ask user to confirm or modify upload path
            const confirmedPath = await vscode.window.showInputBox({
                prompt: 'Confirm remote directory path (must have write permissions)',
                value: remotePath,
                placeHolder: '/path/to/directory/'
            });

            if (!confirmedPath) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const client = (provider as any).getConnection(item.config.id);
            if (client) {
                const finalPath = confirmedPath.endsWith('/') ? confirmedPath : confirmedPath + '/';
                const fullRemotePath = finalPath + fileName;
                
                // Try uploading directly without ensureDir to avoid permission issues
                await client.uploadFrom(localPath, fullRemotePath);
                vscode.window.showInformationMessage(`File uploaded successfully to: ${fullRemotePath}`);
                this.refresh();
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Upload failed: ${error.message}. Check if you have write permissions for this directory.`);
        }
    }

    // SFTP Upload
    async uploadSFTPFile(item: ConnectionItem): Promise<void> {
        try {
            // Ask user to select local file
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select file to upload'
            });

            if (!files || files.length === 0) {
                return;
            }

            const localPath = files[0].fsPath;
            const fileName = localPath.split('/').pop() || 'file';
            
            // Get remote path - use current directory
            let remotePath = '/';
            if (item.contextValue === 'directory' && item.label) {
                remotePath = item.label as string;
            }
            
            // Ensure path starts with /
            if (!remotePath.startsWith('/')) {
                remotePath = '/' + remotePath;
            }
            
            // Ensure path ends with / for directory
            if (!remotePath.endsWith('/')) {
                remotePath += '/';
            }

            // Ask user to confirm or modify upload path
            const confirmedPath = await vscode.window.showInputBox({
                prompt: 'Confirm remote directory path (must have write permissions)',
                value: remotePath,
                placeHolder: '/path/to/directory/'
            });

            if (!confirmedPath) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id) as any;
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const finalPath = confirmedPath.endsWith('/') ? confirmedPath : confirmedPath + '/';
            const fullRemotePath = finalPath + fileName;
            
            await provider.uploadFile(item.config.id, localPath, fullRemotePath);
            vscode.window.showInformationMessage(`File uploaded successfully to: ${fullRemotePath}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Upload failed: ${error.message}. Check if you have write permissions for this directory.`);
        }
    }

    // SFTP Upload Directory
    async uploadSFTPDirectory(item: ConnectionItem): Promise<void> {
        try {
            // Ask user to select local directory
            const folders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select directory to upload'
            });

            if (!folders || folders.length === 0) {
                return;
            }

            const localPath = folders[0].fsPath;
            const dirName = localPath.split('/').pop() || 'folder';
            
            // Get remote path - use current directory
            let remotePath = '/';
            if (item.contextValue === 'directory' && item.label) {
                remotePath = item.label as string;
            }
            
            // Ensure path starts with /
            if (!remotePath.startsWith('/')) {
                remotePath = '/' + remotePath;
            }
            
            // Ensure path ends with / for directory
            if (!remotePath.endsWith('/')) {
                remotePath += '/';
            }

            // Ask user to confirm or modify upload path
            const confirmedPath = await vscode.window.showInputBox({
                prompt: 'Confirm remote directory path (must have write permissions)',
                value: remotePath + dirName,
                placeHolder: '/path/to/directory'
            });

            if (!confirmedPath) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id) as any;
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            await provider.uploadDirectory(item.config.id, localPath, confirmedPath);
            vscode.window.showInformationMessage(`Directory uploaded successfully to: ${confirmedPath}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Upload failed: ${error.message}. Check if you have write permissions for this directory.`);
        }
    }

    // RabbitMQ Command
    async runRabbitMQCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter RabbitMQ command (e.g., "publish myqueue Hello World", "consume myqueue 10", "queues")',
                placeHolder: 'publish <queue> <message> | consume <queue> [count] | queues'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`RabbitMQ command failed: ${error.message}`);
        }
    }

    // BullMQ Command
    async runBullMQCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter BullMQ command (e.g., "queues", "add_job myqueue {\"data\":\"value\"}", "get_jobs myqueue waiting 10", "queue_counts myqueue")',
                placeHolder: 'queues | add_job <queue> <json> | get_jobs <queue> [status] [limit] | queue_counts <queue>'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`BullMQ command failed: ${error.message}`);
        }
    }

    // Kafka Command
    async runKafkaCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter Kafka command (e.g., "topics", "create_topic mytopic 3 1", "produce mytopic Hello", "describe_topic mytopic")',
                placeHolder: 'topics | create_topic <name> [partitions] [replication] | produce <topic> <message> | describe_topic <name>'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Kafka command failed: ${error.message}`);
        }
    }

    // SSH Command
    async runSSHCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter SSH command to execute',
                placeHolder: 'ls -la'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\nExit Code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`,
                language: 'shellscript'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`SSH command failed: ${error.message}`);
        }
    }

    // Docker Command
    async runDockerCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter Docker command (e.g., "containers", "images", "volumes", "networks", "inspect container <id>", "logs <container_id>")',
                placeHolder: 'containers | images | volumes | networks | inspect | logs | stats'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Docker command failed: ${error.message}`);
        }
    }

    // Elasticsearch Command
    async runElasticsearchCommand(item: ConnectionItem): Promise<void> {
        try {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter Elasticsearch command (e.g., "indices", "cluster", "search myindex", "index myindex {\\\"field\\\":\\\"value\\\"}")',
                placeHolder: 'indices | cluster | create_index | search | index | get | delete'
            });

            if (!command) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const { result, executionTime } = await executeQueryWithTiming(
                () => provider.executeQuery!(item.config.id, command),
                command
            );

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `Execution Time: ${formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Elasticsearch command failed: ${error.message}`);
        }
    }

    // SFTP Download
    async downloadSFTPFile(item: ConnectionItem): Promise<void> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id) as any;
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const remotePath = item.label as string;
            
            // Check if it's a directory
            if (item.contextValue === 'directory') {
                // Ask user to select local folder for directory download
                const destination = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select destination folder'
                });

                if (!destination || destination.length === 0) {
                    return;
                }

                const localPath = destination[0].fsPath;
                await provider.downloadDirectory(item.config.id, remotePath, localPath);
                vscode.window.showInformationMessage(`Directory downloaded successfully: ${remotePath}`);
            } else {
                // Download single file
                const fileName = remotePath.split('/').pop() || 'download';
                const destination = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(fileName),
                    saveLabel: 'Save file'
                });

                if (!destination) {
                    return;
                }

                await provider.downloadFile(item.config.id, remotePath, destination.fsPath);
                vscode.window.showInformationMessage(`File downloaded successfully: ${remotePath}`);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Download failed: ${error.message}`);
        }
    }

    // FTP Upload Directory
    async uploadFTPDirectory(item: ConnectionItem): Promise<void> {
        try {
            // Ask user to select local directory
            const folders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select directory to upload'
            });

            if (!folders || folders.length === 0) {
                return;
            }

            const localPath = folders[0].fsPath;
            const dirName = localPath.split('/').pop() || 'folder';
            
            // Get remote path - use current directory
            let remotePath = '/';
            if (item.contextValue === 'directory' && item.label) {
                remotePath = item.label as string;
            }
            
            // Ensure path starts with /
            if (!remotePath.startsWith('/')) {
                remotePath = '/' + remotePath;
            }
            
            // Ensure path ends with / for directory
            if (!remotePath.endsWith('/')) {
                remotePath += '/';
            }

            // Ask user to confirm or modify upload path
            const confirmedPath = await vscode.window.showInputBox({
                prompt: 'Confirm remote directory path (must have write permissions)',
                value: remotePath + dirName,
                placeHolder: '/path/to/directory'
            });

            if (!confirmedPath) {
                return;
            }

            const provider = await this.connectionManager.getProviderForConnection(item.config.id) as any;
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            await provider.uploadDirectory(item.config.id, localPath, confirmedPath);
            vscode.window.showInformationMessage(`Directory uploaded successfully to: ${confirmedPath}`);
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Upload failed: ${error.message}. Check if you have write permissions for this directory.`);
        }
    }

    // FTP Download
    async downloadFTPFile(item: ConnectionItem): Promise<void> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(item.config.id);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            const client = (provider as any).getConnection(item.config.id);
            if (!client) {
                throw new Error('No FTP connection');
            }

            const remotePath = item.label as string;
            
            // Check if it's a directory
            if (item.contextValue === 'directory') {
                // Ask user to select local folder for directory download
                const destination = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select destination folder'
                });

                if (!destination || destination.length === 0) {
                    return;
                }

                const localPath = destination[0].fsPath;
                await client.downloadToDir(localPath, remotePath);
                vscode.window.showInformationMessage(`Directory downloaded successfully: ${remotePath}`);
            } else {
                // Download single file
                const fileName = remotePath.split('/').pop() || 'download';
                const destination = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(fileName),
                    saveLabel: 'Save file'
                });

                if (!destination) {
                    return;
                }

                await client.downloadTo(destination.fsPath, remotePath);
                vscode.window.showInformationMessage(`File downloaded successfully: ${remotePath}`);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Download failed: ${error.message}`);
        }
    }

    private getDefaultPort(type: ConnectionType): number {
        const portMap: Record<ConnectionType, number> = {
            [ConnectionType.PostgreSQL]: 5432,
            [ConnectionType.MySQL]: 3306,
            [ConnectionType.SQLite]: 0,
            [ConnectionType.MongoDB]: 27017,
            [ConnectionType.Neo4J]: 7687,
            [ConnectionType.MariaDB]: 3306,
            [ConnectionType.Redis]: 6379,
            [ConnectionType.BullMQ]: 6379,
            [ConnectionType.Elasticsearch]: 9200,
            [ConnectionType.SSH]: 22,
            [ConnectionType.Docker]: 2375,
            [ConnectionType.FTP]: 21,
            [ConnectionType.SFTP]: 22,
            [ConnectionType.Kafka]: 9092,
            [ConnectionType.RabbitMQ]: 5672
        };

        return portMap[type] || 0;
    }

    // Export Connections
    async exportConnections(): Promise<void> {
        try {
            const connections = await this.connectionManager.getConnections();
            
            if (connections.length === 0) {
                vscode.window.showInformationMessage('No connections to export');
                return;
            }

            // Ask user whether to include passwords
            const includePasswords = await vscode.window.showQuickPick(
                ['Export without passwords (recommended)', 'Export with passwords (encrypted)'],
                { placeHolder: 'Choose export option' }
            );

            if (!includePasswords) {
                return;
            }

            const shouldIncludePasswords = includePasswords.includes('with passwords');

            // Prepare export data
            const exportData = [];
            
            for (const conn of connections) {
                const exported: any = {
                    id: conn.id,
                    name: conn.name,
                    type: conn.type,
                    host: conn.host,
                    port: conn.port,
                    database: conn.database,
                    username: conn.username
                };

                if (shouldIncludePasswords) {
                    // Get password from secret storage
                    const password = await this.connectionManager.getPassword(conn.id);
                    if (password) {
                        // Simple base64 encoding - not secure but better than plaintext
                        exported.password = Buffer.from(password).toString('base64');
                    }
                } else {
                    exported._passwordExcluded = true;
                }

                exportData.push(exported);
            }

            // Show save dialog
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('db-connections.json'),
                filters: { 'JSON': ['json'] }
            });

            if (!uri) {
                return;
            }

            // Write to file
            const fs = require('fs');
            fs.writeFileSync(uri.fsPath, JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                passwordsIncluded: shouldIncludePasswords,
                connections: exportData
            }, null, 2));

            vscode.window.showInformationMessage(`Exported ${connections.length} connection(s) to ${uri.fsPath}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Export failed: ${error.message}`);
        }
    }

    // Import Connections
    async importConnections(): Promise<void> {
        try {
            // Show open dialog
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                openLabel: 'Select connections file'
            });

            if (!uri || uri.length === 0) {
                return;
            }

            // Read file
            const fs = require('fs');
            const content = fs.readFileSync(uri[0].fsPath, 'utf-8');
            const importData = JSON.parse(content);

            if (!importData.connections || !Array.isArray(importData.connections)) {
                throw new Error('Invalid import file format');
            }

            const importedConnections = importData.connections;
            let importedCount = 0;
            let skippedCount = 0;
            const errors: string[] = [];

            // Import each connection
            for (const conn of importedConnections) {
                try {
                    // Check if connection with same name already exists
                    const existingConnections = await this.connectionManager.getConnections();
                    const exists = existingConnections.find(c => c.name === conn.name);

                    if (exists) {
                        const overwrite = await vscode.window.showQuickPick(
                            ['Skip', 'Overwrite'],
                            { placeHolder: `Connection "${conn.name}" already exists. What should I do?` }
                        );

                        if (overwrite !== 'Overwrite') {
                            skippedCount++;
                            continue;
                        }

                        // Delete existing connection
                        await this.connectionManager.deleteConnection(exists.id);
                    }

                    // Prepare connection config
                    const newConfig: any = {
                        id: conn.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: conn.name,
                        type: conn.type,
                        host: conn.host,
                        port: conn.port,
                        database: conn.database,
                        username: conn.username
                    };

                    // Handle password
                    let password = '';
                    if (importData.passwordsIncluded && conn.password) {
                        // Decode base64 password
                        password = Buffer.from(conn.password, 'base64').toString('utf-8');
                    } else if (conn._passwordExcluded) {
                        // Prompt for password
                        const enteredPassword = await vscode.window.showInputBox({
                            prompt: `Enter password for connection "${conn.name}"`,
                            password: true,
                            placeHolder: 'Leave empty to skip'
                        });
                        if (enteredPassword) {
                            password = enteredPassword;
                        }
                    }

                    // Save connection with credentials object
                    await this.connectionManager.addConnection(newConfig, { password });
                    importedCount++;
                } catch (error: any) {
                    errors.push(`${conn.name}: ${error.message}`);
                }
            }

            // Refresh the tree view
            this.refresh();

            // Show summary
            let message = `Imported ${importedCount} connection(s)`;
            if (skippedCount > 0) {
                message += `, skipped ${skippedCount}`;
            }
            if (errors.length > 0) {
                message += `\n\nErrors:\n${errors.join('\n')}`;
                vscode.window.showWarningMessage(message);
            } else {
                vscode.window.showInformationMessage(message);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Import failed: ${error.message}`);
        }
    }
}

export class ConnectionItem extends vscode.TreeItem {
    constructor(
        public readonly config: ConnectionConfig,
        public readonly isConnected: boolean,
        public readonly contextValue: string = 'connection',
        label?: string
    ) {
        super(
            label || config.name,
            ['collection', 'table', 'label', 'key', 'relationship', 'file'].includes(contextValue)
                ? vscode.TreeItemCollapsibleState.None 
                : vscode.TreeItemCollapsibleState.Collapsed
        );

        if (contextValue === 'connection') {
            this.tooltip = `${config.type} - ${config.host || config.database}`;
            this.description = isConnected ? '$(check) Connected' : '$(circle-slash) Disconnected';
            this.iconPath = new vscode.ThemeIcon(this.getIcon(config.type));
        } else if (contextValue === 'database') {
            this.tooltip = `Database: ${label}`;
            this.iconPath = new vscode.ThemeIcon('database');
        } else if (contextValue === 'collection') {
            this.tooltip = `Collection: ${label}`;
            this.iconPath = new vscode.ThemeIcon('symbol-field');
            this.command = {
                command: 'dbServices.queryCollection',
                title: 'Query Collection',
                arguments: [this]
            };
        } else if (contextValue === 'table') {
            this.tooltip = `Table: ${label}`;
            this.iconPath = new vscode.ThemeIcon('table');
        } else if (contextValue === 'label') {
            this.tooltip = `Node Label: ${label}`;
            this.iconPath = new vscode.ThemeIcon('symbol-class');
        } else if (contextValue === 'relationship') {
            this.tooltip = `Relationship: ${label}`;
            this.iconPath = new vscode.ThemeIcon('arrow-right');
        } else if (contextValue === 'key') {
            this.tooltip = `Key: ${label}`;
            this.iconPath = new vscode.ThemeIcon('key');
        } else if (contextValue === 'directory') {
            this.tooltip = `Directory: ${label}`;
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (contextValue === 'file') {
            this.tooltip = `File: ${label}`;
            this.iconPath = new vscode.ThemeIcon('file');
        } else if (contextValue === 'queue') {
            this.tooltip = `Queue: ${label}`;
            this.iconPath = new vscode.ThemeIcon('inbox');
        } else if (contextValue === 'exchange') {
            this.tooltip = `Exchange: ${label}`;
            this.iconPath = new vscode.ThemeIcon('arrow-swap');
        } else if (contextValue === 'topic') {
            this.tooltip = `Topic: ${label}`;
            this.iconPath = new vscode.ThemeIcon('rss');
        } else if (contextValue === 'container') {
            this.tooltip = `Container: ${label}`;
            this.iconPath = new vscode.ThemeIcon('package');
        } else if (contextValue === 'image') {
            this.tooltip = `Image: ${label}`;
            this.iconPath = new vscode.ThemeIcon('file-media');
        } else if (contextValue === 'volume') {
            this.tooltip = `Volume: ${label}`;
            this.iconPath = new vscode.ThemeIcon('database');
        } else if (contextValue === 'network') {
            this.tooltip = `Network: ${label}`;
            this.iconPath = new vscode.ThemeIcon('globe');
        } else if (contextValue === 'index') {
            this.tooltip = `Index: ${label}`;
            this.iconPath = new vscode.ThemeIcon('symbol-array');
        } else if (contextValue && contextValue.startsWith('category-')) {
            this.tooltip = `Category: ${label}`;
            this.iconPath = new vscode.ThemeIcon('folder');
            // Add command button for categories to execute commands
            const providerType = contextValue.replace('category-', '');
            const commandMap: Record<string, string> = {
                'rabbitmq': 'dbServices.runRabbitMQCommand',
                'bullmq': 'dbServices.runBullMQCommand',
                'kafka': 'dbServices.runKafkaCommand',
                'ssh': 'dbServices.runSSHCommand',
                'docker': 'dbServices.runDockerCommand',
                'elasticsearch': 'dbServices.runElasticsearchCommand'
            };
            if (commandMap[providerType]) {
                this.command = {
                    command: commandMap[providerType],
                    title: 'Execute Command',
                    arguments: [this]
                };
            }
        }

        this.contextValue = contextValue;
    }

    private getIcon(type: ConnectionType): string {
        const iconMap: Record<ConnectionType, string> = {
            [ConnectionType.PostgreSQL]: 'database',
            [ConnectionType.MySQL]: 'database',
            [ConnectionType.SQLite]: 'database',
            [ConnectionType.MongoDB]: 'database',
            [ConnectionType.Neo4J]: 'database',
            [ConnectionType.MariaDB]: 'database',
            [ConnectionType.Redis]: 'circuit-board',
            [ConnectionType.BullMQ]: 'server',
            [ConnectionType.Elasticsearch]: 'search',
            [ConnectionType.SSH]: 'terminal',
            [ConnectionType.Docker]: 'package',
            [ConnectionType.FTP]: 'cloud-upload',
            [ConnectionType.SFTP]: 'file-symlink-directory',
            [ConnectionType.Kafka]: 'broadcast',
            [ConnectionType.RabbitMQ]: 'inbox'
        };

        return iconMap[type] || 'plug';
    }
}
