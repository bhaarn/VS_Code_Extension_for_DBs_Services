import * as vscode from 'vscode';

/**
 * Secure credential manager using VS Code's Secret Storage API
 * Ensures no plaintext passwords are stored in configuration files
 */
export class SecretManager {
    private secrets: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this.secrets = context.secrets;
    }

    /**
     * Store credentials securely
     * @param connectionId Unique identifier for the connection
     * @param credentials Object containing sensitive data
     */
    async storeCredentials(connectionId: string, credentials: any): Promise<void> {
        const key = `dbservices.${connectionId}`;
        await this.secrets.store(key, JSON.stringify(credentials));
        
        // Log for audit (without sensitive data)
        console.log(`Credentials stored securely for connection: ${connectionId}`);
    }

    /**
     * Retrieve credentials securely
     * @param connectionId Unique identifier for the connection
     * @returns Decrypted credentials object
     */
    async getCredentials(connectionId: string): Promise<any> {
        const key = `dbservices.${connectionId}`;
        const credentialsJson = await this.secrets.get(key);
        
        if (!credentialsJson) {
            return null;
        }

        try {
            return JSON.parse(credentialsJson);
        } catch (error) {
            console.error(`Failed to parse credentials for ${connectionId}:`, error);
            return null;
        }
    }

    /**
     * Delete credentials
     * @param connectionId Unique identifier for the connection
     */
    async deleteCredentials(connectionId: string): Promise<void> {
        const key = `dbservices.${connectionId}`;
        await this.secrets.delete(key);
        console.log(`Credentials deleted for connection: ${connectionId}`);
    }

    /**
     * Check if credentials exist
     * @param connectionId Unique identifier for the connection
     */
    async hasCredentials(connectionId: string): Promise<boolean> {
        const credentials = await this.getCredentials(connectionId);
        return credentials !== null;
    }
}
