import * as amqp from 'amqplib';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * RabbitMQ connection provider
 */
export class RabbitMQProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            const url = `amqp://${config.username || 'guest'}:${credentials.password || 'guest'}@${config.host || 'localhost'}:${config.port || 5672}`;
            
            const connection = await amqp.connect(url);
            const channel = await connection.createChannel();
            
            this.connections.set(config.id, { connection, channel });
        } catch (error: any) {
            throw new Error(`RabbitMQ connection failed: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        const conn = this.getConnection(connectionId);
        if (conn) {
            try {
                await conn.channel.close();
                await conn.connection.close();
            } catch (error) {
                // Ignore errors during disconnect
            }
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const url = `amqp://${config.username || 'guest'}:${credentials.password || 'guest'}@${config.host || 'localhost'}:${config.port || 5672}`;
            
            const connection = await amqp.connect(url);
            await connection.close();
            return true;
        } catch (error) {
            console.error('RabbitMQ connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const conn = this.getConnection(connectionId);
        if (!conn) {
            throw new Error('No active connection');
        }

        try {
            // Get list of queues (limited info available via AMQP protocol)
            // For more details, would need RabbitMQ Management API
            return [{
                name: 'Queues',
                type: 'category',
                children: []
            }, {
                name: 'Exchanges',
                type: 'category',
                children: []
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

        // Parse commands: publish, consume, queue info, etc.
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        try {
            switch (command) {
                case 'queues':
                case 'list_queues':
                    // Use checkQueue to verify queues exist
                    // Note: RabbitMQ Management API would provide better queue listing
                    return { queues: [], message: 'Use RabbitMQ Management API for queue listing or publish to create queues' };

                case 'exchanges':
                case 'list_exchanges':
                    // Return common default exchanges
                    // Note: Full exchange listing requires Management API
                    return { 
                        exchanges: [
                            'amq.direct',
                            'amq.fanout',
                            'amq.topic',
                            'amq.headers',
                            'amq.match'
                        ],
                        message: 'Showing default exchanges. Use Management API for complete listing and user-defined exchanges'
                    };

                case 'publish':
                    // Format: publish <queue> <message>
                    const queue = parts[1];
                    const message = parts.slice(2).join(' ');
                    await conn.channel.assertQueue(queue);
                    conn.channel.sendToQueue(queue, Buffer.from(message));
                    return { success: true, queue, message: 'Message published' };

                case 'consume':
                    // Format: consume <queue> [count]
                    const consumeQueue = parts[1];
                    const count = parseInt(parts[2] || '10');
                    await conn.channel.assertQueue(consumeQueue);
                    
                    const messages: any[] = [];
                    for (let i = 0; i < count; i++) {
                        const msg = await conn.channel.get(consumeQueue);
                        if (msg) {
                            messages.push({
                                content: msg.content.toString(),
                                fields: msg.fields,
                                properties: msg.properties
                            });
                            conn.channel.ack(msg);
                        } else {
                            break;
                        }
                    }
                    return { messages, count: messages.length };

                default:
                    throw new Error(`Unknown command: ${command}. Supported: queues, exchanges, publish, consume`);
            }
        } catch (error: any) {
            throw new Error(`RabbitMQ command failed: ${error.message}`);
        }
    }
}
