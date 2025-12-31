# Change Log

All notable changes to the "Database & Services Manager" extension will be documented in this file.

## [1.0.0] - 2025-12-31

### Initial Release

#### Features
- **15 Service Providers**: PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Neo4J, Redis, RabbitMQ, Kafka, BullMQ, SSH, Docker, Elasticsearch, FTP, SFTP
- **Secure Credential Storage**: OS-level encryption using VS Code Secret Storage API
- **Interactive Tree View**: Expandable categories showing databases, collections, queues, containers, etc.
- **Script Execution**:
  - SQL scripts for PostgreSQL/MySQL/MariaDB/SQLite
  - MongoDB Playground scripts
  - Cypher scripts for Neo4J
  - Redis commands
  - Custom commands for all service providers
- **CRUD Operations**:
  - Insert, update, delete documents in MongoDB
  - Insert, update, delete rows in SQL databases
  - Job management for BullMQ
  - Message publishing/consuming for RabbitMQ
- **File Transfer**: FTP and SFTP support with upload/download for files and directories
- **Visualizations**: Neo4J graph visualization using vis-network
- **Docker Integration**: List and inspect containers, images, volumes, and networks
- **Elasticsearch Support**: Index management, search, and cluster operations
- **Message Queuing**: RabbitMQ and Kafka topic/queue management
- **SSH Command Execution**: Execute remote commands via SSH

#### Supported Services

**Databases:**
- PostgreSQL (port 5432)
- MySQL (port 3306)
- MariaDB (port 3306)
- SQLite (file-based)
- MongoDB (port 27017)
- Neo4J (port 7687)
- Redis (port 6379)

**Message Queues & Streaming:**
- RabbitMQ (port 5672)
- BullMQ (Redis-based)
- Kafka (port 9092)

**Infrastructure & DevOps:**
- Docker (port 2375)
- Elasticsearch (port 9200)
- SSH (port 22)

**File Transfer:**
- FTP (port 21)
- SFTP (port 22)

#### Security
- Credentials stored using VS Code Secret Storage API
- OS-level encryption (Keychain, Credential Manager, libsecret)
- No plaintext password storage
- SSH key authentication support

#### UI/UX
- Activity bar integration with custom icon
- Tree view with context menus
- Command palette integration
- Inline command buttons for quick actions
- Provider-specific context menus
- JSON result viewers
- Graph visualization for Neo4J

#### Documentation
- Comprehensive USER_GUIDE.md with examples
- Security best practices
- Troubleshooting guide
- Docker configuration examples
- FAQ section

## [Unreleased]

### Planned Features
- Export/Import connections
- Query history
- Saved queries/scripts
- Query execution time display
- Table data grid view
- Advanced Docker operations (start/stop/restart containers)
- RabbitMQ Management API integration
- SSH tunneling for database connections
- Direct file editing for FTP/SFTP
- Connection testing before save
- Connection groups/folders
- Multiple workspace support
