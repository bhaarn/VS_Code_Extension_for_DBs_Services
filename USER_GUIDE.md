# Database & Services Manager - User Guide

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Supported Services](#supported-services)
- [Configuration](#configuration)
- [Query Management](#query-management)
  - [Query History](#query-history)
  - [Saved Queries](#saved-queries)
  - [Query Templates and Snippets](#query-templates-and-snippets)
  - [Query Result Export](#query-result-export)
  - [Export & Import Connections](#export--import-connections)
- [Connection Organization](#connection-organization)
  - [Groups](#groups)
  - [Favorites](#favorites)
- [Usage Examples](#usage-examples)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

**Database & Services Manager** is a comprehensive VS Code extension that allows you to connect to and manage multiple databases and services from a single interface. It provides a secure, centralized way to interact with your infrastructure without leaving your development environment.

### Key Features
- ✅ **15+ Services Supported**: Databases, message queues, caching, containers, and more
- 🔒 **Secure Credential Storage**: Uses VS Code Secret Storage API (OS-level encryption)
- 📊 **Visual Interface**: Tree view with expandable categories and interactive commands
- 🐳 **Docker-Friendly**: Works with containerized services
- 🌐 **Remote Connections**: Connect to local or remote services
- 📝 **Script Execution**: Run queries, commands, and scripts directly from VS Code

---

## Installation

### From VS Code Marketplace (when published)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Database & Services Manager"
4. Click **Install**

### From Source
1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to launch Extension Development Host

---

## Getting Started

### 1. Open the Extension Panel
- Click the database icon in the Activity Bar (left sidebar)
- Or: View → Open View → Database & Services Manager

### 2. Add Your First Connection
1. Click the **"+"** button in the panel header
2. Select the service type (PostgreSQL, MySQL, MongoDB, etc.)
3. Enter connection details
4. Click **Connect**

### 3. Browse and Execute
- Expand connections to see databases, collections, queues, etc.
- Click on items to execute queries or commands
- Right-click for context menus with available actions

---

## Supported Services

### Databases
| Service | Icon | Default Port | Features |
|---------|------|--------------|----------|
| **PostgreSQL** | 🗄️ | 5432 | Tables, SQL scripts, CRUD operations |
| **MySQL** | 🗄️ | 3306 | Tables, SQL scripts, CRUD operations |
| **MariaDB** | 🗄️ | 3306 | Tables, SQL scripts, CRUD operations |
| **MongoDB** | 🗄️ | 27017 | Collections, MongoDB Playground, aggregations |
| **SQLite** | 🗄️ | File-based | Tables, SQL scripts, local databases |
| **Neo4J** | 🗄️ | 7687 | Cypher scripts, graph visualization |
| **Redis** | ⚡ | 6379 | Key operations, command execution |

### Message Queues & Streaming
| Service | Icon | Default Port | Features |
|---------|------|--------------|----------|
| **RabbitMQ** | 📥 | 5672 | Queues, exchanges, publish, consume |
| **BullMQ** | 📊 | 6379 (Redis) | Job queues, job management, queue stats |
| **Kafka** | 📡 | 9092 | Topics, produce, consume, describe |

### Infrastructure & DevOps
| Service | Icon | Default Port | Features |
|---------|------|--------------|----------|
| **Docker** | 🐳 | 2375 | Containers, images, volumes, networks |
| **Elasticsearch** | 🔍 | 9200 | Indices, search, indexing, cluster health |
| **SSH** | 💻 | 22 | Remote command execution |

### File Transfer
| Service | Icon | Default Port | Features |
|---------|------|--------------|----------|
| **FTP** | ☁️ | 21 | File browser, upload/download files & directories |
| **SFTP** | 🔗 | 22 | Secure file transfer, directory operations |

---

## Configuration

### PostgreSQL / MySQL / MariaDB

**Required Fields:**
```
Name: My Database
Host: localhost (or IP address)
Port: 5432 (PostgreSQL) / 3306 (MySQL/MariaDB)
Username: your_username
Password: your_password
```

**Optional:**
- Database: Specify a default database to connect to

**Connection String Format:**
```
postgresql://username:password@host:port/database
mysql://username:password@host:port/database
```

**Docker Example:**
```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=mypassword \
  -p 5432:5432 \
  postgres:15
```

---

### MongoDB

**Required Fields:**
```
Name: My MongoDB
Host: localhost
Port: 27017
Username: admin (if auth enabled)
Password: password (if auth enabled)
```

**Connection String:**
```
mongodb://username:password@host:port/database
```

**Docker Example:**
```bash
docker run -d --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -p 27017:27017 \
  mongo:7
```

**Commands:**
- **Insert Document**: Add single document to collection
- **Insert Multiple Documents**: Bulk insert with JSON array
- **Update Document**: Modify existing documents with filter
- **Delete Document**: Remove documents matching criteria
- **Run MongoDB Script**: Execute MongoDB Playground scripts

---

### SQLite

**Required Fields:**
```
Name: My SQLite DB
Database File: /path/to/database.db (or .sqlite, .sqlite3)
```

**Note:** SQLite is file-based and doesn't require host/port/credentials.

**Local File Example:**
```
/Users/username/data/myapp.db
/var/lib/myapp/database.sqlite
```

---

### Neo4J

**Required Fields:**
```
Name: My Graph DB
Host: localhost
Port: 7687
Username: neo4j
Password: your_password
```

**Connection Protocol:** `bolt://` or `neo4j://`

**Docker Example:**
```bash
docker run -d --name neo4j \
  -e NEO4J_AUTH=neo4j/mypassword \
  -p 7474:7474 -p 7687:7687 \
  neo4j:5
```

**Features:**
- **Cypher Scripts**: Run graph queries
- **Graph Visualization**: Interactive visual representation using vis-network
- **Node Labels & Relationships**: Browse graph structure

---

### Redis

**Required Fields:**
```
Name: My Redis
Host: localhost
Port: 6379
Password: (optional, if requirepass is set)
```

**Docker Example:**
```bash
docker run -d --name redis \
  -p 6379:6379 \
  redis:7 redis-server --requirepass mypassword
```

**Commands:**
```redis
GET mykey
SET mykey "myvalue"
HGETALL myhash
KEYS *
DEL mykey
```

---

### RabbitMQ

**Required Fields:**
```
Name: My RabbitMQ
Host: localhost
Port: 5672
Username: guest
Password: guest
```

**Docker Example:**
```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management
```

**Commands:**
```
queues                          # List queues (requires Management API)
publish myqueue Hello World     # Publish message to queue
consume myqueue 10              # Consume up to 10 messages
```

**Categories:**
- **Queues**: View and manage message queues
- **Exchanges**: View default exchanges (amq.direct, amq.fanout, etc.)

**Note:** For detailed queue listings, use RabbitMQ Management API (port 15672).

---

### BullMQ

**Required Fields:**
```
Name: My BullMQ
Host: localhost
Port: 6379 (Redis backend)
Password: (optional)
```

**Note:** BullMQ requires a Redis instance as its backend.

**Docker Example:**
```bash
# Start Redis for BullMQ
docker run -d --name redis-bullmq \
  -p 6379:6379 \
  redis:7
```

**Commands:**
```
queues                                      # List all queues
add_job myqueue {"data": "value"}          # Add job to queue
get_jobs myqueue waiting 10                # Get waiting jobs
get_jobs myqueue active 5                  # Get active jobs
queue_counts myqueue                       # Get queue statistics
```

**Job Statuses:** `waiting`, `active`, `completed`, `failed`, `delayed`, `paused`

---

### Kafka

**Required Fields:**
```
Name: My Kafka
Host: localhost
Port: 9092
```

**Optional:**
- SASL Username/Password for authentication

**Docker Example:**
```bash
docker run -d --name kafka \
  -p 9092:9092 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092 \
  apache/kafka:latest
```

**Commands:**
```
topics                                  # List all topics
create_topic mytopic 3 1               # Create topic (name, partitions, replication)
delete_topic mytopic                   # Delete topic
produce mytopic Hello World            # Produce message
describe_topic mytopic                 # Get topic details
```

---

### SSH

**Required Fields:**
```
Name: My SSH Server
Host: localhost or remote IP
Port: 22
Username: your_username
Password: your_password
```

**Optional:**
- Private Key: Path to SSH private key file

**macOS Local SSH Setup:**
1. System Settings → General → Sharing
2. Enable "Remote Login"
3. Use your Mac username and password

**Commands:**
```bash
pwd                 # Print working directory
ls -la ~            # List home directory
df -h               # Disk usage
whoami              # Current user
uname -a            # System information
ps aux              # Running processes
```

**Output:** Shows exit code, stdout, and stderr

---

### Docker

**Required Fields:**
```
Name: My Docker
Host: localhost
Port: 2375 (or 2376 for TLS)
```

**Enable Docker API:**

**macOS/Linux:**
```bash
# Edit Docker daemon config
sudo nano /etc/docker/daemon.json

# Add:
{
  "hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]
}

# Restart Docker
sudo systemctl restart docker
```

**Docker Desktop:**
- Docker Desktop → Settings → General → "Expose daemon on tcp://localhost:2375 without TLS"

**Commands:**
```
containers                      # List running containers
containers --all               # List all containers
images                         # List images
volumes                        # List volumes
networks                       # List networks
inspect container <id>         # Inspect container
logs <container_id>            # Get container logs
stats <container_id>           # Get container stats
```

**Categories:**
- **Containers**: View running and stopped containers
- **Images**: View Docker images
- **Volumes**: View Docker volumes
- **Networks**: View Docker networks

---

### Elasticsearch

**Required Fields:**
```
Name: My Elasticsearch
Host: localhost
Port: 9200
Username: (optional, if security enabled)
Password: (optional, if security enabled)
```

**Docker Example:**
```bash
docker run -d --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

**Commands:**
```
indices                                         # List all indices
cluster                                         # Cluster health
nodes                                           # Cluster nodes
create_index myindex                           # Create index
delete_index myindex                           # Delete index
index myindex {"field": "value"}               # Index document
search myindex                                 # Search all documents
search myindex {"query":{"match_all":{}}}     # Search with query
get myindex <doc_id>                          # Get document by ID
delete myindex <doc_id>                       # Delete document
mapping myindex                               # Get index mapping
stats myindex                                 # Get index statistics
```

**Categories:**
- **Indices**: View and manage indices
- **Cluster**: Cluster health and node information
- **Search**: Search operations

---

### FTP

**Required Fields:**
```
Name: My FTP Server
Host: ftp.example.com
Port: 21
Username: ftpuser
Password: ftppassword
```

**Features:**
- Graphical file browser
- Upload files
- Upload directories (recursive)
- Download files
- Download directories (recursive)
- Navigate subdirectories

**Docker FTP Server Example:**
```bash
docker run -d --name ftpd_server \
  -p 20:20 -p 21:21 -p 47400-47470:47400-47470 \
  -e USERS="ftpuser|ftppass" \
  -e ADDRESS=localhost \
  delfer/alpine-ftp-server
```

---

### SFTP

**Required Fields:**
```
Name: My SFTP Server
Host: sftp.example.com
Port: 22
Username: sftpuser
Password: sftppassword
```

**Optional:**
- Private Key: SSH private key path

**Features:**
- Secure file transfer
- Upload/download files and directories
- Directory navigation
- Same as FTP but encrypted

---

## Query Management

### Query History

The extension automatically tracks all executed queries, providing a complete history of your database interactions.

**Features:**
- 📝 **Automatic Tracking**: Last 100 queries are saved automatically
- ⏱️ **Execution Timing**: See how long each query took (milliseconds or seconds)
- 🔄 **Re-run Queries**: Execute any historical query again with one click
- 🗑️ **Delete Queries**: Remove individual queries from history
- 💾 **Persistent**: History survives VS Code restarts
- 🎯 **Database Context**: MySQL/MariaDB queries include USE statements, MongoDB includes database comments

**How to Use:**

1. **View Query History:**
   - Open the "Query History" panel in the Activity Bar
   - See list of recent queries with timestamps and execution times

2. **Re-run a Query:**
   - Click on any query in the history
   - The query executes automatically against the same connection
   - Results display in a new window
   - Neo4J queries show graph visualization

3. **Delete a Query:**
   - Right-click on a query
   - Select "Delete Query"
   - Or click the trash icon next to the query

**Query Format:**
```
✅ SELECT * FROM users                    (MySQL - 45ms)
✅ db.users.find({ active: true })       (MongoDB - 120ms)
✅ MATCH (n:Person) RETURN n             (Neo4J - 89ms)
❌ SELECT * FROM invalid_table           (MySQL - Error: Table not found)
```

**Database Context:**
- **MySQL/MariaDB**: Queries include `USE dbname;` statement
- **PostgreSQL**: Queries include `-- Database: dbname` comment
- **MongoDB**: Queries include `// Database: dbname` comment
- **Neo4J/Redis/Others**: No special context needed

---

### Saved Queries

Create a personal library of frequently used queries organized in folders.

**Features:**
- 📁 **Folder Organization**: Group related queries together
- 📝 **Named Queries**: Give queries descriptive names and descriptions
- 🔄 **Reusable**: Execute saved queries against any compatible connection
- ✏️ **Editable**: Update query text, name, or description anytime
- 🗑️ **Manageable**: Delete queries or entire folders
- 💾 **Database Context**: Automatically includes USE/SET statements for SQL databases

**How to Use:**

1. **Save a Query:**
   - Open Command Palette (Ctrl/Cmd+Shift+P)
   - Type "Save Query"
   - Enter query text (or select from active editor)
   - Provide:
     - **Name**: e.g., "Get Active Users"
     - **Description**: e.g., "Retrieves all active users from database"
     - **Folder**: Select existing or "(No folder)"
     - **Connection**: Select connection type or "(Any connection)"
   - For MySQL/MariaDB/PostgreSQL: Enter database name if not in connection config
   - Query is saved with database context automatically

2. **Create a Folder:**
   - Click the "Create Folder" button in Saved Queries panel
   - Enter folder name: e.g., "User Queries", "Reports", "Maintenance"

3. **Execute a Saved Query:**
   - Click on a saved query in the panel
   - If query is tied to a specific connection, it runs immediately
   - If query is generic, select which connection to use
   - Results display in a new window
   - Execution time is shown

4. **Edit a Saved Query:**
   - Right-click on the query
   - Select "Edit Query"
   - Modify name, description, or query text
   - Changes are saved immediately

5. **Delete a Query:**
   - Right-click on the query
   - Select "Delete Query"
   - Confirm deletion

6. **Delete a Folder:**
   - Right-click on the folder
   - Select "Delete Folder"
   - Choose action:
     - **Delete All**: Remove folder and all queries inside
     - **Move to Root**: Delete folder but keep queries at root level
     - **Cancel**: Keep everything

**Example Saved Queries:**

```sql
-- Name: Get Active Users
-- Description: Retrieves users with active status
-- Connection: MySQL - Production DB
USE mydb;
SELECT * FROM users WHERE active = true ORDER BY created_at DESC;
```

```javascript
// Name: Top Products
// Description: Get top 10 selling products
// Connection: MongoDB - E-commerce
// Database: shop
db.products.aggregate([
  { $match: { status: "active" } },
  { $sort: { sales: -1 } },
  { $limit: 10 }
])
```

```cypher
// Name: User Network
// Description: Visualize user connections
// Connection: Neo4J - Social Graph
MATCH (u:User)-[r:FOLLOWS]->(f:User)
WHERE u.name = "John"
RETURN u, r, f
```

**Database Context Handling:**
- **MySQL/MariaDB**: `USE dbname;` prepended automatically
- **PostgreSQL**: `-- Database: dbname` comment added
- **MongoDB**: `// Database: dbname` comment added
- **Queries without database**: Prompted to enter database name when saving
- **Queries with existing context**: No duplicate context added

---

### Export & Import Connections

Backup and restore your connection configurations for portability and backup.

**Features:**
- 💾 **Full Backup**: Export all connections at once
- 🔒 **Password Options**: Export with or without passwords
- 🔐 **Encryption**: Passwords encoded with Base64 for basic protection
- 📤 **Portable**: Move connections between machines or VS Code instances
- 📥 **Easy Restore**: Import connections with one command

**How to Export:**

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Type "Export Connections"
3. Choose password option:
   - **With Passwords**: Full backup including credentials (Base64 encoded)
   - **Without Passwords**: Connection configs only, no passwords
4. Choose save location
5. File saved as `connections_export_YYYYMMDD_HHMMSS.json`

**Export Format (with passwords):**
```json
{
  "version": "1.1.0",
  "exportDate": "2025-12-31T12:00:00.000Z",
  "includePasswords": true,
  "connections": [
    {
      "id": "conn_12345",
      "name": "Production MySQL",
      "type": "mysql",
      "host": "mysql.example.com",
      "port": 3306,
      "database": "myapp",
      "username": "admin",
      "password": "bXlwYXNzd29yZA==" // Base64 encoded
    }
  ]
}
```

**Export Format (without passwords):**
```json
{
  "version": "1.1.0",
  "exportDate": "2025-12-31T12:00:00.000Z",
  "includePasswords": false,
  "connections": [
    {
      "id": "conn_12345",
      "name": "Production MySQL",
      "type": "mysql",
      "host": "mysql.example.com",
      "port": 3306,
      "database": "myapp",
      "username": "admin"
      // No password field
    }
  ]
}
```

**How to Import:**

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Type "Import Connections"
3. Select the exported JSON file
4. Connections are imported:
   - **With passwords**: Credentials stored in SecretStorage automatically
   - **Without passwords**: Use "Edit Connection" to add credentials after import
5. Refresh the connection list to see imported connections

**Import Behavior:**
- ✅ Preserves all connection settings (host, port, database, etc.)
- ✅ Stores passwords securely in VS Code SecretStorage
- ✅ Handles duplicate names by keeping both
- ✅ Works across different machines and VS Code installations
- ⚠️ Existing connections are NOT overwritten

**Use Cases:**

1. **Backup**: Regularly export connections with passwords to secure location
2. **Team Sharing**: Export without passwords, share configs with team, they add their own credentials
3. **Migration**: Moving to new machine? Export from old, import to new
4. **Testing**: Export production configs, modify for dev/staging
5. **Disaster Recovery**: Keep exports as backups in case of VS Code issues

**Security Notes:**
- Passwords exported with Base64 encoding (NOT encryption)
- Do not commit exports with passwords to version control
- Use password manager for team password sharing
- Exported files without passwords are safe to share

---

### Query Templates and Snippets

Accelerate query development with reusable templates and snippets.

**Features:**
- 📝 **10 Pre-built Templates**: Common query patterns for Users, Orders, Products, Analytics, etc.
- 🎯 **Custom Templates**: Create your own reusable query patterns
- 🔄 **Variable Placeholders**: Use `{{placeholder}}` syntax for dynamic values
- 🗄️ **Database Context**: Templates automatically include USE statements or database commands
- 💡 **15 VS Code Snippets**: Quick insertion of common patterns
- 🔌 **Connection-Aware**: Templates remember which database they're for

**How to Create a Template:**

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Type "Create Query Template"
3. Select a base template or "Custom Template"
4. Select a connection (recommended for SQL databases)
5. Enter database name if not configured in connection
6. Enter template name and description
7. Choose folder (optional)

**Pre-built Templates:**

| Template | Description | Placeholders |
|----------|-------------|--------------|
| Users Query | Find users by criteria | `{{field}}`, `{{value}}` |
| Orders Query | Query orders with filters | `{{field}}`, `{{value}}` |
| Products Query | Search products | `{{field}}`, `{{value}}` |
| Analytics | Aggregate data with grouping | `{{table}}`, `{{field}}`, `{{date}}` |
| Join Query | Join multiple tables | `{{table1}}`, `{{table2}}`, `{{field}}` |
| Insert | Insert new records | `{{table}}`, `{{columns}}`, `{{values}}` |
| Update | Update existing records | `{{table}}`, `{{field}}`, `{{value}}`, `{{condition}}` |
| Delete | Delete with conditions | `{{table}}`, `{{condition}}` |
| MongoDB Find | MongoDB collection query | `{{collection}}`, `{{field}}`, `{{value}}` |
| MongoDB Aggregate | Aggregation pipeline | `{{collection}}`, `{{field}}` |

**Example Template with Placeholders:**

```sql
use myDatabase;
SELECT * FROM {{table}}
WHERE {{field}} = '{{value}}'
ORDER BY created_at DESC
LIMIT {{limit}};
```

**Executing a Template:**

1. Open "Saved Queries" panel
2. Find your template (marked with template icon)
3. Click to execute
4. Fill in placeholder values when prompted:
   - `table` → "users"
   - `field` → "status"
   - `value` → "active"
   - `limit` → "10"
5. Review generated query
6. Choose "Execute", "Edit", or "Cancel"

**VS Code Snippets:**

Type these prefixes in any SQL/MongoDB file and press Tab:

| Snippet | Description |
|---------|-------------|
| `sel` | SELECT statement |
| `ins` | INSERT statement |
| `upd` | UPDATE statement |
| `del` | DELETE statement |
| `join` | INNER JOIN |
| `leftjoin` | LEFT JOIN |
| `where` | WHERE clause |
| `orderby` | ORDER BY clause |
| `groupby` | GROUP BY clause |
| `mongofind` | MongoDB find query |
| `mongoagg` | MongoDB aggregate pipeline |
| `mongoupdate` | MongoDB update operation |
| `mongoinsert` | MongoDB insertOne |
| `mongodelete` | MongoDB deleteMany |
| `case` | SQL CASE statement |

**MongoDB Template Example:**

```javascript
use portal;
db.{{collection}}.find({ "{{field}}": "{{value}}" })
```

When executed with `collection=permissions`, `field=user`, `value=admin`:

```javascript
use portal;
db.permissions.find({ "user": "admin" })
```

---

### Query Result Export

Export query results to multiple formats for analysis or sharing.

**Supported Formats:**
- 📄 **CSV**: Comma-separated values with proper escaping
- 📋 **JSON**: Formatted JSON with indentation
- 📊 **Excel**: XLSX format with formatted columns

**How to Export:**

1. **From Query Execution:**
   - Execute any query
   - In the result view, click **"Export Results"**
   - Choose format (CSV, JSON, or Excel)
   - Select save location

2. **From Query History:**
   - Open "Query History" panel
   - Right-click on any executed query
   - Select **"Export Results"**
   - Choose format and location

**Export Features:**
- ✅ Handles large result sets efficiently
- ✅ Proper CSV escaping for commas and quotes
- ✅ Excel formatting with column headers
- ✅ UTF-8 encoding for international characters
- ✅ Buffer-based Excel writing for memory efficiency

**Example CSV Export:**
```csv
id,name,email,created_at
1,"John Doe","john@example.com","2025-01-15"
2,"Jane Smith","jane@example.com","2025-02-20"
```

**Example JSON Export:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2025-01-15"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "created_at": "2025-02-20"
  }
]
```

**Use Cases:**
- 📊 Import results into spreadsheet tools
- 📈 Create reports and visualizations
- 🔄 Share query results with non-technical stakeholders
- 💾 Archive query snapshots
- 📧 Email query results as attachments

---

## Connection Organization

### Groups

Organize connections into logical groups for better management.

**Features:**
- 📁 **Create Groups**: Categorize connections (e.g., Production, Development, Testing)
- 🔄 **Multi-Assignment**: Add connections to multiple groups
- 🗂️ **Tree Organization**: Groups appear in tree view with connections nested inside
- 📤 **Export/Import**: Groups included in connection export (v2.0)

**How to Use Groups:**

1. **Create a Group:**
   - Right-click in Connections Explorer
   - Select **"Create Group"**
   - Enter group name (e.g., "Production", "Development")

2. **Add Connection to Group:**
   - Right-click on a connection
   - Select **"Add to Group"**
   - Choose the group from the list

3. **Remove from Group:**
   - Right-click on a connection within a group
   - Select **"Remove from Group"**

4. **Delete a Group:**
   - Right-click on a group
   - Select **"Delete Group"**
   - Connections are not deleted, only the grouping

**Tree View Organization:**
```
⭐ Favorites
  └── Production MySQL
📁 Production
  ├── Production MySQL
  ├── Production MongoDB
  └── Production Redis
📁 Development
  ├── Local PostgreSQL
  └── Local MongoDB
📁 Connections
  └── Staging Database
```

### Favorites

Mark frequently used connections for quick access.

**Features:**
- ⭐ **Star Icon**: Visual indicator for favorite connections
- 🔝 **Top Position**: Favorites appear at the top of the tree
- 🚀 **Quick Access**: No scrolling through long connection lists
- 💾 **Persistent**: Favorites saved across sessions
- 📤 **Export/Import**: Favorites included in export

**How to Use Favorites:**

1. **Mark as Favorite:**
   - Right-click on any connection
   - Select **"Toggle Favorite"** (or click star icon)
   - Connection moves to Favorites section

2. **Remove from Favorites:**
   - Right-click on the connection
   - Select **"Toggle Favorite"** again
   - Connection returns to regular position

3. **Favorites Section:**
   - Always visible at the top of tree view
   - Contains all starred connections
   - Connections still appear in their groups

**Benefits:**
- ⚡ Instant access to most-used connections
- 🎯 Focus on current work without distraction
- 🔄 Easy switching between active projects
- 👥 Personal workflow optimization

---

## Usage Examples

### Database Operations

#### PostgreSQL/MySQL/MariaDB - Run SQL Script
1. Right-click on a **Table**
2. Select **"Run SQL Script"**
3. Write SQL in the editor:
```sql
SELECT * FROM users WHERE active = true;
```
4. Click **"Execute"**
5. View results in JSON format

#### MongoDB - Query Collection
1. Click on a **Collection** or right-click → **"Run MongoDB Script"**
2. Write MongoDB commands:
```javascript
db.users.find({ age: { $gt: 25 } })
db.users.insertOne({ name: "John", age: 30 })
db.users.updateMany({ status: "pending" }, { $set: { status: "active" } })
```
3. Click **"Execute"**

#### Neo4J - Cypher Query with Visualization
1. Right-click on a **Label**
2. Select **"Run Cypher Script"**
3. Write Cypher query:
```cypher
MATCH (n:Person)-[r:KNOWS]->(m:Person)
RETURN n, r, m
LIMIT 50
```
4. Click **"Execute"**
5. View graph visualization or JSON results

### Message Queue Operations

#### RabbitMQ - Publish and Consume
1. Expand **RabbitMQ** → **Queues**
2. Click on **"Queues"** or right-click → **"Run RabbitMQ Command"**
3. Publish message:
```
publish myqueue Hello from VS Code
```
4. Consume messages:
```
consume myqueue 5
```

#### BullMQ - Job Management
1. Expand **BullMQ** → **Queues**
2. Right-click → **"Run BullMQ Command"**
3. Add job:
```
add_job email-queue {"to": "user@example.com", "subject": "Welcome"}
```
4. View jobs:
```
get_jobs email-queue waiting 10
queue_counts email-queue
```

### Docker Operations

#### List Containers
1. Expand **Docker** → **Containers**
2. View all running containers
3. Right-click **Containers** → **"Run Docker Command"**
4. Execute:
```
containers --all
logs <container_name>
stats <container_id>
```

### File Transfer

#### FTP/SFTP - Upload/Download
1. Expand **FTP/SFTP** connection
2. Navigate directories
3. Right-click on directory:
   - **"Upload File"**: Select local file to upload
   - **"Upload Directory"**: Select local directory to upload recursively
   - **"Download File"**: Save remote file locally
   - **"Download"**: Download entire directory

---

## Security

### Credential Storage
- **OS-Level Encryption**: Uses VS Code Secret Storage API
- **No Plaintext Storage**: Passwords never stored in plain text
- **Keychain Integration**:
  - **macOS**: Keychain Access
  - **Windows**: Windows Credential Manager
  - **Linux**: libsecret (GNOME Keyring / KWallet)

### Connection Security
- **SSH Tunneling**: Supported for SSH and SFTP
- **TLS/SSL**: Supported for PostgreSQL, MySQL, MongoDB, Neo4J
- **Private Key Auth**: SSH and SFTP support key-based authentication
- **No External Dependencies**: All connections direct from VS Code

### Best Practices
1. ✅ Use strong passwords for all connections
2. ✅ Enable authentication on all services
3. ✅ Use SSH keys instead of passwords when possible
4. ✅ Use TLS/SSL for database connections
5. ✅ Restrict network access with firewalls
6. ✅ Use Docker networks for container-to-container communication
7. ✅ Never commit credentials to version control
8. ✅ Regularly rotate passwords and keys
9. ✅ Use read-only credentials when possible
10. ✅ Disable Remote Login on macOS when not needed

---

## Troubleshooting

### Connection Issues

#### "Connection refused" or "Cannot connect"

**Possible Causes:**
1. Service is not running
2. Wrong host/port
3. Firewall blocking connection
4. Service not listening on network interface

**Solutions:**
```bash
# Check if service is running
docker ps                           # For containerized services
sudo systemctl status postgresql    # For system services

# Check if port is open
netstat -an | grep <port>
lsof -i :<port>

# Test connection
telnet localhost <port>
curl http://localhost:<port>        # For HTTP services
```

#### "Authentication failed"

**Solutions:**
1. Verify username and password
2. Check if authentication is enabled
3. Ensure user has necessary permissions
4. For MongoDB, check authentication database

#### "Provider not available"

**Solution:** Provider may not be fully loaded. Try:
1. Reload VS Code window (Cmd/Ctrl + R)
2. Check Output panel for errors
3. Ensure all npm dependencies are installed: `npm install`

### Docker Connection Issues

#### "Cannot connect to Docker daemon"

**Solution:**
```bash
# Check Docker is running
docker ps

# Enable Docker API (macOS/Linux)
# Edit /etc/docker/daemon.json
{
  "hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]
}

# Restart Docker
sudo systemctl restart docker
```

**Docker Desktop:** Enable "Expose daemon on tcp://localhost:2375"

### Database-Specific Issues

#### SQLite: "Could not locate the bindings file"

**Solution:**
```bash
# Rebuild sqlite3 from source
npm rebuild sqlite3 --build-from-source
```

#### MongoDB: "Authentication failed"

**Solution:**
- Check authentication database (usually `admin`)
- Ensure user exists: `db.createUser({user: "admin", pwd: "password", roles: ["root"]})`

#### Neo4J: "Failed to establish connection"

**Solution:**
- Verify Bolt protocol port (7687, not 7474 HTTP port)
- Check if encryption is required: Add `encryption: 'ENCRYPTION_OFF'` if disabled

#### PostgreSQL/MySQL: "SSL connection required"

**Solution:**
- Add `ssl: true` to connection config
- Or disable SSL requirement on server

### Performance Issues

#### "Slow query execution"

**Solutions:**
1. Check database indexes
2. Optimize queries
3. Increase connection timeout
4. Check network latency for remote connections

#### "Extension slow to load"

**Solutions:**
1. Reduce number of active connections
2. Close unused connections
3. Restart VS Code
4. Check for extension updates

### Native Module Issues

#### "Module did not self-register" or "binding.node" errors

**Solution:**
```bash
# Rebuild native modules
npm rebuild

# For specific modules
npm rebuild sqlite3 --build-from-source
npm rebuild ssh2 --build-from-source
```

---

## FAQ

### General Questions

**Q: Can I connect to remote servers?**  
A: Yes! Just use the remote server's IP address or hostname in the Host field.

**Q: Can I use services running in Docker containers?**  
A: Absolutely! Use `localhost` as the host and the mapped port (e.g., `-p 5432:5432`).

**Q: How many connections can I have?**  
A: Unlimited. You can add as many connections as needed.

**Q: Are my credentials safe?**  
A: Yes. All credentials are stored using VS Code's Secret Storage API, which uses OS-level encryption (Keychain, Credential Manager, libsecret).

**Q: Can I export/import connections?**  
A: Currently, connections are stored in VS Code workspace state. You can back up your VS Code settings.

**Q: Does this work on Windows/Linux/macOS?**  
A: Yes! The extension is cross-platform and works on all VS Code supported platforms.

### Database Questions

**Q: Can I run transactions?**  
A: Yes, for PostgreSQL/MySQL/MariaDB, you can run transaction blocks in SQL scripts:
```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

**Q: How do I create a new database?**  
A: Use the SQL script execution:
```sql
CREATE DATABASE mydb;
```

**Q: Can I see query execution time?**  
A: Currently, the extension shows results but not execution time. This may be added in future versions.

### Service Questions

**Q: How do I test RabbitMQ without Management API?**  
A: You can still publish and consume messages using the extension commands. The Management API is only needed for detailed queue listings.

**Q: Can I produce to Kafka with key and partition?**  
A: Currently, the extension supports simple message production. Advanced options may be added in future versions.

**Q: How do I see BullMQ job details?**  
A: Use the `get_jobs` command with the queue name and status to see job data and metadata.

### Docker Questions

**Q: Do I need Docker CLI installed?**  
A: No, the extension connects directly to the Docker API via HTTP.

**Q: Can I start/stop containers?**  
A: Currently, the extension supports listing and inspecting. Start/stop functionality may be added in future versions.

**Q: Does this work with Docker Desktop?**  
A: Yes! Just enable "Expose daemon on tcp://localhost:2375" in Docker Desktop settings.

### SSH Questions

**Q: Can I use SSH key authentication?**  
A: Yes! Provide the path to your private key file when adding the connection.

**Q: How do I use SSH tunneling for databases?**  
A: Currently, you can use SSH to execute commands. For database tunneling, consider using `ssh -L` in a terminal first.

**Q: Can I transfer files via SSH?**  
A: Not directly through SSH provider. Use the SFTP provider for file transfers.

### File Transfer Questions

**Q: Can I edit files directly?**  
A: Currently, you can download files and edit them locally. Direct editing may be added in future versions.

**Q: What's the maximum file size?**  
A: Depends on your network and service configuration. Large files may take time to transfer.

**Q: Can I upload multiple files at once?**  
A: Use the "Upload Directory" feature to upload entire folders recursively.

---

## Keyboard Shortcuts

Currently, the extension doesn't define custom keyboard shortcuts, but you can use standard VS Code shortcuts:

- **Ctrl/Cmd + Shift + P**: Open Command Palette
- **Ctrl/Cmd + R**: Reload Window
- **Ctrl/Cmd + Shift + E**: Focus on Explorer
- **F5**: Refresh current view

---

## Support & Contribution

### Report Issues
If you encounter any bugs or have feature requests, please report them on the GitHub repository.

### Feature Requests
We welcome feature suggestions! Please open an issue with:
- Clear description of the feature
- Use case / why it's needed
- Example of how it would work

### Contributing
Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Version History

### Current Version (1.1.0)
- ✅ 15+ service providers
- ✅ Secure credential storage
- ✅ Tree view with expandable categories
- ✅ Script execution for databases
- ✅ File transfer for FTP/SFTP
- ✅ Neo4J graph visualization
- ✅ Docker and Elasticsearch support
- ✅ Query history (last 100 queries)
- ✅ Saved queries with folder organization
- ✅ Export/Import connections
- ✅ Query execution timing
- ✅ Query result export (CSV, JSON, Excel)
- ✅ Connection groups and favorites
- ✅ Query templates and snippets (10 pre-built + 15 VS Code snippets)
- ✅ Advanced Docker operations (start/stop/restart/remove containers/images/volumes/networks)

### Planned Features
- [ ] Table data grid view with inline editing
- [ ] RabbitMQ Management API integration
- [ ] SSH tunneling for databases
- [ ] Direct file editing for FTP/SFTP
- [ ] Database schema comparison
- [ ] Automatic query formatting
- [ ] Multi-connection query execution
- [ ] Query performance profiling and optimization suggestions
- [ ] Connection health monitoring and alerts

---

## License

This extension is open-source and available under the MIT License. See LICENSE file for details.

---

## Credits

Developed with ❤️ for the VS Code community.

Built using:
- VS Code Extension API
- TypeScript
- Native database drivers (pg, mysql2, mongodb, neo4j-driver, etc.)
- vis-network for graph visualization
- Various npm packages for service integrations

---

**Thank you for using Database & Services Manager!**

For questions or support, please visit the GitHub repository.
