# llm-raw-http-log Specification

## Purpose

为 agent-core 中大模型 HTTP 调用提供 **可选的原始报文落盘** 能力，与现有 LangChain 结构化 LLM 日志互补；默认关闭以保证安全与性能。

## Requirements

### Requirement: 原始 HTTP 交互可选落盘

当且仅当管理员通过配置的开关显式启用时，系统 SHALL 将经由主 Agent 所用 OpenAI 兼容客户端发往模型服务端的 HTTP 请求与响应内容记录到固定日志文件 `logs/llmOrg.log`（相对于 agent-core 进程工作目录下的 `logs` 目录，与 `llm.log` 同级）。

#### Scenario: 开关关闭时不写入且不改变调用行为

- **WHEN** 原始 HTTP 日志开关处于关闭状态
- **THEN** 系统 SHALL NOT 创建或写入 `llmOrg.log` 中与该能力相关的记录
- **AND** 大模型调用行为与启用前一致（不因包装 HTTP 客户端而引入可观测的功能性差异）

#### Scenario: 开关开启时记录请求与响应

- **WHEN** 原始 HTTP 日志开关处于开启状态且 agent-core 通过该客户端发起一次模型 HTTP 调用
- **THEN** 系统 SHALL 在 `llmOrg.log` 中记录该次交互的请求侧信息（至少包含目标 URL、HTTP 方法；请求体按实现策略记录）
- **AND** 系统 SHALL 在同一次交互中记录响应侧信息（至少包含 HTTP 状态；响应体按实现策略记录，流式响应不得破坏原有消费方对 body 的读取）

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
