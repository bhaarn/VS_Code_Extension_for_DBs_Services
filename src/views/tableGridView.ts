import * as vscode from 'vscode';
import { ConnectionManager } from '../core/connectionManager';
import { ConnectionConfig, ConnectionType } from '../core/types';

interface TableData {
    columns: string[];
    rows: any[][];
    totalRows: number;
    page: number;
    pageSize: number;
}

interface EditOperation {
    type: 'insert' | 'update' | 'delete';
    rowIndex?: number;
    data?: any;
}

/**
 * Table Data Grid View
 * Provides a spreadsheet-like interface for viewing and editing table data
 */
export class TableGridView {
    private panel: vscode.WebviewPanel | undefined;
    private connectionManager: ConnectionManager;
    private currentConnection: ConnectionConfig | undefined;
    private currentTable: string | undefined;
    private currentDatabase: string | undefined;
    private currentPage: number = 1;
    private pageSize: number = 50;

    constructor(connectionManager: ConnectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * Show table data in grid view
     */
    async showTable(connectionId: string, tableName: string, database?: string): Promise<void> {
        const connection = this.connectionManager.getConnection(connectionId);
        if (!connection) {
            vscode.window.showErrorMessage('Connection not found');
            return;
        }

        this.currentConnection = connection;
        this.currentTable = tableName;
        this.currentDatabase = database;
        this.currentPage = 1;

        // Create or show panel
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'tableGridView',
                `Table: ${tableName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleMessage(message);
            });
        }

        // Load and display data
        await this.loadTableData();
    }

    /**
     * Load table data from database
     */
    private async loadTableData(): Promise<void> {
        if (!this.panel || !this.currentConnection || !this.currentTable) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(this.currentConnection.id);
            if (!provider) {
                throw new Error('Provider not available');
            }

            const offset = (this.currentPage - 1) * this.pageSize;
            let query = '';
            let countQuery = '';

            // Build queries based on connection type
            switch (this.currentConnection.type) {
                case ConnectionType.PostgreSQL:
                case ConnectionType.MySQL:
                case ConnectionType.MariaDB:
                    const tableName = this.currentDatabase ? `${this.currentDatabase}.${this.currentTable}` : this.currentTable;
                    query = `SELECT * FROM ${tableName} LIMIT ${this.pageSize} OFFSET ${offset}`;
                    countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
                    break;
                
                case ConnectionType.SQLite:
                    query = `SELECT * FROM ${this.currentTable} LIMIT ${this.pageSize} OFFSET ${offset}`;
                    countQuery = `SELECT COUNT(*) as count FROM ${this.currentTable}`;
                    break;

                case ConnectionType.MongoDB:
                    // MongoDB queries must match provider's supported format
                    query = `db.${this.currentTable}.find({})`;
                    countQuery = `db.${this.currentTable}.countDocuments({})`;
                    break;

                default:
                    throw new Error(`Table grid view not supported for ${this.currentConnection.type}`);
            }

            // Get total count and data
            if (!provider.executeQuery) {
                throw new Error('Provider does not support query execution');
            }
            
            let totalRows = 0;
            let result: any;
            
            if (this.currentConnection.type === ConnectionType.MongoDB) {
                // For MongoDB, execute count query
                const countResult: any = await provider.executeQuery(this.currentConnection.id, countQuery);
                totalRows = countResult?.count || 0;
                
                // Execute find query - provider returns limited results
                result = await provider.executeQuery(this.currentConnection.id, query);
            } else {
                // SQL databases
                const countResult: any = await provider.executeQuery(this.currentConnection.id, countQuery);
                if (Array.isArray(countResult) && countResult.length > 0) {
                    totalRows = countResult[0].count || countResult[0].COUNT || 0;
                }
                result = await provider.executeQuery(this.currentConnection.id, query);
            }
            
            let tableData: TableData;
            if (this.currentConnection.type === ConnectionType.MongoDB) {
                // MongoDB returns array of documents
                const rows = Array.isArray(result) ? result : [];
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                const rowsArray = rows.map(row => columns.map(col => row[col]));
                
                tableData = {
                    columns,
                    rows: rowsArray,
                    totalRows,
                    page: this.currentPage,
                    pageSize: this.pageSize
                };
            } else {
                // SQL databases
                const rows = Array.isArray(result) ? result : [];
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                const rowsArray = rows.map(row => columns.map(col => row[col]));
                
                tableData = {
                    columns,
                    rows: rowsArray,
                    totalRows,
                    page: this.currentPage,
                    pageSize: this.pageSize
                };
            }

            // Update webview
            this.panel.webview.html = this.getHtmlContent(tableData);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load table data: ${error.message}`);
        }
    }

    /**
     * Handle messages from webview
     */
    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'nextPage':
                this.currentPage++;
                await this.loadTableData();
                break;

            case 'prevPage':
                if (this.currentPage > 1) {
                    this.currentPage--;
                    await this.loadTableData();
                }
                break;

            case 'gotoPage':
                this.currentPage = Math.max(1, parseInt(message.page) || 1);
                await this.loadTableData();
                break;

            case 'updateCell':
                await this.updateCell(message.rowIndex, message.columnName, message.value);
                break;

            case 'insertRow':
                await this.insertRowWithPrompt();
                break;

            case 'deleteRow':
                await this.deleteRow(message.rowIndex);
                break;

            case 'refresh':
                await this.loadTableData();
                break;
        }
    }

    /**
     * Update single cell
     */
    private async updateCell(rowIndex: number, columnName: string, value: any): Promise<void> {
        if (!this.currentConnection || !this.currentTable) {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(this.currentConnection.id);
            if (!provider) {
                throw new Error('Provider not available');
            }

            if (!provider.executeQuery) {
                throw new Error('Provider does not support query execution');
            }

            // Build UPDATE query based on database type
            let query = '';
            const actualRowIndex = (this.currentPage - 1) * this.pageSize + rowIndex;

            switch (this.currentConnection.type) {
                case ConnectionType.PostgreSQL:
                case ConnectionType.MySQL:
                case ConnectionType.MariaDB:
                case ConnectionType.SQLite:
                    // For SQL, we need the primary key - this is simplified
                    // In production, you'd need to track PKs properly
                    const tableName = (this.currentDatabase && this.currentConnection.type !== ConnectionType.SQLite) 
                        ? `${this.currentDatabase}.${this.currentTable}` 
                        : this.currentTable;
                    const whereClause = this.currentConnection.type === ConnectionType.SQLite 
                        ? `WHERE rowid = ${actualRowIndex + 1}`
                        : `LIMIT 1`; // This is a simplified approach
                    query = `UPDATE ${tableName} SET ${columnName} = '${value}' ${whereClause}`;
                    break;

                case ConnectionType.MongoDB:
                    // MongoDB update by _id (simplified - in production track actual _id)
                    query = `db.${this.currentTable}.updateOne({}, { $set: { ${columnName}: '${value}' } })`;
                    break;

                default:
                    throw new Error(`Update not supported for ${this.currentConnection.type}`);
            }

            await provider.executeQuery(this.currentConnection.id, query);
            vscode.window.showInformationMessage('Cell updated successfully');
            await this.loadTableData(); // Refresh view

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to update cell: ${error.message}`);
        }
    }

    /**
     * Insert new row with prompts
     */
    private async insertRowWithPrompt(): Promise<void> {
        if (!this.currentConnection || !this.currentTable) {
            vscode.window.showErrorMessage('No connection or table selected');
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(this.currentConnection.id);
            if (!provider) {
                throw new Error('Provider not available');
            }

            if (!provider.executeQuery) {
                throw new Error('Provider does not support query execution');
            }

            // Get columns from current table
            let columns: string[] = [];
            const offset = (this.currentPage - 1) * this.pageSize;
            let query = '';

            switch (this.currentConnection.type) {
                case ConnectionType.PostgreSQL:
                case ConnectionType.MySQL:
                case ConnectionType.MariaDB:
                    const tableName = this.currentDatabase ? `${this.currentDatabase}.${this.currentTable}` : this.currentTable;
                    query = `SELECT * FROM ${tableName} LIMIT 1`;
                    break;
                case ConnectionType.SQLite:
                    query = `SELECT * FROM ${this.currentTable} LIMIT 1`;
                    break;
                case ConnectionType.MongoDB:
                    query = `db.${this.currentTable}.find({})`;
                    break;
            }

            const result: any = await provider.executeQuery(this.currentConnection.id, query);
            const rows = Array.isArray(result) ? result : [];
            if (rows.length > 0) {
                columns = Object.keys(rows[0]);
            }

            if (columns.length === 0) {
                vscode.window.showErrorMessage('Could not determine table columns');
                return;
            }

            // Filter out auto-increment columns
            const editableColumns = columns.filter(col => 
                col !== '_id' && col !== 'id' && col !== 'rowid' && 
                !col.toLowerCase().includes('auto') && !col.toLowerCase().includes('serial')
            );

            if (editableColumns.length === 0) {
                vscode.window.showErrorMessage('No editable columns found');
                return;
            }

            // Prompt for each column value
            const data: any = {};
            for (const col of editableColumns) {
                const value = await vscode.window.showInputBox({
                    prompt: `Enter value for column: ${col}`,
                    placeHolder: `Value for ${col} (leave empty for NULL)`,
                    ignoreFocusOut: true
                });

                if (value === undefined) {
                    // User cancelled
                    return;
                }

                if (value !== '') {
                    data[col] = value;
                }
            }

            if (Object.keys(data).length === 0) {
                vscode.window.showWarningMessage('No data entered, insert cancelled');
                return;
            }

            // Now insert the row
            await this.insertRow(data);

        } catch (error: any) {
            console.error('Insert prompt error:', error);
            vscode.window.showErrorMessage(`Failed to insert row: ${error.message}`);
        }
    }

    /**
     * Insert new row
     */
    private async insertRow(data: any): Promise<void> {
        if (!this.currentConnection || !this.currentTable) {
            vscode.window.showErrorMessage('No connection or table selected');
            return;
        }

        console.log('insertRow called with data:', data);

        try {
            const provider = await this.connectionManager.getProviderForConnection(this.currentConnection.id);
            if (!provider) {
                throw new Error('Provider not available');
            }

            if (!provider.executeQuery) {
                throw new Error('Provider does not support query execution');
            }

            // Build INSERT query
            let query = '';
            const columns = Object.keys(data);
            
            if (columns.length === 0) {
                throw new Error('No columns provided for insert');
            }
            
            const values = Object.values(data).map(v => {
                if (v === null || v === undefined || v === '') {
                    return 'NULL';
                }
                // Escape single quotes in string values
                const escaped = String(v).replace(/'/g, "''");
                return `'${escaped}'`;
            }).join(', ');

            switch (this.currentConnection.type) {
                case ConnectionType.PostgreSQL:
                case ConnectionType.MySQL:
                case ConnectionType.MariaDB:
                case ConnectionType.SQLite:
                    const tableName = (this.currentDatabase && this.currentConnection.type !== ConnectionType.SQLite) 
                        ? `${this.currentDatabase}.${this.currentTable}` 
                        : this.currentTable;
                    query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values})`;
                    console.log('SQL INSERT query:', query);
                    break;
                
                case ConnectionType.MongoDB:
                    query = `db.${this.currentTable}.insertOne(${JSON.stringify(data)})`;
                    console.log('MongoDB INSERT query:', query);
                    break;
                
                default:
                    throw new Error(`Insert not supported for ${this.currentConnection.type}`);
            }

            const result = await provider.executeQuery(this.currentConnection.id, query);
            console.log('Insert result:', result);
            vscode.window.showInformationMessage('Row inserted successfully');
            await this.loadTableData(); // Refresh view

        } catch (error: any) {
            console.error('Insert error:', error);
            vscode.window.showErrorMessage(`Failed to insert row: ${error.message}`);
        }
    }

    /**
     * Delete row
     */
    private async deleteRow(rowIndex: number): Promise<void> {
        if (!this.currentConnection || !this.currentTable) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Delete this row?',
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            return;
        }

        try {
            const provider = await this.connectionManager.getProviderForConnection(this.currentConnection.id);
            if (!provider) {
                throw new Error('Provider not available');
            }

            if (!provider.executeQuery) {
                throw new Error('Provider does not support query execution');
            }

            let query = '';
            const actualRowIndex = (this.currentPage - 1) * this.pageSize + rowIndex;

            switch (this.currentConnection.type) {
                case ConnectionType.PostgreSQL:
                case ConnectionType.MySQL:
                case ConnectionType.MariaDB:
                case ConnectionType.SQLite:
                    const tableName = (this.currentDatabase && this.currentConnection.type !== ConnectionType.SQLite) 
                        ? `${this.currentDatabase}.${this.currentTable}` 
                        : this.currentTable;
                    const whereClause = this.currentConnection.type === ConnectionType.SQLite 
                        ? `WHERE rowid = ${actualRowIndex + 1}`
                        : `LIMIT 1`; // This is simplified - ideally use primary key
                    query = `DELETE FROM ${tableName} ${whereClause}`;
                    break;

                case ConnectionType.MongoDB:
                    // Would need _id from the row data (simplified - in production track actual _id)
                    query = `db.${this.currentTable}.deleteOne({})`;
                    break;

                default:
                    throw new Error(`Delete not supported for ${this.currentConnection.type}`);
            }

            await provider.executeQuery(this.currentConnection.id, query);
            vscode.window.showInformationMessage('Row deleted successfully');
            await this.loadTableData(); // Refresh view

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete row: ${error.message}`);
        }
    }

    /**
     * Generate HTML content for webview
     */
    private getHtmlContent(data: TableData): string {
        const totalPages = Math.ceil(data.totalRows / data.pageSize);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Table Grid View</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }
        
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 4px;
        }
        
        .pagination {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .page-input {
            width: 60px;
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
        }
        
        .table-container {
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--vscode-editor-background);
        }
        
        th, td {
            text-align: left;
            padding: 8px 12px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        td[contenteditable="true"] {
            cursor: text;
            outline: none;
        }
        
        td[contenteditable="true"]:focus {
            background-color: var(--vscode-input-background);
            box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .info {
            margin-left: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        .actions {
            display: flex;
            gap: 8px;
        }
        
        .row-actions {
            display: flex;
            gap: 4px;
        }
        
        .delete-btn {
            padding: 2px 8px;
            font-size: 11px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .delete-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="actions">
            <button class="button" onclick="refresh()">🔄 Refresh</button>
            <button class="button" onclick="insertRow()">➕ Insert Row</button>
        </div>
        <div class="pagination">
            <span class="info">Total: ${data.totalRows} rows</span>
            <button class="button" onclick="prevPage()" ${data.page === 1 ? 'disabled' : ''}>◀ Previous</button>
            <span>Page <input type="number" class="page-input" value="${data.page}" min="1" max="${totalPages}" onchange="gotoPage(this.value)"> of ${totalPages}</span>
            <button class="button" onclick="nextPage()" ${data.page >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    ${data.columns.map(col => `<th>${col}</th>`).join('')}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${data.rows.map((row, rowIndex) => `
                    <tr>
                        <td>${(data.page - 1) * data.pageSize + rowIndex + 1}</td>
                        ${row.map((cell, colIndex) => `
                            <td contenteditable="true" 
                                data-row="${rowIndex}" 
                                data-col="${data.columns[colIndex]}"
                                onblur="updateCell(${rowIndex}, '${data.columns[colIndex]}', this.textContent)">
                                ${cell !== null && cell !== undefined ? String(cell) : ''}
                            </td>
                        `).join('')}
                        <td>
                            <div class="row-actions">
                                <button class="button delete-btn" onclick="deleteRow(${rowIndex})">🗑 Delete</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function nextPage() {
            vscode.postMessage({ command: 'nextPage' });
        }
        
        function prevPage() {
            vscode.postMessage({ command: 'prevPage' });
        }
        
        function gotoPage(page) {
            vscode.postMessage({ command: 'gotoPage', page: page });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function updateCell(rowIndex, columnName, value) {
            vscode.postMessage({ 
                command: 'updateCell', 
                rowIndex: rowIndex, 
                columnName: columnName, 
                value: value 
            });
        }
        
        function deleteRow(rowIndex) {
            vscode.postMessage({ 
                command: 'deleteRow', 
                rowIndex: rowIndex 
            });
        }
        
        function insertRow() {
            // Request insert from extension - it will show input boxes
            vscode.postMessage({ 
                command: 'insertRow'
            });
        }
    </script>
</body>
</html>`;
    }
}
