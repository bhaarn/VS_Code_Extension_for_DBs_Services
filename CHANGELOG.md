# Change Log

All notable changes to the "Database & Services Manager" extension will be documented in this file.

## [1.1.0] - 2025-12-31

### Added
- **Query History**: Automatic tracking of last 100 executed queries with timestamps and execution times
  - Re-run queries directly from history
  - Delete individual queries
  - Support for all database types (SQL, MongoDB, Neo4J, Redis)
  - Persists across VS Code restarts
- **Saved Queries**: Personal query library with folder organization
  - Save frequently used queries with names and descriptions
  - Organize queries in folders
  - Execute saved queries against any compatible connection
  - Edit and delete saved queries
  - Folder deletion with "Delete All" or "Move to Root" options
- **Export/Import Connections**: Backup and restore connection configurations
  - Export with or without passwords
  - Password encryption using Base64 encoding
  - Import preserves all connection settings and credentials
- **Query Execution Timing**: All queries display execution time
  - Millisecond precision for quick queries
  - Second formatting for longer operations
  - Timing included in history and saved queries
- **Database Context Persistence**: Queries automatically include database context
  - MySQL/MariaDB: USE statements prepended
  - PostgreSQL: Database comments added
  - MongoDB: Database comments in queries
  - Context preserved across sessions
- **Neo4J Graph Visualization**: Enhanced visualization support
  - Available from query history
  - Available from saved queries
  - Available from direct execution
  - Interactive graph with vis-network
- **Query Result Export**: Export query results in multiple formats
  - CSV export with proper escaping
  - JSON export with formatting
  - Excel export (.xlsx) with buffer-based writing
  - Export from query history or direct results
- **Connection Groups and Favorites**: Organize connections efficiently
  - Create groups to categorize connections
  - Add/remove connections to groups
  - Mark connections as favorites with star icons
  - Tree view reorganized: Favorites → Groups → Connections
  - Enhanced export/import v2.0 with groups and favorites
- **Query Templates and Snippets**: Reusable query patterns
  - 10 pre-built templates (Users, Orders, Products, Analytics, etc.)
  - 15 VS Code snippets for common patterns
  - {{placeholder}} syntax for variable replacement
  - Template creation with connection and database context
  - SQL templates include USE statements (MySQL/MariaDB)
  - MongoDB templates include use commands
  - Custom template creation with connection selection
- **Advanced Docker Operations**: Complete container lifecycle management
  - Unix socket support (/var/run/docker.sock on macOS/Linux)
  - Start, stop, restart containers
  - Remove containers, images, volumes, networks
  - Inspect resources with detailed information
  - View container logs
  - Show all containers (running and stopped)

### Fixed
- MongoDB saved query execution with script format parsing
- MongoDB query history logging for all execution methods
- Export connections with passwords now properly encodes credentials
- MySQL database context preservation in saved queries
- Query history delete button now removes single items instead of clearing all
- Folder deletion in saved queries properly handles nested queries
- MySQL multi-statement query execution with USE statements
- SQLite multi-statement queries return correct results (last statement)
- Import connections with passwords properly stores credentials in SecretStorage
- Database context prompt when connection doesn't specify database
- Docker Unix socket connection on macOS and Linux
- Docker resource IDs for proper CRUD operations
- MongoDB use command execution in templates and queries
- Template database context for MongoDB connections

## [1.0.0] - 2025-12-30

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
