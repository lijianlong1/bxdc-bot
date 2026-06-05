## MODIFIED Requirements

### Requirement: 计算服务接口

系统 MUST 在 Java Skill Gateway 中暴露 `POST /api/skills/compute` 端点，接收结构化 JSON 请求并返回运算结果。

#### Scenario: 请求格式

- **WHEN** Agent 调用计算接口
- **THEN** 请求体为 `{ "operation": "<op>", "operands": [<values>] }`
- **AND** `operation` 为以下之一：`add`、`subtract`、`multiply`、`divide`、`factorial`、`square`、`sqrt`、`timestamp_to_date`、`date_diff_days`
- **AND** `operands` 为数字、时间戳或日期字符串数组，数量与运算类型匹配

#### Scenario: 响应格式

- **WHEN** 计算成功
- **THEN** 返回 `{ "result": <value> }`，其中 `result` 为数字或 `YYYY-MM-DD` 字符串
- **AND** 错误时返回 `{ "error": "<message>" }`

### Requirement: Agent 计算 Tool 描述

Agent MUST 在 tool 列表中包含计算 Skill 的描述，使 LLM 能识别并调用。

#### Scenario: Tool 注册

- **WHEN** Agent 初始化
- **THEN** `JavaComputeTool` 被注册到 tools 数组
- **AND** Tool 的 `description` 明确说明可执行时间戳转日期、日期差值、加减乘除、阶乘、平方、开方

#### Scenario: 调用链路

- **WHEN** LLM 决定执行计算
- **THEN** 通过 `JavaComputeTool` 向 `{gateway}/api/skills/compute` 发送 POST 请求
- **AND** 请求头包含 `X-Agent-Token` 认证

## ADDED Requirements

### Requirement: 日期差值计算

系统 MUST 支持计算两个日期之间相差的天数，用于生日倒计时等按日粒度的日期推导场景。

#### Scenario: 计算未来日期差值

- **WHEN** `operation` 为 `date_diff_days` 且 `operands` 包含两个有效的 `YYYY-MM-DD` 日期字符串
- **THEN** 返回第二个日期减去第一个日期后的天数差值
- **AND** 若第二个日期晚于第一个日期，则结果为非负整数

#### Scenario: 日期格式非法

- **WHEN** `operation` 为 `date_diff_days` 但任一输入不是有效日期字符串
- **THEN** 返回带有明确原因的错误
- **AND** 不返回误导性的默认数值
