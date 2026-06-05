## ADDED Requirements

### Requirement: skill-gateway 提供 LLM 原始 HTTP 审计写入 API

skill-gateway SHALL 暴露经认证的 HTTP API，用于接收来自 agent-core 的 LLM 原始 HTTP 审计记录，并将记录持久化到应用数据库。持久化 SHALL 仅发生在 skill-gateway 进程内；agent-core SHALL NOT 通过本能力直接连接该数据库。

#### Scenario: 合法调用方提交单条记录后落库

- **WHEN** 请求携带与现有网关一致的 API Token 校验通过，且请求体为符合约定 schema 的单条或批量审计记录（含 `direction`、关联标识、HTTP 元数据及脱敏后的 body 或截断字段）
- **THEN** 系统 SHALL 将记录写入 `llm_http_audit_log`（或设计文档中最终表名）对应行，且每条记录 SHALL 包含数据库生成的 **记录时间**（`recorded_at` 或等价列）以及请求中给出的 **用户标识**（`user_id`，允许为空时存 NULL）

#### Scenario: 未授权调用被拒绝

- **WHEN** 请求未通过 API Token 校验
- **THEN** 系统 SHALL NOT 插入审计记录，并返回与现有安全策略一致的 HTTP 错误响应

### Requirement: 审计表支持按用户与时间检索

数据库表 SHALL 为 **用户标识** 与 **记录时间** 提供可查询的列（例如 `user_id`、`recorded_at`），并 SHALL 具备主键或唯一标识列以便排重与关联（例如 `correlation_id` 与 `direction` 组合，由设计确定）。

#### Scenario: 运维按用户筛选

- **WHEN** 管理员在数据库或后续查询接口中按 `user_id` 过滤
- **THEN** 其 SHALL 能获得该用户的审计行集合
