import * as vscode from 'vscode';
import { ConnectionExplorer } from './views/connectionExplorer';
import { QueryHistory } from './views/queryHistory';
import { SavedQueries } from './views/savedQueries';
import { TableGridView } from './views/tableGridView';
import { ConnectionManager } from './core/connectionManager';
import { SecretManager } from './core/secretManager';

// Global reference for cleanup
let globalConnectionManager: ConnectionManager | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Database & Services Manager is now active!');

    // Initialize core services
    const secretManager = new SecretManager(context);
    const connectionManager = new ConnectionManager(secretManager, context);
    globalConnectionManager = connectionManager;

    // Initialize views
    const connectionExplorer = new ConnectionExplorer(context, connectionManager);
    const queryHistory = new QueryHistory(context, connectionManager, connectionExplorer);
    const savedQueries = new SavedQueries(context, connectionManager, connectionExplorer);
    const tableGridView = new TableGridView(connectionManager);
    
    // Register tree views (add to subscriptions for proper disposal)
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('dbServicesExplorer', connectionExplorer)
    );
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('queryHistoryExplorer', queryHistory)
    );
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('savedQueriesExplorer', savedQueries)
    );

    // Pass queryHistory to connectionExplorer so it can log queries
    (connectionExplorer as any).queryHistory = queryHistory;

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.addConnection', async () => {
            await connectionExplorer.addConnection();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.editConnection', async (item) => {
            await connectionExplorer.editConnection(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteConnection', async (item) => {
            await connectionExplorer.deleteConnection(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.connect', async (item) => {
            await connectionExplorer.connect(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.testConnection', async (item) => {
            try {
                // If called from command palette, prompt for connection
                if (!item) {
                    const connections = connectionManager.getAllConnections();
                    if (connections.length === 0) {
                        vscode.window.showWarningMessage('No connections available to test');
                        return;
                    }
                    
                    const connectionNames = connections.map(c => ({ label: c.name, id: c.id }));
                    const selected = await vscode.window.showQuickPick(connectionNames, {
                        placeHolder: 'Select a connection to test'
                    });
                    
                    if (!selected) {
                        return;
                    }
                    
                    await connectionManager.testConnectionHealth(selected.id);
                    connectionExplorer.refresh();
                } else {
                    await connectionManager.testConnectionHealth(item.config.id);
                    connectionExplorer.refresh();
                }
            } catch (error) {
                // Error already shown by ConnectionManager
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.disconnect', async (item) => {
            await connectionExplorer.disconnect(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.refreshConnections', () => {
            connectionExplorer.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.queryCollection', async (item) => {
            await connectionExplorer.queryCollection(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.insertDocument', async (item) => {
            await connectionExplorer.insertDocument(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.insertMultipleDocuments', async (item) => {
            await connectionExplorer.insertMultipleDocuments(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.updateDocument', async (item) => {
            await connectionExplorer.updateDocument(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteDocument', async (item) => {
            await connectionExplorer.deleteDocument(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runMongoScript', async (item) => {
            await connectionExplorer.runMongoScript(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runSQLScript', async (item) => {
            await connectionExplorer.runSQLScript(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.openTableGrid', async (item) => {
            const tableName = item.label;
            const database = item.config.database;
            await tableGridView.showTable(item.config.id, tableName, database);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runCypherScript', async (item) => {
            await connectionExplorer.runCypherScript(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runRedisCommand', async (item) => {
            await connectionExplorer.runRedisCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.insertRow', async (item) => {
            await connectionExplorer.insertRow(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.updateRow', async (item) => {
            await connectionExplorer.updateRow(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteRow', async (item) => {
            await connectionExplorer.deleteRow(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.listSFTPDirectory', async (item) => {
            await connectionExplorer.listSFTPDirectory(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.uploadSFTPFile', async (item) => {
            await connectionExplorer.uploadSFTPFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.downloadSFTPFile', async (item) => {
            await connectionExplorer.downloadSFTPFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.downloadFTPFile', async (item) => {
            await connectionExplorer.downloadFTPFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.uploadFTPFile', async (item) => {
            await connectionExplorer.uploadFTPFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.uploadFTPDirectory', async (item) => {
            await connectionExplorer.uploadFTPDirectory(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.uploadSFTPDirectory', async (item) => {
            await connectionExplorer.uploadSFTPDirectory(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runRabbitMQCommand', async (item) => {
            await connectionExplorer.runRabbitMQCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runBullMQCommand', async (item) => {
            await connectionExplorer.runBullMQCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runKafkaCommand', async (item) => {
            await connectionExplorer.runKafkaCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runSSHCommand', async (item) => {
            await connectionExplorer.runSSHCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runDockerCommand', async (item) => {
            await connectionExplorer.runDockerCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.runElasticsearchCommand', async (item) => {
            await connectionExplorer.runElasticsearchCommand(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.exportConnections', async () => {
            await connectionExplorer.exportConnections();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.importConnections', async () => {
            await connectionExplorer.importConnections();
        })
    );

    // Query History commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.rerunQuery', async (item) => {
            await queryHistory.rerunQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.clearQueryHistory', async () => {
            await queryHistory.clearHistory();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.copyQueryFromHistory', async (item) => {
            await queryHistory.copyQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteQueryFromHistory', async (item) => {
            await queryHistory.deleteQuery(item);
        })
    );

    // Saved Queries commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.saveQuery', async () => {
            await savedQueries.saveQuery();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.createQueryFolder', async () => {
            await savedQueries.createFolder();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.executeSavedQuery', async (item) => {
            await savedQueries.executeQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.editSavedQuery', async (item) => {
            await savedQueries.editQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteSavedQuery', async (item) => {
            await savedQueries.deleteQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.copySavedQuery', async (item) => {
            await savedQueries.copyQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.renameSavedQuery', async (item) => {
            await savedQueries.renameQuery(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteQueryFolder', async (item) => {
            await savedQueries.deleteFolder(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.createTemplate', async () => {
            await savedQueries.createTemplate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.executeTemplate', async (item) => {
            await savedQueries.executeTemplate(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.insertSnippet', async () => {
            await savedQueries.insertSnippet();
        })
    );

    // Export commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.exportQueryResult', async (data: any) => {
            const { ExportUtils } = require('./core/exportUtils');
            await ExportUtils.exportData(data, 'query_result');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.exportHistoryResult', async (item) => {
            await queryHistory.exportResult(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.exportSavedQueryResult', async (item) => {
            await savedQueries.exportResult(item);
        })
    );

    // Group and Favorite commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.createGroup', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter group name',
                placeHolder: 'Production, Development, etc.'
            });
            if (!name) {
                return;
            }

            const description = await vscode.window.showInputBox({
                prompt: 'Enter group description (optional)',
                placeHolder: 'Production databases'
            });

            await connectionManager.createGroup(name, description);
            connectionExplorer.refresh();
            vscode.window.showInformationMessage(`Group "${name}" created`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.renameGroup', async (item) => {
            const groupId = item.config.id;
            const group = connectionManager.getGroup(groupId);
            if (!group) {
                return;
            }

            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new group name',
                value: group.name
            });
            if (!newName) {
                return;
            }

            await connectionManager.updateGroup(groupId, { name: newName });
            connectionExplorer.refresh();
            vscode.window.showInformationMessage(`Group renamed to "${newName}"`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.deleteGroup', async (item) => {
            const groupId = item.config.id;
            const group = connectionManager.getGroup(groupId);
            if (!group) {
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete group "${group.name}"? Connections will not be deleted.`,
                'Delete',
                'Cancel'
            );
            if (confirm !== 'Delete') {
                return;
            }

            await connectionManager.deleteGroup(groupId);
            connectionExplorer.refresh();
            vscode.window.showInformationMessage(`Group "${group.name}" deleted`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.addToGroup', async (item) => {
            const connectionId = item.config.id;
            const groups = connectionManager.getGroups();

            if (groups.length === 0) {
                const createNew = await vscode.window.showInformationMessage(
                    'No groups exist. Create one?',
                    'Create Group',
                    'Cancel'
                );
                if (createNew === 'Create Group') {
                    await vscode.commands.executeCommand('dbServices.createGroup');
                }
                return;
            }

            const selected = await vscode.window.showQuickPick(
                groups.map(g => ({
                    label: g.name,
                    description: g.description,
                    groupId: g.id
                })),
                { placeHolder: 'Select a group' }
            );

            if (selected) {
                await connectionManager.addConnectionToGroup(connectionId, selected.groupId);
                connectionExplorer.refresh();
                vscode.window.showInformationMessage(`Added to group "${selected.label}"`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.removeFromGroup', async (item) => {
            const connectionId = item.config.id;
            await connectionManager.removeConnectionFromGroup(connectionId);
            connectionExplorer.refresh();
            vscode.window.showInformationMessage('Removed from group');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.toggleFavorite', async (item) => {
            const connectionId = item.config.id;
            const isFavorite = await connectionManager.toggleFavorite(connectionId);
            connectionExplorer.refresh();
            const message = isFavorite ? 'Added to favorites' : 'Removed from favorites';
            vscode.window.showInformationMessage(message);
        })
    );
    
    // Docker operation commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.startContainer', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Starting container ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).startContainer(item.config.id, resourceId);
                });

                vscode.window.showInformationMessage(`Container ${item.label} started`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to start container: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.stopContainer', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Stopping container ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).stopContainer(item.config.id, resourceId);
                });

                vscode.window.showInformationMessage(`Container ${item.label} stopped`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to stop container: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.restartContainer', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Restarting container ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).restartContainer(item.config.id, resourceId);
                });

                vscode.window.showInformationMessage(`Container ${item.label} restarted`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to restart container: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.removeContainer', async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Remove container ${item.label}? This action cannot be undone.`,
                { modal: true },
                'Remove',
                'Force Remove'
            );
            
            if (!confirm) {
                return;
            }

            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const force = confirm === 'Force Remove';
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Removing container ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).removeContainer(item.config.id, resourceId, force);
                });

                vscode.window.showInformationMessage(`Container ${item.label} removed`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to remove container: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.viewContainerLogs', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const tail = await vscode.window.showInputBox({
                    prompt: 'Number of log lines to show',
                    value: '100',
                    validateInput: (value) => {
                        const num = parseInt(value);
                        if (isNaN(num) || num < 1 || num > 10000) {
                            return 'Please enter a number between 1 and 10000';
                        }
                        return null;
                    }
                });

                if (!tail) {
                    return;
                }

                const resourceId = (item as any).resourceId || item.label;
                const logs = await (provider as any).viewContainerLogs(item.config.id, resourceId, parseInt(tail));
                
                // Show logs in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: logs,
                    language: 'log'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to get logs: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.inspectContainer', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const data = await (provider as any).inspectResource(item.config.id, 'container', resourceId);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(data, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to inspect container: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.removeImage', async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Remove image ${item.label}? This action cannot be undone.`,
                { modal: true },
                'Remove',
                'Force Remove'
            );
            
            if (!confirm) {
                return;
            }

            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const force = confirm === 'Force Remove';
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Removing image ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).removeImage(item.config.id, resourceId, force);
                });

                vscode.window.showInformationMessage(`Image ${item.label} removed`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to remove image: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.inspectImage', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const data = await (provider as any).inspectResource(item.config.id, 'image', resourceId);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(data, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to inspect image: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.removeVolume', async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Remove volume ${item.label}? This will delete all data in the volume. This action cannot be undone.`,
                { modal: true },
                'Remove'
            );
            
            if (confirm !== 'Remove') {
                return;
            }

            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Removing volume ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).removeVolume(item.config.id, resourceId, false);
                });

                vscode.window.showInformationMessage(`Volume ${item.label} removed`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to remove volume: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.inspectVolume', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const data = await (provider as any).inspectResource(item.config.id, 'volume', resourceId);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(data, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to inspect volume: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.removeNetwork', async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Remove network ${item.label}? This action cannot be undone.`,
                { modal: true },
                'Remove'
            );
            
            if (confirm !== 'Remove') {
                return;
            }

            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Removing network ${item.label}...`,
                    cancellable: false
                }, async () => {
                    await (provider as any).removeNetwork(item.config.id, resourceId);
                });

                vscode.window.showInformationMessage(`Network ${item.label} removed`);
                connectionExplorer.refresh();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to remove network: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbServices.inspectNetwork', async (item) => {
            try {
                const provider = await connectionManager.getProviderForConnection(item.config.id);
                if (!provider) {
                    throw new Error('Provider not available');
                }

                const resourceId = (item as any).resourceId || item.label;
                const data = await (provider as any).inspectResource(item.config.id, 'network', resourceId);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(data, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to inspect network: ${error.message}`);
            }
        })
    );
}

export function deactivate() {
    // Cleanup connections and SSH tunnels
    console.log('Database & Services Manager is deactivating...');
    if (globalConnectionManager) {
        globalConnectionManager.dispose().catch(err => {
            console.error('Error during cleanup:', err);
        });
    }
}
