import { Queue, QueueEvents, Worker } from 'bullmq';
import { createClient } from 'redis';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * BullMQ connection provider (uses Redis as backend)
 */
export class BullMQProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            // BullMQ uses Redis as backend
            const redisOptions = {
                host: config.host || 'localhost',
                port: config.port || 6379,
                password: credentials.password,
                username: config.username
            };

            // Test Redis connection
            const client = createClient({
                socket: {
                    host: redisOptions.host,
                    port: redisOptions.port
                },
                password: redisOptions.password,
                username: redisOptions.username
            });

            await client.connect();
            
            this.connections.set(config.id, { redisClient: client, redisOptions, queues: new Map() });
        } catch (error: any) {
            throw new Error(`BullMQ connection failed: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        const conn = this.getConnection(connectionId);
        if (conn) {
            try {
                // Close all queues
                for (const queue of conn.queues.values()) {
                    await queue.close();
                }
                await conn.redisClient.disconnect();
            } catch (error) {
                // Ignore errors during disconnect
            }
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const client = createClient({
                socket: {
                    host: config.host || 'localhost',
                    port: config.port || 6379
                },
                password: credentials.password,
                username: config.username
            });

            await client.connect();
            await client.disconnect();
            return true;
        } catch (error) {
            console.error('BullMQ connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const conn = this.getConnection(connectionId);
        if (!conn) {
            throw new Error('No active connection');
        }

        try {
            // Get list of BullMQ queues from Redis keys
            const keys = await conn.redisClient.keys('bull:*:meta');
            const queueNames = keys.map((key: string) => {
                const match = key.match(/bull:(.+):meta/);
                return match ? match[1] : null;
            }).filter(Boolean);

            return [{
                name: 'Queues',
                type: 'category',
                children: queueNames.map((name: string) => ({
                    name,
                    type: 'queue'
                }))
            }];
        } catch (error: any) {
            throw new Error(`Failed to get metadata: ${error.message}`);
        }
    }

    async executeQuery(connectionId: string, query: string, context?: any): Promise<any> {
        const conn = this.getConnection(connectionId);
        if (!conn) {
            throw new Error('No active connection');
        }

        // Parse commands: list queues, add job, get jobs, etc.
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        try {
            switch (command) {
                case 'queues':
                case 'list_queues':
                    const keys = await conn.redisClient.keys('bull:*:meta');
                    const queueNames = keys.map((key: string) => {
                        const match = key.match(/bull:(.+):meta/);
                        return match ? match[1] : null;
                    }).filter(Boolean);
                    return { queues: queueNames };

                case 'add_job':
                    // Format: add_job <queue> <data_json>
                    const queueName = parts[1];
                    const jobData = JSON.parse(parts.slice(2).join(' '));
                    
                    let queue = conn.queues.get(queueName);
                    if (!queue) {
                        queue = new Queue(queueName, { connection: conn.redisOptions });
                        conn.queues.set(queueName, queue);
                    }
                    
                    const job = await queue.add('task', jobData);
                    return { success: true, jobId: job.id, queue: queueName };

                case 'get_jobs':
                    // Format: get_jobs <queue> [status] [limit]
                    const getQueueName = parts[1];
                    const status = parts[2] || 'waiting';
                    const limit = parseInt(parts[3] || '10');
                    
                    let getQueue = conn.queues.get(getQueueName);
                    if (!getQueue) {
                        getQueue = new Queue(getQueueName, { connection: conn.redisOptions });
                        conn.queues.set(getQueueName, getQueue);
                    }
                    
                    const jobs = await getQueue.getJobs([status as any], 0, limit - 1);
                    return {
                        queue: getQueueName,
                        status,
                        count: jobs.length,
                        jobs: jobs.map((j: any) => ({
                            id: j.id,
                            name: j.name,
                            data: j.data,
                            timestamp: j.timestamp,
                            processedOn: j.processedOn,
                            finishedOn: j.finishedOn
                        }))
                    };

                case 'queue_counts':
                    // Format: queue_counts <queue>
                    const countsQueueName = parts[1];
                    
                    let countsQueue = conn.queues.get(countsQueueName);
                    if (!countsQueue) {
                        countsQueue = new Queue(countsQueueName, { connection: conn.redisOptions });
                        conn.queues.set(countsQueueName, countsQueue);
                    }
                    
                    const counts = await countsQueue.getJobCounts();
                    return { queue: countsQueueName, counts };

                default:
                    throw new Error(`Unknown command: ${command}. Supported: queues, add_job, get_jobs, queue_counts`);
            }
        } catch (error: any) {
            throw new Error(`BullMQ command failed: ${error.message}`);
        }
    }
}
