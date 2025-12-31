import * as vscode from 'vscode';
import { QueryHistoryEntry } from '../core/types';
import { ConnectionManager } from '../core/connectionManager';

const MAX_HISTORY_SIZE = 100;

export class QueryHistory implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | null | void> = new vscode.EventEmitter<HistoryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private context: vscode.ExtensionContext,
        private connectionManager: ConnectionManager,
        private connectionExplorer?: any
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
        if (element) {
            return [];
        }

        // Root level - show query history
        const history = await this.getHistory();
        return history.map(entry => new HistoryItem(entry));
    }

    /**
     * Add a query to history
     */
    async addToHistory(
        connectionId: string,
        connectionName: string,
        query: string,
        executionTime?: number,
        success: boolean = true,
        error?: string
    ): Promise<void> {
        const history = await this.getHistory();
        
        const entry: QueryHistoryEntry = {
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            connectionId,
            connectionName,
            query: query.trim(),
            timestamp: new Date().toISOString(),
            executionTime,
            success,
            error
        };

        // Add to beginning of array
        history.unshift(entry);

        // Keep only last 100 queries
        if (history.length > MAX_HISTORY_SIZE) {
            history.splice(MAX_HISTORY_SIZE);
        }

        await this.context.workspaceState.update('queryHistory', history);
        this.refresh();
    }

    /**
     * Get query history
     */
    async getHistory(): Promise<QueryHistoryEntry[]> {
        return this.context.workspaceState.get<QueryHistoryEntry[]>('queryHistory', []);
    }

    /**
     * Clear all history
     */
    async clearHistory(): Promise<void> {
        await this.context.workspaceState.update('queryHistory', []);
        this.refresh();
        vscode.window.showInformationMessage('Query history cleared');
    }

    /**
     * Delete a single query from history
     */
    async deleteQuery(item: HistoryItem): Promise<void> {
        const history = await this.getHistory();
        const index = history.findIndex(h => h.id === item.entry.id);
        if (index >= 0) {
            history.splice(index, 1);
            await this.context.workspaceState.update('queryHistory', history);
            this.refresh();
            vscode.window.showInformationMessage('Query deleted from history');
        }
    }

    /**
     * Re-run a query from history
     */
    async rerunQuery(item: HistoryItem): Promise<void> {
        try {
            const provider = await this.connectionManager.getProviderForConnection(item.entry.connectionId);
            if (!provider || !provider.executeQuery) {
                throw new Error('Provider not available or connection no longer exists');
            }

            // For MySQL/MariaDB, check if query starts with USE statement and execute it separately
            let queryToExecute = item.entry.query;
            const useMatch = queryToExecute.match(/^USE\s+`([^`]+)`;\s*\n/i);
            if (useMatch) {
                // Execute USE statement first
                try {
                    await provider.executeQuery(item.entry.connectionId, useMatch[0].trim());
                } catch (error) {
                    // Ignore if database is already selected
                }
                // Remove USE statement from the query
                queryToExecute = queryToExecute.substring(useMatch[0].length);
            }

            const startTime = Date.now();
            const result = await provider.executeQuery(item.entry.connectionId, queryToExecute);
            const executionTime = Date.now() - startTime;

            // Get connection to check type
            const connections = await this.connectionManager.getConnections();
            const connection = connections.find(c => c.id === item.entry.connectionId);
            const { ConnectionType } = require('../core/types');

            // Show results based on connection type
            if (connection && connection.type === ConnectionType.Neo4J && this.connectionExplorer) {
                // Show Neo4J graph visualization
                this.connectionExplorer.showNeo4jGraphVisualization(Array.isArray(result) ? result : [result]);
                vscode.window.showInformationMessage(`Query re-run successfully in ${this.formatExecutionTime(executionTime)}`);
            } else {
                // Show results in JSON document
                const doc = await vscode.workspace.openTextDocument({
                    content: `-- Re-run from history\n-- Original execution: ${new Date(item.entry.timestamp).toLocaleString()}\n-- Current execution time: ${this.formatExecutionTime(executionTime)}\n\n${JSON.stringify(result, null, 2)}`,
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Query re-run successfully in ${this.formatExecutionTime(executionTime)}`);
            }
            await this.addToHistory(
                item.entry.connectionId,
                item.entry.connectionName,
                item.entry.query,
                executionTime,
                true
            );

            vscode.window.showInformationMessage(`Query re-run successfully in ${this.formatExecutionTime(executionTime)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to re-run query: ${error.message}`);
            
            // Add failed attempt to history
            await this.addToHistory(
                item.entry.connectionId,
                item.entry.connectionName,
                item.entry.query,
                undefined,
                false,
                error.message
            );
        }
    }

    /**
     * Copy query to clipboard
     */
    async copyQuery(item: HistoryItem): Promise<void> {
        await vscode.env.clipboard.writeText(item.entry.query);
        vscode.window.showInformationMessage('Query copied to clipboard');
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

export class HistoryItem extends vscode.TreeItem {
    constructor(public readonly entry: QueryHistoryEntry) {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString();
        const dateStr = date.toLocaleDateString();
        
        // Truncate query for display
        const queryPreview = entry.query.length > 50 
            ? entry.query.substring(0, 50) + '...' 
            : entry.query;

        super(queryPreview, vscode.TreeItemCollapsibleState.None);

        this.description = `${entry.connectionName} - ${timeStr}`;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**Connection:** ${entry.connectionName}\n\n`);
        this.tooltip.appendMarkdown(`**Timestamp:** ${dateStr} ${timeStr}\n\n`);
        if (entry.executionTime) {
            this.tooltip.appendMarkdown(`**Execution Time:** ${this.formatExecutionTime(entry.executionTime)}\n\n`);
        }
        this.tooltip.appendMarkdown(`**Status:** ${entry.success ? '✓ Success' : '✗ Failed'}\n\n`);
        if (entry.error) {
            this.tooltip.appendMarkdown(`**Error:** ${entry.error}\n\n`);
        }
        this.tooltip.appendMarkdown(`**Query:**\n\`\`\`sql\n${entry.query}\n\`\`\``);

        this.contextValue = 'historyItem';
        this.iconPath = new vscode.ThemeIcon(
            entry.success ? 'history' : 'error',
            entry.success ? undefined : new vscode.ThemeColor('errorForeground')
        );
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
