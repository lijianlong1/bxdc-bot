# frontend-tool-call-xml-mode Specification

## ADDED Requirements

### Requirement: 文本 tool_call 回退开关

聊天客户端 SHALL 提供用户可切换的选项（默认 **关闭**），用于启用「从正文 `<tool_call></tool_call>` 解析工具调用」模式；该选项状态 SHALL 在用户本地持久化（例如 `localStorage`），以便刷新后保持。

#### Scenario: 默认关闭

- **WHEN** 用户首次打开应用或未设置过该选项
- **THEN** 开关处于关闭状态
- **AND** 工具条目的推导方式与未实现本能力前一致（以结构化 `tool_calls` 为主）

#### Scenario: 开启后持久化

- **WHEN** 用户将开关设为开启并刷新页面
- **THEN** 开关仍为开启状态

### Requirement: 开启时从正文解析工具调用

当上述开关为 **开启** 且当前流式 assistant 消息中 **不存在** 可用的结构化 `tool_calls`（或等价字段为空）时，客户端 SHALL 从该消息的文本内容（`content` / 多段内容中的文本 / `text` 等现有提取路径）中截取 `<tool_call>` 与 `</tool_call>` 之间的片段，将片段解析为 JSON，并为其中每个工具调用生成与现有 `ToolInvocation` 类型兼容的条目（至少包含可展示的名称与参数）；解析失败时 SHALL 跳过该片段且不阻断消息渲染。

#### Scenario: 无结构化仅有标签时展示工具

- **WHEN** 开关开启且 chunk 中 assistant 消息无 `tool_calls` 但正文含合法 `<tool_call>...</tool_call>` JSON
- **THEN** 客户端 SHALL 在本轮 assistant 消息上展示对应工具调用轨迹（与现有 UI 形态一致）
- **AND** SHALL NOT 因解析标签而抛未捕获异常导致聊天崩溃

#### Scenario: 结构化与非结构化并存时优先结构化

- **WHEN** 开关开启且同一条消息同时存在非空结构化 `tool_calls` 与 `<tool_call>` 文本
- **THEN** 客户端 SHALL 使用结构化 `tool_calls` 作为工具条目来源
- **AND** SHALL NOT 对同一工具重复追加仅来自文本的副本（除非实现明确采用合并策略并在 design 中说明）
