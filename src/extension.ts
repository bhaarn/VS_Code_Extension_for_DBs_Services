import * as vscode from 'vscode';
import { ConnectionExplorer } from './views/connectionExplorer';
import { ConnectionManager } from './core/connectionManager';
import { SecretManager } from './core/secretManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Database & Services Manager is now active!');

    // Initialize core services
    const secretManager = new SecretManager(context);
    const connectionManager = new ConnectionManager(secretManager, context);

    // Initialize views
    const connectionExplorer = new ConnectionExplorer(context, connectionManager);
    
    // Register tree view
    vscode.window.registerTreeDataProvider('dbServicesExplorer', connectionExplorer);

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
}

export function deactivate() {
    // Cleanup connections
    console.log('Database & Services Manager is deactivating...');
}
