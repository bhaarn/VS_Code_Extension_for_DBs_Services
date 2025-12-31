import * as sqlite3 from 'sqlite3';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * SQLite connection provider
 */
export class SQLiteProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(config.database || '', (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.connections.set(config.id, db);
                    resolve();
                }
            });
        });
    }

    async disconnect(connectionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const db = this.getConnection(connectionId);
            if (db) {
                db.close((err: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.connections.delete(connectionId);
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        return new Promise((resolve) => {
            const db = new sqlite3.Database(config.database || '', (err) => {
                if (err) {
                    resolve(false);
                } else {
                    db.close();
                    resolve(true);
                }
            });
        });
    }

    async getMetadata(connectionId: string): Promise<any> {
        const db = this.getConnection(connectionId);
        if (!db) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err: any, rows: any) => {
                if (err) {
                    reject(err);
                } else {
                    // SQLite is a single file, so we return tables directly
                    const tables = rows.map((r: any) => ({ name: r.name, type: 'table' }));
                    resolve([{
                        name: 'main',
                        type: 'database',
                        children: tables
                    }]);
                }
            });
        });
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const db = this.getConnection(connectionId);
        if (!db) {
            throw new Error('No active connection');
        }

        return new Promise((resolve, reject) => {
            // Check if it's a SELECT query
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                db.all(query, (err: any, rows: any) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else {
                // For INSERT, UPDATE, DELETE
                db.run(query, function(this: { changes: number; lastID: number }, err: any) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes, lastID: this.lastID });
                });
            }
        });
    }
}
