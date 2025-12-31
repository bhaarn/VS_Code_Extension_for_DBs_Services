import * as vscode from 'vscode';
import { SavedQuery, SavedQueryFolder, ConnectionType } from '../core/types';
import { ConnectionManager } from '../core/connectionManager';

export class SavedQueries implements vscode.TreeDataProvider<SavedQueryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SavedQueryItem | undefined | null | void> = new vscode.EventEmitter<SavedQueryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SavedQueryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private context: vscode.ExtensionContext,
        private connectionManager: ConnectionManager,
        private connectionExplorer?: any
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SavedQueryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SavedQueryItem): Promise<SavedQueryItem[]> {
        if (!element) {
            // Root level - show folders and queries without folders
            const queries = await this.getSavedQueries();
            const folders = await this.getFolders();
            
            const rootFolders = folders.filter(f => !f.parentId);
            const rootQueries = queries.filter(q => !q.folderId);
            
            const items: SavedQueryItem[] = [
                ...rootFolders.map(f => new SavedQueryItem(undefined, f)),
                ...rootQueries.map(q => new SavedQueryItem(q, undefined))
            ];
            
            return items;
        } else if (element.folder) {
            // Show queries in this folder
            const queries = await this.getSavedQueries();
            const folders = await this.getFolders();
            
            const childFolders = folders.filter(f => f.parentId === element.folder!.id);
            const folderQueries = queries.filter(q => q.folderId === element.folder!.id);
            
            return [
                ...childFolders.map(f => new SavedQueryItem(undefined, f)),
                ...folderQueries.map(q => new SavedQueryItem(q, undefined))
            ];
        }
        
        return [];
    }

    /**
     * Save a new query
     */
    async saveQuery(query?: string, connectionId?: string): Promise<void> {
        // Get query text
        let queryText = query;
        if (!queryText) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                queryText = editor.document.getText(selection.isEmpty ? undefined : selection);
            }
        }

        if (!queryText || !queryText.trim()) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter query text',
                placeHolder: 'SELECT * FROM users WHERE...',
                validateInput: (value) => value.trim() ? null : 'Query cannot be empty'
            });
            if (!input) {return;}
            queryText = input;
        }

        // Get query name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this query',
            placeHolder: 'Get active users',
            validateInput: (value) => value.trim() ? null : 'Name cannot be empty'
        });

        if (!name) {
            return;
        }

        // Get optional description
        const description = await vscode.window.showInputBox({
            prompt: 'Enter a description (optional)',
            placeHolder: 'Retrieves all active users from the database'
        });

        // Select folder (optional)
        const folders = await this.getFolders();
        const folderItems = ['(No folder)', ...folders.map(f => f.name)];
        const selectedFolder = await vscode.window.showQuickPick(folderItems, {
            placeHolder: 'Select a folder (optional)'
        });

        let folderId: string | undefined;
        if (selectedFolder && selectedFolder !== '(No folder)') {
            const folder = folders.find(f => f.name === selectedFolder);
            folderId = folder?.id;
        }

        // Select connection type (optional)
        let selectedConnectionId = connectionId;
        let connectionType: ConnectionType | undefined;
        
        if (!selectedConnectionId) {
            const connections = await this.connectionManager.getConnections();
            if (connections.length > 0) {
                const connectionItems = ['(Any connection)', ...connections.map(c => c.name)];
                const selectedConnection = await vscode.window.showQuickPick(connectionItems, {
                    placeHolder: 'Select a connection (optional)'
                });

                if (selectedConnection && selectedConnection !== '(Any connection)') {
                    const conn = connections.find(c => c.name === selectedConnection);
                    if (conn) {
                        selectedConnectionId = conn.id;
                        connectionType = conn.type;
                    }
                }
            }
        }

        // Prepare query with database context if needed
        let queryToSave = queryText.trim();
        if (selectedConnectionId && connectionType) {
            const { ConnectionType } = require('../core/types');
            const connections = await this.connectionManager.getConnections();
            const connection = connections.find(c => c.id === selectedConnectionId);
            
            if (connection) {
                let database = connection.database;
                
                // For MySQL/MariaDB/PostgreSQL, we need database context
                if ([ConnectionType.MySQL, ConnectionType.MariaDB, ConnectionType.PostgreSQL].includes(connectionType)) {
                    // Check if query already has USE/SET statement
                    const hasUseStatement = /^USE\s+/i.test(queryText) || /^SET\s+search_path/i.test(queryText) || /^--\s*Database:/i.test(queryText);
                    
                    if (!hasUseStatement) {
                        // If no database in connection config, prompt for it
                        if (!database) {
                            database = await vscode.window.showInputBox({
                                prompt: 'Enter database name (required for MySQL/MariaDB/PostgreSQL)',
                                placeHolder: 'mydb',
                                validateInput: (value) => value.trim() ? null : 'Database name is required'
                            });
                            
                            if (!database) {
                                vscode.window.showWarningMessage('Query saved without database context. It may fail when executed.');
                            }
                        }
                        
                        // Add database context to query
                        if (database) {
                            if ([ConnectionType.MySQL, ConnectionType.MariaDB].includes(connectionType)) {
                                queryToSave = `USE \`${database}\`;\n${queryText.trim()}`;
                            } else if (connectionType === ConnectionType.PostgreSQL) {
                                queryToSave = `-- Database: ${database}\n${queryText.trim()}`;
                            }
                        }
                    }
                }
                // Handle MongoDB - add database comment if not already present
                else if (connectionType === ConnectionType.MongoDB && database) {
                    const hasDatabaseComment = /^\/\/\s*Database:/i.test(queryText);
                    if (!hasDatabaseComment) {
                        queryToSave = `// Database: ${database}\n${queryText.trim()}`;
                    }
                }
                // Neo4J doesn't need database context in queries - handled by connection
            }
        }

        // Save query
        const queries = await this.getSavedQueries();
        const newQuery: SavedQuery = {
            id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            description: description || undefined,
            query: queryToSave,
            connectionId: selectedConnectionId,
            connectionType,
            folderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        queries.push(newQuery);
        await this.context.workspaceState.update('savedQueries', queries);
        this.refresh();

        vscode.window.showInformationMessage(`Query "${name}" saved successfully`);
    }

    /**
     * Create a new folder
     */
    async createFolder(parentId?: string): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'SQL Scripts',
            validateInput: (value) => value.trim() ? null : 'Folder name cannot be empty'
        });

        if (!name) {
            return;
        }

        const folders = await this.getFolders();
        const newFolder: SavedQueryFolder = {
            id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            parentId,
            createdAt: new Date().toISOString()
        };

        folders.push(newFolder);
        await this.context.workspaceState.update('queryFolders', folders);
        this.refresh();

        vscode.window.showInformationMessage(`Folder "${name}" created successfully`);
    }

    /**
     * Execute a saved query
     */
    async executeQuery(item: SavedQueryItem): Promise<void> {
        if (!item.query) {
            return;
        }

        try {
            // Select connection if not specified
            let connectionId = item.query.connectionId;
            if (!connectionId) {
                const connections = await this.connectionManager.getConnections();
                const connectionItems = connections.map(c => ({
                    label: c.name,
                    description: `${c.type} - ${c.host}:${c.port}`,
                    id: c.id
                }));

                const selected = await vscode.window.showQuickPick(connectionItems, {
                    placeHolder: 'Select a connection to execute this query'
                });

                if (!selected) {
                    return;
                }
                connectionId = selected.id;
            }

            const provider = await this.connectionManager.getProviderForConnection(connectionId);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available');
            }

            // For MySQL/MariaDB, check if query starts with USE statement and execute it separately
            let queryToExecute = item.query.query;
            const useMatch = queryToExecute.match(/^USE\s+`([^`]+)`;\s*\n/i);
            if (useMatch) {
                // Execute USE statement first
                try {
                    await provider.executeQuery(connectionId, useMatch[0].trim());
                } catch (error) {
                    // Ignore if database is already selected
                }
                // Remove USE statement from the query
                queryToExecute = queryToExecute.substring(useMatch[0].length);
            }

            // Get connection to check type for result handling
            const allConnections = await this.connectionManager.getConnections();
            const currentConnection = allConnections.find(c => c.id === connectionId);
            const { ConnectionType } = require('../core/types');

            // For SQL databases, split by semicolon to handle multiple statements
            let result: any;
            let executionTime = 0;
            const overallStartTime = Date.now();
            
            if (currentConnection && [ConnectionType.MySQL, ConnectionType.MariaDB, ConnectionType.PostgreSQL, ConnectionType.SQLite].includes(currentConnection.type)) {
                // Split by semicolon for multiple statements
                const statements = queryToExecute.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
                const results = [];

                for (const statement of statements) {
                    const trimmedStatement = statement.trim();
                    if (trimmedStatement) {
                        const statementResult = await provider.executeQuery(connectionId, trimmedStatement);
                        results.push(statementResult);
                    }
                }
                
                executionTime = Date.now() - overallStartTime;
                // Use the last result (typically the SELECT result)
                result = results.length > 0 ? results[results.length - 1] : null;
            } else {
                // For non-SQL databases, execute as-is
                result = await provider.executeQuery(connectionId, queryToExecute);
                executionTime = Date.now() - overallStartTime;
            }

            // Show results based on connection type
            if (currentConnection && currentConnection.type === ConnectionType.Neo4J && this.connectionExplorer) {
                // Show Neo4J graph visualization
                this.connectionExplorer.showNeo4jGraphVisualization(Array.isArray(result) ? result : [result]);
                vscode.window.showInformationMessage(`Query executed successfully in ${this.formatExecutionTime(executionTime)}`);
            } else {
                // Show results in JSON document
                const doc = await vscode.workspace.openTextDocument({
                    content: `-- Saved Query: ${item.query.name}\n-- Execution time: ${this.formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Query executed successfully in ${this.formatExecutionTime(executionTime)}`);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to execute query: ${error.message}`);
        }
    }

    /**
     * Edit a saved query
     */
    async editQuery(item: SavedQueryItem): Promise<void> {
        if (!item.query) {
            return;
        }

        const queries = await this.getSavedQueries();
        const query = queries.find(q => q.id === item.query!.id);
        if (!query) {
            return;
        }

        // Open in editor
        const doc = await vscode.workspace.openTextDocument({
            content: query.query,
            language: 'sql'
        });
        const editor = await vscode.window.showTextDocument(doc);

        // Wait for user to finish editing
        const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc === doc) {
                query.query = savedDoc.getText();
                query.updatedAt = new Date().toISOString();
                await this.context.workspaceState.update('savedQueries', queries);
                this.refresh();
                vscode.window.showInformationMessage(`Query "${query.name}" updated successfully`);
                disposable.dispose();
            }
        });
    }

    /**
     * Delete a saved query
     */
    async deleteQuery(item: SavedQueryItem): Promise<void> {
        if (!item.query) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${item.query.name}"?`,
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            return;
        }

        const queries = await this.getSavedQueries();
        const index = queries.findIndex(q => q.id === item.query!.id);
        if (index >= 0) {
            queries.splice(index, 1);
            await this.context.workspaceState.update('savedQueries', queries);
            this.refresh();
            vscode.window.showInformationMessage(`Query "${item.query.name}" deleted`);
        }
    }

    /**
     * Rename a saved query
     */
    async renameQuery(item: SavedQueryItem): Promise<void> {
        if (!item.query) {
            return;
        }

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: item.query.name,
            validateInput: (value) => value.trim() ? null : 'Name cannot be empty'
        });

        if (!newName || newName === item.query.name) {
            return;
        }

        const queries = await this.getSavedQueries();
        const query = queries.find(q => q.id === item.query!.id);
        if (query) {
            query.name = newName;
            query.updatedAt = new Date().toISOString();
            await this.context.workspaceState.update('savedQueries', queries);
            this.refresh();
            vscode.window.showInformationMessage(`Query renamed to "${newName}"`);
        }
    }

    /**
     * Copy query to clipboard
     */
    async copyQuery(item: SavedQueryItem): Promise<void> {
        if (!item.query) {
            return;
        }

        await vscode.env.clipboard.writeText(item.query.query);
        vscode.window.showInformationMessage('Query copied to clipboard');
    }

    /**
     * Delete a folder
     */
    async deleteFolder(item: SavedQueryItem): Promise<void> {
        if (!item.folder) {
            return;
        }

        // Check if folder has queries
        const queries = await this.getSavedQueries();
        const folderQueries = queries.filter(q => q.folderId === item.folder!.id);

        if (folderQueries.length > 0) {
            const confirm = await vscode.window.showWarningMessage(
                `Folder "${item.folder.name}" contains ${folderQueries.length} queries. What would you like to do?`,
                'Delete All',
                'Move to Root',
                'Cancel'
            );

            if (confirm === 'Cancel' || !confirm) {
                return;
            }

            if (confirm === 'Move to Root') {
                // Move queries to root
                folderQueries.forEach(q => q.folderId = undefined);
                await this.context.workspaceState.update('savedQueries', queries);
            } else if (confirm === 'Delete All') {
                // Delete all queries in the folder
                const remainingQueries = queries.filter(q => q.folderId !== item.folder!.id);
                await this.context.workspaceState.update('savedQueries', remainingQueries);
            }
        }

        const folders = await this.getFolders();
        const index = folders.findIndex(f => f.id === item.folder!.id);
        if (index >= 0) {
            folders.splice(index, 1);
            await this.context.workspaceState.update('queryFolders', folders);
            this.refresh();
            vscode.window.showInformationMessage(`Folder "${item.folder.name}" deleted`);
        }
    }

    /**
     * Get all saved queries
     */
    async getSavedQueries(): Promise<SavedQuery[]> {
        return this.context.workspaceState.get<SavedQuery[]>('savedQueries', []);
    }

    /**
     * Get all folders
     */
    async getFolders(): Promise<SavedQueryFolder[]> {
        return this.context.workspaceState.get<SavedQueryFolder[]>('queryFolders', []);
    }

    private formatExecutionTime(ms: number): string {
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
}

