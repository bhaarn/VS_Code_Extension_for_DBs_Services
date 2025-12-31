import { MongoClient } from 'mongodb';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * MongoDB connection provider
 */
export class MongoDBProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        let uri: string;
        
        // Build URI based on whether authentication is used
        if (config.username && credentials.password) {
            uri = `mongodb://${config.username}:${encodeURIComponent(credentials.password)}@${config.host}:${config.port || 27017}/${config.database || ''}`;
        } else {
            // No authentication (common for local development)
            uri = `mongodb://${config.host}:${config.port || 27017}/${config.database || ''}`;
        }
        
        const client = new MongoClient(uri, {
            ssl: config.ssl,
            serverSelectionTimeoutMS: 5000
        });

        await client.connect();
        this.connections.set(config.id, client);
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.getConnection(connectionId);
        if (client) {
            await client.close();
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            let uri: string;
            
            // Build URI based on whether authentication is used
            if (config.username && credentials.password) {
                uri = `mongodb://${config.username}:${encodeURIComponent(credentials.password)}@${config.host}:${config.port || 27017}/${config.database || ''}`;
            } else {
                // No authentication (common for local development)
                uri = `mongodb://${config.host}:${config.port || 27017}/${config.database || ''}`;
            }
            
            const client = new MongoClient(uri, {
                ssl: config.ssl,
                serverSelectionTimeoutMS: 5000
            });

            await client.connect();
            await client.close();
            return true;
        } catch (error) {
            console.error('MongoDB connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        // List all databases
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        return dbs.databases.map((db: any) => db.name);
    }

    async executeQuery(connectionId: string, targetOrQuery: string, query?: string): Promise<any> {
        const client = this.getConnection(connectionId);
        if (!client) {
            throw new Error('No active connection');
        }

        try {
            // Determine if this is a collection-based query or a script query
            // If query parameter exists, it's the old format: executeQuery(connectionId, collectionName, jsonQuery)
            // If query parameter is missing, targetOrQuery contains the full script
            const isScriptQuery = !query;
            const scriptOrQuery = isScriptQuery ? targetOrQuery : query!;

            // Extract database from 'use dbname;' command
            let dbName: string | undefined;
            const useMatch = scriptOrQuery.match(/use\s+(\w+)\s*;/i);
            if (useMatch) {
                dbName = useMatch[1];
            }

            // Also check for comment format "// Database: dbname" as fallback
            if (!dbName) {
                const dbMatch = scriptOrQuery.match(/\/\/\s*Database:\s*(\w+)/i);
                if (dbMatch) {
                    dbName = dbMatch[1];
                }
            }

            // Clean script by removing comments and 'use' commands
            const cleanScript = scriptOrQuery
                .split('\n')
                .filter(line => !line.trim().startsWith('//') && !line.trim().match(/^use\s+\w+\s*;/i))
                .join('\n')
                .trim();

            const db = dbName ? client.db(dbName) : client.db();

            // Match db.collection.find(...)
            const findMatch = cleanScript.match(/db\.(\w+)\.find\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (findMatch) {
                const collectionName = findMatch[1];
                const queryStr = findMatch[2].trim() || '{}';
                const queryObj = eval(`(${queryStr})`);
                const collection = db.collection(collectionName);
                return await collection.find(queryObj).limit(100).toArray();
            }

            // Match db.collection.aggregate(...)
            const aggMatch = cleanScript.match(/db\.(\w+)\.aggregate\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (aggMatch) {
                const collectionName = aggMatch[1];
                const pipelineStr = aggMatch[2].trim();
                const pipeline = eval(`(${pipelineStr})`);
                const collection = db.collection(collectionName);
                return await collection.aggregate(pipeline).toArray();
            }

            // Match db.collection.insertMany(...)
            const insertManyMatch = cleanScript.match(/db\.(\w+)\.insertMany\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (insertManyMatch) {
                const collectionName = insertManyMatch[1];
                const docsStr = insertManyMatch[2].trim();
                const docs = eval(`(${docsStr})`);
                const collection = db.collection(collectionName);
                const result = await collection.insertMany(docs);
                return { insertedCount: result.insertedCount, insertedIds: result.insertedIds };
            }

            // Match db.collection.insertOne(...)
            const insertOneMatch = cleanScript.match(/db\.(\w+)\.insertOne\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (insertOneMatch) {
                const collectionName = insertOneMatch[1];
                const docStr = insertOneMatch[2].trim();
                const doc = eval(`(${docStr})`);
                const collection = db.collection(collectionName);
                const result = await collection.insertOne(doc);
                return { insertedId: result.insertedId };
            }

            // Match db.collection.updateOne(...)
            const updateOneMatch = cleanScript.match(/db\.(\w+)\.updateOne\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (updateOneMatch) {
                const collectionName = updateOneMatch[1];
                const argsStr = updateOneMatch[2].trim();
                const args = this.parseMongoArguments(argsStr);
                if (args.length < 2) {
                    throw new Error('updateOne requires filter and update parameters');
                }
                const filter = eval(`(${args[0]})`);
                const update = eval(`(${args[1]})`);
                const collection = db.collection(collectionName);
                const result = await collection.updateOne(filter, update);
                return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
            }

            // Match db.collection.deleteOne(...)
            const deleteOneMatch = cleanScript.match(/db\.(\w+)\.deleteOne\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (deleteOneMatch) {
                const collectionName = deleteOneMatch[1];
                const filterStr = deleteOneMatch[2].trim();
                const filter = eval(`(${filterStr})`);
                const collection = db.collection(collectionName);
                const result = await collection.deleteOne(filter);
                return { deletedCount: result.deletedCount };
            }

            // Match db.collection.countDocuments(...)
            const countMatch = cleanScript.match(/db\.(\w+)\.countDocuments\(([\s\S]*?)\)(?:\s*;?\s*$)/);
            if (countMatch) {
                const collectionName = countMatch[1];
                const filterStr = countMatch[2].trim() || '{}';
                const filter = eval(`(${filterStr})`);
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments(filter);
                return { count };
            }

            throw new Error('Unsupported MongoDB operation. Supported: find, aggregate, insertOne, insertMany, updateOne, deleteOne, countDocuments');
        } catch (error: any) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    private parseMongoArguments(argsStr: string): string[] {
        const args: string[] = [];
        let currentArg = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];
            const prevChar = i > 0 ? argsStr[i - 1] : '';

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            if (!inString) {
                if (char === '{' || char === '[' || char === '(') {
                    depth++;
                } else if (char === '}' || char === ']' || char === ')') {
                    depth--;
                } else if (char === ',' && depth === 0) {
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
}
