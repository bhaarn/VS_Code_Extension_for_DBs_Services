# Database & Services Manager

A comprehensive VS Code extension for managing connections to multiple databases and services from a single, secure interface.

## ✨ Features

### 🔒 **Secure Credential Management**
- Credentials stored using VS Code Secret Storage API
- OS-level encryption (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- No plaintext passwords in configuration files
- SSH key authentication support

### 🗄️ **15 Integrated Services**

**Databases:**
- PostgreSQL
- MySQL / MariaDB
- SQLite
- MongoDB
- Neo4J
- Redis

**Message Queues & Streaming:**
- RabbitMQ
- Kafka
- BullMQ

**Infrastructure & DevOps:**
- Docker
- Elasticsearch
- SSH

**File Transfer:**
- FTP
- SFTP

### 🚀 **Key Capabilities**

- **Interactive Tree View**: Expandable categories showing databases, tables, collections, queues, containers, and more
- **Script Execution**: Run SQL, MongoDB Playground, Cypher, and Redis commands with execution timing
- **CRUD Operations**: Insert, update, delete data across all supported databases
- **Query History**: Automatic tracking of last 100 queries with re-run capability
- **Saved Queries**: Personal query library with folder organization
- **Query Templates & Snippets**: 10 pre-built templates with {{placeholder}} syntax and 15 VS Code snippets
- **Query Result Export**: Export results to CSV, JSON, or Excel formats
- **Connection Groups**: Organize connections into logical groups (Production, Development, etc.)
- **Favorites**: Star frequently used connections for quick access at the top
- **Export/Import v2.0**: Backup and restore connections with groups, favorites, and metadata
- **File Transfer**: Upload/download files and directories via FTP/SFTP
- **Neo4J Visualization**: Interactive graph visualization using vis-network
- **Advanced Docker Operations**: Start, stop, restart, remove containers/images/volumes/networks with Unix socket support
- **Message Queue Operations**: Publish/consume messages, manage queues and topics
- **SSH Command Execution**: Execute remote commands via SSH

## 📦 Installation

1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Type `ext install database-services-manager`
4. Press Enter

Or search for "Database & Services Manager" in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).

## 🎯 Quick Start

1. Click the Database & Services icon in the Activity Bar
2. Click "+" to add a new connection
3. Select your service type (PostgreSQL, MongoDB, Docker, etc.)
4. Enter connection details
5. Save and connect!

### Example Connection Strings

```
PostgreSQL:    postgres://user:pass@localhost:5432/mydb
MongoDB:       mongodb://user:pass@localhost:27017
MySQL:         mysql://user:pass@localhost:3306/mydb
Redis:         redis://localhost:6379
Docker:        http://localhost:2375
Elasticsearch: http://localhost:9200
RabbitMQ:      amqp://user:pass@localhost:5672
Kafka:         localhost:9092
SSH:           user@hostname:22
FTP:           ftp://user:pass@hostname:21
SFTP:          user@hostname:22
```

## 💡 Usage Examples

### Running SQL Queries
1. Right-click a database connection
2. Select "Run SQL Script"
3. Write your query and execute

### MongoDB Operations
1. Expand a MongoDB collection
2. Right-click and choose operations:
   - Insert Document
   - Update Document
   - Delete Document
   - Run MongoDB Playground

### Docker Management
1. Connect to Docker daemon
2. View containers, images, volumes, networks
3. Right-click for inspect, logs, stats

### File Transfer (FTP/SFTP)
1. Connect to FTP/SFTP server
2. Browse directories in tree view
3. Right-click files/folders:
   - Upload File/Directory
   - Download File/Directory
   - Create Directory
   - Delete

## 📚 Documentation

For detailed configuration, troubleshooting, and examples, see [USER_GUIDE.md](USER_GUIDE.md).

## 🔐 Security Best Practices

- Use read-only database users when possible
- Enable SSL/TLS connections where supported
- Use SSH tunneling for remote connections
- Rotate credentials regularly
- Avoid storing credentials in workspace settings
- Use connection-specific credentials, not admin accounts

## 🐛 Troubleshooting

### Connection Issues
- Verify service is running: `docker ps` or `systemctl status <service>`
- Check firewall rules and port accessibility
- Ensure correct credentials and connection string format
- For Docker: Enable TCP socket (port 2375)

### Native Module Errors
If you encounter sqlite3 or ssh2 errors:
```bash
npm rebuild sqlite3 --build-from-source
npm rebuild ssh2 --build-from-source
```

### Common Issues
- **"Cannot find module 'axios'"**: Run `npm install` in extension directory
- **MongoDB "failed to list databases"**: Ensure user has `listDatabases` permission
- **Neo4j encryption**: Use `neo4j+s://` for encrypted, `neo4j://` for unencrypted
- **Docker connection refused**: Enable Docker API on port 2375

For more troubleshooting, see [USER_GUIDE.md](USER_GUIDE.md).

## 🤝 Contributing

This is an open-source project. Contributions, issues, and feature requests are welcome!

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

For detailed help, see [USER_GUIDE.md](USER_GUIDE.md) or file an issue on GitHub.

## 📝 Release Notes

### 2.0.0 (Current - January 1, 2026)
Phase 3B features:
- **SSH Tunneling**: Secure database connections through SSH bastion hosts with password and private key authentication
- **Table Grid View**: Spreadsheet-like interface for viewing and editing table data with pagination
- **Connection Health Monitoring**: Test connection health with visual status indicators (🟢🟡🔴⚪)
- Bug fixes and performance improvements

### 1.1.0 (December 31, 2025)

Phase 3A features:
- **Query Result Export**: CSV, JSON, and Excel (.xlsx) export with buffer-based writing
- **Connection Groups and Favorites**: Organize connections with groups and star important ones
- **Query Templates and Snippets**: 10 pre-built templates with {{placeholder}} syntax, 15 VS Code snippets
- **Advanced Docker Operations**: Unix socket support, start/stop/restart/remove containers/images/volumes/networks
- **Enhanced Export/Import v2.0**: Includes groups, favorites, and metadata

### 1.0.0

Initial release with:
- 15 service providers (PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Neo4J, Redis, RabbitMQ, Kafka, BullMQ, SSH, Docker, Elasticsearch, FTP, SFTP)
- Secure credential storage using VS Code Secret Storage API
- Script execution support (SQL, MongoDB Playground, Cypher, Redis)
- CRUD operations for all databases
- File transfer capabilities (FTP/SFTP)
- Neo4J graph visualization
- Docker container and image management
- Elasticsearch index management
- Message queue operations (RabbitMQ, Kafka, BullMQ)
- SSH command execution
- Comprehensive documentation

See [CHANGELOG.md](CHANGELOG.md) for full release history.

---

**Enjoy seamless database and service management in VS Code!** 🎉

## Development

```bash
# Install dependencies
npm install

# Compile and watch for changes
npm run watch

# Run extension in development mode
Press F5 in VS Code
```

## Security

This extension prioritizes security:
- Uses VS Code Secret Storage API for credential management
- No credentials stored in workspace settings
- Support for encrypted connections
- Regular security audits

## Contributing

Contributions welcome! Please ensure:
- Security-first approach
- Comprehensive tests for new features
- Follow TypeScript best practices
- Update documentation

## License

MIT License

## Credits

Developed by Bharani Dharan Krishnaswamy. Inspired by various database clients but built with security as the primary focus.
