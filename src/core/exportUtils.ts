import * as vscode from 'vscode';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export format types
 */
export enum ExportFormat {
    CSV = 'csv',
    JSON = 'json',
    EXCEL = 'excel'
}

/**
 * Utility class for exporting query results
 */
export class ExportUtils {
    /**
     * Export data to specified format
     */
    static async exportData(data: any, defaultFileName: string = 'export'): Promise<void> {
        // Ask user for export format
        const format = await vscode.window.showQuickPick(
            [
                { label: '📄 CSV', value: ExportFormat.CSV, description: 'Comma-separated values' },
                { label: '📋 JSON', value: ExportFormat.JSON, description: 'JSON format (pretty print)' },
                { label: '📊 Excel', value: ExportFormat.EXCEL, description: 'Microsoft Excel format (.xlsx)' }
            ],
            {
                placeHolder: 'Select export format'
            }
        );

        if (!format) {
            return;
        }

        // Determine file extension
        const fileExtension = format.value === ExportFormat.EXCEL ? 'xlsx' : format.value;
        
        // Get save location with proper filter
        const filters: { [name: string]: string[] } = {};
        if (format.value === ExportFormat.CSV) {
            filters['CSV Files'] = ['csv'];
        } else if (format.value === ExportFormat.JSON) {
            filters['JSON Files'] = ['json'];
        } else if (format.value === ExportFormat.EXCEL) {
            filters['Excel Files'] = ['xlsx'];
        }
        filters['All Files'] = ['*'];

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', `${defaultFileName}.${fileExtension}`)),
            filters
        });

        if (!uri) {
            return;
        }

        try {
            switch (format.value) {
                case ExportFormat.CSV:
                    await this.exportToCSV(data, uri.fsPath);
                    break;
                case ExportFormat.JSON:
                    await this.exportToJSON(data, uri.fsPath);
                    break;
                case ExportFormat.EXCEL:
                    await this.exportToExcel(data, uri.fsPath);
                    break;
            }

            vscode.window.showInformationMessage(`Data exported successfully to ${path.basename(uri.fsPath)}`);
            
            // Ask if user wants to open the file
            const open = await vscode.window.showInformationMessage(
                'Export complete!',
                'Open File',
                'Show in Folder'
            );

            if (open === 'Open File') {
                await vscode.commands.executeCommand('vscode.open', uri);
            } else if (open === 'Show in Folder') {
                await vscode.commands.executeCommand('revealFileInOS', uri);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Export failed: ${error.message}`);
        }
    }

    /**
     * Export data to CSV format
     */
    private static async exportToCSV(data: any, filePath: string): Promise<void> {
        const rows = this.normalizeData(data);
        
        if (rows.length === 0) {
            throw new Error('No data to export');
        }

        // Get headers from first row
        const headers = Object.keys(rows[0]);
        
        // Create CSV content
        const csvLines: string[] = [];
        
        // Add headers
        csvLines.push(headers.map(h => this.escapeCSV(h)).join(','));
        
        // Add data rows
        for (const row of rows) {
            const values = headers.map(header => {
                const value = row[header];
                return this.escapeCSV(this.formatValue(value));
            });
            csvLines.push(values.join(','));
        }

        await fs.promises.writeFile(filePath, csvLines.join('\n'), 'utf-8');
    }

    /**
     * Export data to JSON format
     */
    private static async exportToJSON(data: any, filePath: string): Promise<void> {
        const rows = this.normalizeData(data);
        await fs.promises.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    }

    /**
     * Export data to Excel format
     */
    private static async exportToExcel(data: any, filePath: string): Promise<void> {
        const rows = this.normalizeData(data);
        
        if (rows.length === 0) {
            throw new Error('No data to export');
        }

        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Convert data to worksheet
        const worksheet = XLSX.utils.json_to_sheet(rows);
        
        // Auto-size columns
        const columnWidths = this.calculateColumnWidths(rows);
        worksheet['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
        
        // Write file using buffer approach
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        await fs.promises.writeFile(filePath, buffer);
    }

    /**
     * Normalize data to array of objects
     */
    private static normalizeData(data: any): any[] {
        if (!data) {
            return [];
        }

        // If already an array, return as-is
        if (Array.isArray(data)) {
            return data.map(item => this.flattenObject(item));
        }

        // If single object, wrap in array
        if (typeof data === 'object') {
            return [this.flattenObject(data)];
        }

        // Primitive value
        return [{ value: data }];
    }

    /**
     * Flatten nested objects for export
     */
    private static flattenObject(obj: any, prefix: string = ''): any {
        const flattened: any = {};

        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) {continue;}

            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value === null || value === undefined) {
                flattened[newKey] = '';
            } else if (this.isSpecialObject(value)) {
                // Handle special objects (ObjectID, Date, Buffer, etc.) by converting to string
                flattened[newKey] = this.convertSpecialObject(value);
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                // Recursively flatten nested objects
                Object.assign(flattened, this.flattenObject(value, newKey));
            } else if (Array.isArray(value)) {
                // Convert arrays to JSON strings
                flattened[newKey] = JSON.stringify(value);
            } else {
                flattened[newKey] = value;
            }
        }

        return flattened;
    }

    /**
     * Check if object is a special type that should be converted to string
     */
    private static isSpecialObject(value: any): boolean {
        if (!value || typeof value !== 'object') {
            return false;
        }

        // MongoDB ObjectID
        if (value.constructor && value.constructor.name === 'ObjectId') {
            return true;
        }
        if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') {
            return true;
        }

        // Buffer
        if (Buffer.isBuffer(value)) {
            return true;
        }

        // Date
        if (value instanceof Date) {
            return true;
        }

        // Has toHexString (MongoDB ObjectID method)
        if (typeof value.toHexString === 'function') {
            return true;
        }

        // Has toString that's been overridden (likely a special object)
        if (value.toString && value.toString !== Object.prototype.toString && 
            !value.constructor.name.includes('Object')) {
            return true;
        }

        return false;
    }

    /**
     * Convert special objects to string representation
     */
    private static convertSpecialObject(value: any): string {
        // Try toHexString first (MongoDB ObjectID)
        if (typeof value.toHexString === 'function') {
            return value.toHexString();
        }

        // Try toString if it's been overridden
        if (value.toString && value.toString !== Object.prototype.toString) {
            const str = value.toString();
            // Don't return [object Object]
            if (str !== '[object Object]') {
                return str;
            }
        }

        // Date
        if (value instanceof Date) {
            return value.toISOString();
        }

        // Buffer
        if (Buffer.isBuffer(value)) {
            return value.toString('hex');
        }

        // Fallback to JSON
        return JSON.stringify(value);
    }

    /**
     * Escape CSV value
     */
    private static escapeCSV(value: string): string {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);
        
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    }

    /**
     * Format value for display
     */
    private static formatValue(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    /**
     * Calculate column widths for Excel
     */
    private static calculateColumnWidths(data: any[]): any[] {
        if (data.length === 0) {
            return [];
        }

        const headers = Object.keys(data[0]);
        const widths: any[] = [];

        for (const header of headers) {
            let maxWidth = header.length;

            for (const row of data) {
                const value = this.formatValue(row[header]);
                maxWidth = Math.max(maxWidth, value.length);
            }

            // Cap at 50 characters
            widths.push({ wch: Math.min(maxWidth + 2, 50) });
        }

        return widths;
    }
}
