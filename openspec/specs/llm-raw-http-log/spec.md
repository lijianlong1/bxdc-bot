# llm-raw-http-log Specification

## Purpose

为 agent-core 中大模型 HTTP 调用提供 **可选的原始报文落盘** 能力，与现有 LangChain 结构化 LLM 日志互补；默认关闭以保证安全与性能。可写入本地 `llmOrg.log`，并可选择经 skill-gateway 持久化到数据库（见 `llm-org-audit-storage`）；agent-core 不直连业务库。

## Requirements

### Requirement: 原始 HTTP 交互可选落盘

当且仅当管理员通过配置的开关显式启用时，系统 SHALL 捕获经由主 Agent 所用 OpenAI 兼容客户端发往模型服务端的 HTTP 请求与响应内容，并通过**可配置的落盘方式**持久化可观测副本：**可选**写入固定日志文件 `logs/llmOrg.log`（相对于 agent-core 进程工作目录下的 `logs` 目录，与 `llm.log` 同级）；**可选**将结构化记录通过 HTTP 提交至 skill-gateway，由网关在数据库中持久化（见 `llm-org-audit-storage` 能力）。agent-core SHALL NOT 为上述目的直接连接业务数据库或执行 SQL。每条记录 SHALL 关联当前请求上下文中可用的 **用户标识**（例如 `context.userId`）与 **记录时间**（记录时间可由服务端在网关落库时生成；客户端时间若存在则仅作非权威参考），并 SHALL 与单次交互内的请求/响应保持可关联（例如 `correlationId`）。

#### Scenario: 开关关闭时不写入且不改变调用行为

- **WHEN** 原始 HTTP 日志开关处于关闭状态
- **THEN** 系统 SHALL NOT 创建或写入 `llmOrg.log` 中与该能力相关的记录
- **AND** 系统 SHALL NOT 向 skill-gateway 发送与该能力相关的审计载荷
- **AND** 大模型调用行为与启用前一致（不因包装 HTTP 客户端而引入可观测的功能性差异）

#### Scenario: 开关开启时记录请求与响应（本地文件）

- **WHEN** 原始 HTTP 日志开关处于开启状态且本地文件落盘已启用，且 agent-core 通过该客户端发起一次模型 HTTP 调用
- **THEN** 系统 SHALL 在 `llmOrg.log` 中记录该次交互的请求侧信息（至少包含目标 URL、HTTP 方法；请求体按实现策略记录）
- **AND** 系统 SHALL 在同一次交互中记录响应侧信息（至少包含 HTTP 状态；响应体按实现策略记录，流式响应不得破坏原有消费方对 body 的读取）

#### Scenario: 开关开启且启用远程持久化时经网关写库

- **WHEN** 原始 HTTP 日志开关处于开启状态且远程持久化开关处于开启状态，且 agent-core 通过该客户端发起一次模型 HTTP 调用
- **THEN** 系统 SHALL 向 skill-gateway 发送包含该次交互请求与响应信息的结构化记录，且记录中 SHALL 包含用户标识字段（若上下文存在）以及可与请求/响应配对的关联标识
- **AND** skill-gateway SHALL 将记录持久化到数据库并写入记录时间；agent-core SHALL NOT 直接访问该数据库

#### Scenario: 远程持久化失败不破坏主流程

- **WHEN** 远程持久化开启但 skill-gateway 不可用或返回错误
- **THEN** LLM 调用 SHALL 仍能完成；审计发送失败 SHALL NOT 作为阻塞性错误中断对话主路径

### Requirement: 开关为显式配置且默认关闭

原始 HTTP 报文记录能力 SHALL 由单一、明确的运行时配置项控制（例如环境变量），且默认值为关闭。

#### Scenario: 未配置时等价于关闭

- **WHEN** 管理员未设置该配置项或设置为关闭语义
- **THEN** 系统 SHALL 不启用原始 HTTP 报文落盘

#### Scenario: 仅在为真时启用

- **WHEN** 管理员将配置项设置为开启语义
- **THEN** 系统 SHALL 启用原始 HTTP 报文落盘

### Requirement: 敏感信息与体积风险在规范层可识别

规范 SHALL 将「完整 HTTP 体可能包含 API 密钥与用户数据」作为已知风险；实现 MUST 在默认推荐路径下对典型鉴权头或密钥字段采取脱敏或文档强制警示中的至少一种（具体脱敏规则由实现遵循 design 决策）。

#### Scenario: 文档告知风险

- **WHEN** 管理员阅读 agent-core 环境变量示例或部署说明
- **THEN** 其 SHALL 能识别该开关的含义、日志路径以及启用后可能落盘敏感信息的风险
