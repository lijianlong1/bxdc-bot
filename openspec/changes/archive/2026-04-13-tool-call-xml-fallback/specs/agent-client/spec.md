# agent-client Specification (delta)

## ADDED Requirements

### Requirement: XML tool_call 回退模式下的流式解析

当用户启用「从 `<tool_call>` 文本解析工具调用」的本地选项时，前端客户端 SHALL 在流式 SSE 处理路径中，在结构化 tool call 不可用或为空时，从 assistant 可见文本中提取工具调用信息以满足 `frontend-tool-call-xml-mode` 能力；当该选项关闭时，SHALL NOT 应用上述正文解析逻辑。

#### Scenario: 开关关闭不解析正文

- **WHEN** 用户未启用 XML 回退选项
- **THEN** 客户端 SHALL NOT 仅因正文中存在 `<tool_call>` 而新增工具条目（除非结构化字段已提供）

#### Scenario: 开关开启且仅正文有调用信息

- **WHEN** 用户已启用 XML 回退选项且当前 chunk 无结构化 tool call
- **AND** 正文中存在可解析的 `<tool_call>` 块
- **THEN** 客户端 SHALL 按 `frontend-tool-call-xml-mode` 解析并更新当前 assistant 消息上的 Tool/Skill 展示状态
