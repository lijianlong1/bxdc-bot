## Why

需要开发一套新的 AI Agent 对话平台，替代现有实现。新系统采用更清晰的架构分层：frontend 作为纯前端界面层，skill-gateway 作为唯一后端服务层，agent-core 作为内部推理引擎。

核心目标是通过统一的服务入口（skill-gateway）简化系统交互，降低前后端耦合，同时为后续功能扩展（多租户、权限管理、审计追踪）奠定基础。

## What Changes

本项目为**全新开发**，不基于现有代码修改：

### 1. Frontend（全新开发）

- **技术栈**：Vue 3 + TypeScript + Vite + Element Plus
- **核心职责**：
  - 用户界面：对话窗口、消息展示、输入交互
  - 对话管理：左侧对话列表、新建/切换/删除对话
  - Skill 配置：对话级别的可用 Skill 选择
  - 实时流：SSE 接收并展示 AI 流式回复
  - 历史翻看：向上滚动加载历史消息
- **约束条件**：**只与 skill-gateway 交互**，不感知 agent-core 存在

### 2. Skill-gateway（全新开发）

- **技术栈**：Spring Boot 3 + Java 17 + MySQL 8 + JPA
- **核心职责**：
  - **统一入口**：所有外部请求（frontend、管理后台、OpenAPI）的唯一接收方
  - **会话管理**：对话生命周期管理（创建、查询、更新、删除）
  - **请求代理**：接收用户消息，转发至 agent-core，代理 SSE 响应
  - **Skill 管理**：Skill 的 CRUD、分类、可见性控制
  - **Skill 执行**：Built-in Skill 在 Java 层实现，Extension Skill 代理配置
  - **日志审计**：统一接收并持久化对话记录、工具调用记录
  - **数据存储**：所有业务数据（会话、Skill、日志）的持久化
- **约束条件**：**作为唯一对外服务**，agent-core 仅内部调用

### 3. Agent-core（保持不变）

- **现状**：现有 NestJS 实现继续使用
- **调整**：仅需调整部署配置，不直接对外暴露
- **职责**：专注 ReAct 循环和 LLM 交互

## Capabilities

### New Capabilities

- `frontend-new-dev`：基于 Vue 3 + TypeScript 的全新前端实现
- `skill-gateway-new-dev`：基于 Spring Boot 的全新后端实现
- `gateway-unified-entry`：统一入口架构（frontend 只调 gateway）
- `gateway-session-crud`：完整的对话会话管理
- `gateway-skill-execution`：Built-in 和 Extension Skill 统一执行
- `gateway-audit-system`：完善的审计日志系统
- `database-schema-new`：全新数据库设计（MySQL）

### Modified Capabilities

无（本项目为全新系统开发，非现有系统改造）

## Impact

- **人员**：需要前端开发人员（Vue 3）和后端开发人员（Spring Boot）
- **时间**：预计 2-3 个月完成 MVP 版本
- **依赖**：需要 agent-core 部署就绪（内部网络访问）
- **数据**：新系统数据库独立，历史数据可后续迁移或保留在旧系统
- **部署**：新域名/新路径，可独立上线，与旧系统并行运行（灰度切换）
