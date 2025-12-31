# Security Architecture

## Overview
This extension prioritizes security in handling database credentials and connections. Below is a detailed overview of the security measures implemented.

## Credential Storage

### VS Code Secret Storage API
- **Primary Storage**: All sensitive credentials (passwords, API keys, SSH keys) are stored using VS Code's Secret Storage API
- **Encryption**: Credentials are encrypted at rest using the operating system's secure credential storage:
  - **Windows**: Windows Credential Manager
  - **macOS**: Keychain
  - **Linux**: Secret Service API / libsecret
- **No Plaintext**: Passwords are never stored in plaintext in any configuration file

### Connection Configuration
Connection metadata (host, port, username, database name) is stored separately from credentials:
- Stored in VS Code workspace state
- Does NOT contain sensitive information
- Can be safely version controlled (if needed)

## Secure Connection Handling

### Input Validation
- All connection strings are validated and sanitized before use
- Protection against SQL/NoSQL injection attacks
- Host and port validation

### SSL/TLS Support
- All database providers support SSL/TLS encrypted connections
- Option to enable/disable certificate verification
- Recommended to always use SSL in production

### SSH Tunneling
- Support for SSH tunneling to access remote databases securely
- SSH credentials also managed via Secret Storage API
- Multiple authentication methods supported

## Architecture Components

### SecretManager (`src/core/secretManager.ts`)
- Wrapper around VS Code Secret Storage API
- Provides secure CRUD operations for credentials
- Audit logging (without exposing sensitive data)

### ConnectionManager (`src/core/connectionManager.ts`)
- Separates connection metadata from credentials
- Validates all configurations before use
- Manages active connections with proper lifecycle

### Connection Providers (`src/providers/`)
- Each database type has a dedicated provider
- Implements secure connection patterns
- Proper error handling without exposing credentials

## Security Best Practices

### For Users
1. **Use SSL/TLS**: Always enable SSL for production databases
2. **Strong Passwords**: Use strong, unique passwords for each connection
3. **SSH Tunneling**: Use SSH tunnels when accessing databases over public networks
4. **Limit Permissions**: Create database users with minimum required permissions
5. **Regular Updates**: Keep the extension updated for security patches

### For Developers
1. **Never Log Credentials**: Ensure credentials are never logged
2. **Sanitize Inputs**: Always validate and sanitize user inputs
3. **Error Messages**: Error messages should not expose credential information
4. **Secure Dependencies**: Regularly audit and update npm dependencies
5. **Code Review**: Security-focused code reviews for all changes

## Audit Trail

The extension logs connection activities (without sensitive data):
- Connection attempts (success/failure)
- Configuration changes
- Credential storage operations

Logs can be viewed in VS Code's Output panel under "Database & Services Manager"

## Known Limitations

1. **Memory**: Credentials are temporarily in memory during active connections
2. **Extensions**: Other VS Code extensions could theoretically access workspace state (but not Secret Storage)
3. **Local Access**: Users with access to your computer can access stored credentials through VS Code

## Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Email security concerns to: [Your Security Email]
3. Include detailed steps to reproduce
4. Allow time for a fix before public disclosure

## Compliance

This extension follows security best practices for:
- OWASP Top 10 guidelines
- VS Code Extension Security Guidelines
- Database vendor security recommendations

## Future Enhancements

Planned security improvements:
- [ ] Two-factor authentication support
- [ ] Role-based access control
- [ ] Connection activity monitoring
- [ ] Integration with enterprise secret managers (HashiCorp Vault, AWS Secrets Manager)
- [ ] Certificate pinning for SSL connections
- [ ] Automatic credential rotation support

## License

This security documentation is part of the Database & Services Manager extension and is licensed under the MIT License.

---

Last Updated: December 31, 2025
