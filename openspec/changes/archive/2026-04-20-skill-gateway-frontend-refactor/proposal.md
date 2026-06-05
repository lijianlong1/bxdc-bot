## Why

当前架构中 frontend 需要同时维护与 agent-core 和 skill-gateway 的连接，调用链路复杂且存在安全风险。同时 built-in skill 的实现分散在 Node.js (agent-core) 和 Java (skill-gateway) 两层，导致维护成本高、扩展困难。

本次重构旨在统一架构入口，由 skill-gateway 作为唯一对外服务层，frontend 仅需与 skill-gateway 交互；将 built-in skill 实现下沉至 Java 层，使 agent-core 专注于 ReAct 推理逻辑，所有 skill 调用通过 skill-gateway 代理。

## What Changes

- **frontend 重构**
  - 移除与 agent-core 的直接连接，所有请求统一发送至 skill-gateway
  - 对话管理、历史记录查询等由 skill-gateway 提供 API
  - SSE 流改为从 skill-gateway 接收（skill-gateway 代理 agent-core 的事件流）

- **skill-gateway 重构**
  - 新增会话管理模块：负责对话创建、历史记录、配置管理
  - 新增请求代理模块：接收前端请求，转发至 agent-core，返回 SSE 流
  - 新增统一日志模块：接收 agent-core 上报，写入数据库
  - built-in skill 实现迁移：将原 agent-core 中的内置工具实现下沉至 Java 层
  - 数据表设计：完成 skill、conversation、audit_log 等核心表设计

- **agent-core 调整**
  - 保持 ReAct 循环和 LLM 交互逻辑不变
  - 内置工具改为调用 skill-gateway（与扩展 skill 相同方式）
  - 通过 HTTP 上报日志至 skill-gateway
  - **不直接对外暴露端口**（仅接受来自 skill-gateway 的请求）

- **数据层统一**
  - skill-hub 数据全部从数据库获取（MySQL）
  - 用户对话历史、审计日志统一由 skill-gateway 管理

## Capabilities

### New Capabilities

- `frontend-gateway-unified`: frontend 统一通过 skill-gateway 交互，移除直连 agent-core
- `gateway-session-management`: skill-gateway 管理对话会话、历史记录
- `gateway-request-proxy`: skill-gateway 代理前端请求至 agent-core
- `gateway-audit-logging`: skill-gateway 统一接收并落库审计日志
- `builtin-skill-java-impl`: built-in skill 在 Java 层实现，与扩展 skill 统一调用方式
- `database-schema-refactor`: 重构数据库表结构，支持会话、skill、日志等核心实体

### Modified Capabilities

无（本次为纯重构，不改变现有功能行为，仅调整实现架构）

## Impact

- **代码**：frontend（请求路径调整、API 变更）、skill-gateway（新增模块、built-in 实现下沉）、agent-core（移除内置工具实现，改为调用网关）
- **数据库**：新增/调整 conversations、conversation_history、skill_invocation_logs 等表
- **部署**：skill-gateway 成为唯一对外入口，需配置更高可用性；agent-core 可部署在内部网络，不直接对外
- **运维**：需更新前端配置（指向 skill-gateway）；需迁移现有 built-in skill 逻辑至 Java
- **依赖**：frontend 不再依赖 agent-core 地址；agent-core 需配置 skill-gateway 地址
