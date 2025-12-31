# VS Code Extension for Databases & Services

## Project Overview
A secure, open-source VS Code extension for managing connections to multiple databases and services:
- **Databases**: PostgreSQL, MySQL, SQLite, MongoDB, Neo4J, MariaDB
- **Services**: Redis, BullMQ, ELK Stack, SSH, Docker, SFTP, Kafka, RabbitMQ

## Security Principles
- Credentials stored using VS Code Secret Storage API
- No plaintext passwords in configuration files
- Support for SSH tunneling and encrypted connections
- Connection string validation and sanitization
- Optional password encryption at rest
- Clear audit trail for connection activities

## Architecture
- Modular connection providers for each database/service type
- Centralized credential manager using VS Code Secrets API
- Tree view for browsing connections and resources
- Command palette integration for quick actions
- Status bar indicators for active connections

## Development Guidelines
- TypeScript for type safety
- Follow VS Code extension best practices
- Comprehensive error handling
- Unit tests for critical components
- Security-first approach for credential handling