export class SavedQueryItem extends vscode.TreeItem {
    public readonly query?: SavedQuery;
    public readonly folder?: SavedQueryFolder;

    constructor(query?: SavedQuery, folder?: SavedQueryFolder) {
        // Call super first
        if (query) {
            super(query.name, vscode.TreeItemCollapsibleState.None);
        } else if (folder) {
            super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);
        } else {
            super('Unknown', vscode.TreeItemCollapsibleState.None);
        }

        // Then assign properties
        this.query = query;
        this.folder = folder;
        
        if (query) {
            this.description = query.description || '';
            this.tooltip = new vscode.MarkdownString();
            this.tooltip.appendMarkdown(`**${query.name}**\n\n`);
            if (query.description) {
                this.tooltip.appendMarkdown(`${query.description}\n\n`);
            }
            this.tooltip.appendMarkdown(`**Created:** ${new Date(query.createdAt).toLocaleString()}\n\n`);
            this.tooltip.appendMarkdown(`**Query:**\n\`\`\`sql\n${query.query}\n\`\`\``);
            
            this.contextValue = 'savedQuery';
            this.iconPath = new vscode.ThemeIcon('file-code');
            
            this.command = {
                command: 'dbServices.executeSavedQuery',
                title: 'Execute Query',
                arguments: [this]
            };
        } else if (folder) {
            this.tooltip = `Folder: ${folder.name}\nCreated: ${new Date(folder.createdAt).toLocaleString()}`;
            this.contextValue = 'queryFolder';
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
