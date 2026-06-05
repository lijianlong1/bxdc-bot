# gateway-http-skill-outbound-audit Specification

## Purpose
TBD - created by archiving change gateway-audit-skill-ssh-telemetry. Update Purpose after archive.
## Requirements
### Requirement: HTTP 外呼审计行可关联扩展 Skill

对由 **agent-core 经扩展 Skill 执行路径** 触发的 **`POST /api/skills/api`**（及设计文档中认定为等价的 HTTP 代理入站）所产生的外呼审计行，系统 SHALL 在持久化时写入可查询的 **`skill_id`**（与 `skills` 表主键语义一致），**当且仅当** 入站请求提供了可解析的 Skill 标识（例如约定头 **`X-Skill-Id`** / `X-Extension-Skill-Id`，名以最终实现为准）。

在 **未** 提供该标识或无法解析时，`skill_id` **MAY** 为 `NULL`，**不得** 因本要求阻断外呼主流程。

**本阶段不** 要求对「**同一 HTTP 外呼** 同时挂 **多个** Skill 身份」单独建模；一行审计 **至多一个** `skill_id`（或空）。

**OPENCLAW** 编排内**实际触发**的 API 类扩展 Skill 外呼 **纳入** 本要求：`skill_id` MUST 为**当时被调用的那条** API 子 Skill 的 id（与主对话直调扩展 API 无区别），**不得** 强制写父级 OPENCLAW Skill id 作为替代（除非产品后续另定）。

#### Scenario: 扩展 API Skill 带 Skill 标识

- **WHEN** agent-core 在调用 `POST /api/skills/api` 时携带约定头，其值为某条 **EXTENSION** Skill 的数据库 id
- **THEN** 对应写入的 `gateway_outbound_audit_logs` 行 MUST 将该 id 持久化到 **`skill_id`**（或等价列名）中

#### Scenario: 非扩展或旧客户端

- **WHEN** 入站无 Skill 标识
- **THEN** `skill_id` MAY 为 `NULL`，且外呼 **MUST** 仍可完成

### Requirement: 持久化 agent 传入的 API 代理原始参数

对 **HTTP** 外呼审计，系统 SHALL 将 **agent-core 提交给 skill-gateway** 的 **API 代理请求**（即 `ApiRequest` 语义：`url`、`method`、`headers`、`body` 等）以 **结构化可检索** 形式落库（例如独立 **JSON** 列），其内容 MUST 与入站请求体在**业务语义上一致**（允许在存储前做与现有策略一致的敏感字段脱敏）。

#### Scenario: 审计可重放代理意图

- **WHEN** 运维根据某条审计行排查问题
- **THEN** 其 SHALL 能从库中读出 **当时** agent 期望 Gateway 代理的 `url` / `method` / `headers` / `body`（在脱敏与截断策略允许范围内），**不得** 仅依赖外呼后的归一化 URL 而丢失原始意图（若实现中同时存「归一化前后」，以设计为准）

### Requirement: 持久化外呼 HTTP 响应

对 **HTTP** 外呼审计，系统 SHALL 持久化 **远端 HTTP 响应** 的至少：**HTTP 状态码**、**响应头（可脱敏）**、**响应体**（支持按配置 **截断** 与 **哈希** 以控制体积）。

#### Scenario: 成功响应

- **WHEN** 外呼返回 2xx 且 body 可读
- **THEN** 审计行 MUST 记录 **状态码** 与 **响应体**（可截断），并 SHOULD 记录 **响应头**（敏感头脱敏）

#### Scenario: 失败响应

- **WHEN** 外呼返回非 2xx 或网络层失败但存在可解析的 HTTP 响应
- **THEN** 系统 MUST 仍 **尽量** 记录可得的状态码与响应体/错误信息，**不得** 仅写 `status=FAILURE` 而无可用细节（在实现允许范围内）

### Requirement: 出站请求报文完整性（与线路上真实外呼一致）

在 **HTTP** 外呼审计中，持久化到 `gateway_outbound_audit_logs` 的 **外呼侧** **请求地址、请求头、请求体** SHALL **直接对应**于 skill-gateway 在发起远端 HTTP 时 **实际使用** 的 `HttpRequest` / **实际发送的 body bytes**（经与现网一致的脱敏、截断、哈希配置后再入库），**不得** 将 **未经过同一发送路径** 的字段（例如仅从入站 `ApiRequest` DTO 在**另一层**重序列化）拼成一份与线路上**不一致** 的「仿造」报文并**冒充**为外呼真实报文。

若 URL 经 **`OutboundUrlNormalizer`**（或等价）在发送前被改写，审计中记录的 **请求地址** SHALL 为 **归一化后实际用于发送的 URI**（或同时明确存「归一化前/后」两列，由实现选定，**不得** 混用而不标注）。

`proxy_request_json` / 入站 `ApiRequest` 存「agent 意图」；`outbound_*` 存「**线上真实外呼**」；二者语义 **不得** 合并为单列以免误导。

#### Scenario: 与现有列兼容

- **WHEN** 系统升级后读取历史行
- **THEN** 旧行 **无** 新增列时 MUST 仍被应用与工具接受（可空 / 默认）

#### Scenario: OPENCLAW 内子 API 外呼

- **WHEN** OPENCLAW 子循环调用某扩展 **API** Skill 并导致与直调相同的外呼审计路径
- **THEN** 外呼报文 **仍然** 满足本 Requirement 的「线上一致」要求，**且** `skill_id` 指向 **该** API 子 Skill（见上一 Requirement）

