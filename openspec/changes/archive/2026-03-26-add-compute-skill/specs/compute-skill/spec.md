## ADDED Requirements

### Requirement: 计算服务接口

系统 MUST 在 Java Skill Gateway 中暴露 `POST /api/skills/compute` 端点，接收结构化 JSON 请求并返回运算结果。

#### Scenario: 请求格式

- **WHEN** Agent 调用计算接口
- **THEN** 请求体为 `{ "operation": "<op>", "operands": [<values>] }`
- **AND** `operation` 为以下之一：`add`、`subtract`、`multiply`、`divide`、`factorial`、`square`、`sqrt`、`timestamp_to_date`
- **AND** `operands` 为数字或时间戳数组，数量与运算类型匹配

#### Scenario: 响应格式

- **WHEN** 计算成功
- **THEN** 返回 `{ "result": <value> }`，其中 `result` 为数字或 `YYYY-MM-DD` 字符串
- **AND** 错误时返回 `{ "error": "<message>" }`

### Requirement: 时间戳转日期

系统 MUST 支持将毫秒级 Unix 时间戳转换为 `YYYY-MM-DD` 格式日期字符串。

#### Scenario: 时间戳转日期

- **WHEN** `operation` 为 `timestamp_to_date` 且 `operands` 包含一个有效时间戳
- **THEN** 返回对应日期的 `YYYY-MM-DD` 字符串（按系统默认时区）

### Requirement: 四则运算

系统 MUST 支持加减乘除运算。

#### Scenario: 加减乘除

- **WHEN** `operation` 为 `add`、`subtract`、`multiply` 或 `divide`
- **THEN** `operands` 包含两个数字
- **AND** 返回运算结果（除法时除数为 0 返回错误）

### Requirement: 阶乘、平方、开方

系统 MUST 支持阶乘、平方与开方运算。

#### Scenario: 阶乘

- **WHEN** `operation` 为 `factorial` 且 `operands` 包含一个非负整数 n
- **THEN** 返回 n!（n 过大时返回错误）

#### Scenario: 平方

- **WHEN** `operation` 为 `square` 且 `operands` 包含一个数字
- **THEN** 返回该数字的平方

#### Scenario: 开方

- **WHEN** `operation` 为 `sqrt` 且 `operands` 包含一个非负数字
- **THEN** 返回其算术平方根（负数返回错误）

### Requirement: Agent 计算 Tool 描述

Agent MUST 在 tool 列表中包含计算 Skill 的描述，使 LLM 能识别并调用。

#### Scenario: Tool 注册

- **WHEN** Agent 初始化
- **THEN** `JavaComputeTool` 被注册到 tools 数组
- **AND** Tool 的 `description` 明确说明可执行时间戳转日期、加减乘除、阶乘、平方、开方

#### Scenario: 调用链路

- **WHEN** LLM 决定执行计算
- **THEN** 通过 `JavaComputeTool` 向 `{gateway}/api/skills/compute` 发送 POST 请求
- **AND** 请求头包含 `X-Agent-Token` 认证
