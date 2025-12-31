import { Kafka, Admin, Producer, Consumer } from 'kafkajs';
import { BaseConnectionProvider } from './base';
import { ConnectionConfig } from '../core/types';

/**
 * Kafka connection provider
 */
export class KafkaProvider extends BaseConnectionProvider {
    async connect(config: ConnectionConfig, credentials: any): Promise<void> {
        try {
            const kafka = new Kafka({
                clientId: `vscode-db-manager-${config.id}`,
                brokers: [`${config.host || 'localhost'}:${config.port || 9092}`],
                ssl: config.ssl,
                sasl: credentials.password ? {
                    mechanism: 'plain',
                    username: config.username || '',
                    password: credentials.password || ''
                } : undefined
            });

            const admin = kafka.admin();
            await admin.connect();
            
            const producer = kafka.producer();
            await producer.connect();

            this.connections.set(config.id, { kafka, admin, producer });
        } catch (error: any) {
            throw new Error(`Kafka connection failed: ${error.message}`);
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        const conn = this.getConnection(connectionId);
        if (conn) {
            try {
                await conn.producer.disconnect();
                await conn.admin.disconnect();
            } catch (error) {
                // Ignore errors during disconnect
            }
            this.connections.delete(connectionId);
        }
    }

    async testConnection(config: ConnectionConfig, credentials: any): Promise<boolean> {
        try {
            const kafka = new Kafka({
                clientId: 'vscode-test',
                brokers: [`${config.host || 'localhost'}:${config.port || 9092}`],
                ssl: config.ssl,
                sasl: credentials.password ? {
                    mechanism: 'plain',
                    username: config.username || '',
                    password: credentials.password || ''
                } : undefined,
                connectionTimeout: 5000,
                requestTimeout: 5000
            });

            const admin = kafka.admin();
            await admin.connect();
            await admin.disconnect();
            return true;
        } catch (error) {
            console.error('Kafka connection test failed:', error);
            return false;
        }
    }

    async getMetadata(connectionId: string): Promise<any> {
        const conn = this.getConnection(connectionId);
        if (!conn) {
            throw new Error('No active connection');
        }

        try {
            const topics = await conn.admin.listTopics();
            const cluster = await conn.admin.describeCluster();
            
            return [{
                name: 'Topics',
                type: 'category',
                children: topics.map((topic: string) => ({
                    name: topic,
                    type: 'topic'
                }))
            }, {
                name: 'Brokers',
                type: 'category',
                children: cluster.brokers.map((broker: any) => ({
                    name: `${broker.host}:${broker.port}`,
                    type: 'broker',
                    nodeId: broker.nodeId
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

        // Parse commands: list topics, create topic, produce, consume, etc.
        const parts = query.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        try {
            switch (command) {
                case 'topics':
                case 'list_topics':
                    const topics = await conn.admin.listTopics();
                    return { topics };

                case 'create_topic':
                    // Format: create_topic <name> [partitions] [replication]
                    const topicName = parts[1];
                    const partitions = parseInt(parts[2] || '1');
                    const replicationFactor = parseInt(parts[3] || '1');
                    
                    await conn.admin.createTopics({
                        topics: [{
                            topic: topicName,
                            numPartitions: partitions,
                            replicationFactor: replicationFactor
                        }]
                    });
                    return { success: true, topic: topicName, message: 'Topic created' };

                case 'delete_topic':
                    // Format: delete_topic <name>
                    const deleteTopic = parts[1];
                    await conn.admin.deleteTopics({
                        topics: [deleteTopic]
                    });
                    return { success: true, topic: deleteTopic, message: 'Topic deleted' };

                case 'produce':
                    // Format: produce <topic> <message>
                    const topic = parts[1];
                    const message = parts.slice(2).join(' ');
                    
                    await conn.producer.send({
                        topic: topic,
                        messages: [{ value: message }]
                    });
                    return { success: true, topic, message: 'Message produced' };

                case 'describe_topic':
                    // Format: describe_topic <name>
                    const describeTopic = parts[1];
                    const metadata = await conn.admin.fetchTopicMetadata({
                        topics: [describeTopic]
                    });
                    return metadata.topics[0];

                default:
                    throw new Error(`Unknown command: ${command}. Supported: topics, create_topic, delete_topic, produce, describe_topic`);
            }
        } catch (error: any) {
            throw new Error(`Kafka command failed: ${error.message}`);
        }
    }
}
