# server-lookup-skill

## Purpose

提供 Agent 通过名称查找服务器的 built-in skill，返回台账主键 ID 供下游执行工具使用，不向模型泄露明文凭据。

## Requirements

### Requirement: Server Lookup Skill
The system SHALL provide a built-in skill `server-lookup` that allows the Agent to retrieve server connection details by name.

#### Scenario: Lookup server by name
- **WHEN** the Agent calls `server-lookup` with a valid server name
- **THEN** the system returns the server's IP, username, and other details

#### Scenario: Server not found
- **WHEN** the Agent calls `server-lookup` with a non-existent server name
- **THEN** the system returns an error message indicating the server was not found

### Requirement: Server Lookup Integration
The system SHALL integrate the `server-lookup` skill with the Agent's toolset.

#### Scenario: Agent uses server lookup
- **WHEN** the user asks to connect to a server by name
- **THEN** the Agent first calls `server-lookup` to get the IP, then uses the IP to connect via SSH
