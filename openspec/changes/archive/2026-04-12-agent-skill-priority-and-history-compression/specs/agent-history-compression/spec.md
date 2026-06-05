## ADDED Requirements

### Requirement: 渐进披露载荷不出现在后续短期历史中

对于曾经在单轮或多轮对话中出现过的 **渐进披露**（Provisional）响应——包括但不限于工具或 assistant 正文中带有 `REQUIRE_PARAMETERS`、或以大块 `interfaceDescription` / `parameterContract` 等形式要求模型二次填参的内容——在组装传给 Agent 的 **短期 history**（与当前用户消息一并发送、用于延续会话的最近若干条消息）时，系统 SHALL **移除或替换为短占位**，SHALL NOT 将上述全文原样保留在后续轮次的 `history` 中。

#### Scenario: 后续轮次不再携带完整契约正文

- **WHEN** 上一轮 assistant/tool 曾返回渐进披露形态（含 `REQUIRE_PARAMETERS` 或等价 JSON）
- **AND** 用户随后在同一任务中继续对话
- **THEN** 传入 Agent 的 history 中 SHALL NOT 再包含未截断的 `parameterContract` / `interfaceDescription` 全文用于重复披露
- **AND** MAY 保留用户最终提交的参数摘要或短句说明

### Requirement: 保留已完成工具的执行结果摘要

在应用压缩时，系统 SHALL **保留**已完成工具调用的 **结果**（成功时的主要输出或失败时的一行错误摘要），以便模型在后续轮次能基于事实继续；压缩 SHALL NOT 把所有 tool 结果清空为无。

#### Scenario: 成功调用后仍有可用结果上下文

- **WHEN** 某轮扩展 Skill 已 `completed` 并返回业务结果
- **THEN** 后续 history 中 SHALL 仍包含该结果或经 `sanitize` 后的等效短文本
- **AND** SHALL NOT 仅保留披露说明书而丢失结果

### Requirement: 规范化发生点

History 压缩/规范化 **SHALL** 在 Agent Core 接收 `history` 后、进入 LangGraph 之前执行（服务端单一真相）；客户端 MAY 额外做幂等裁剪以降低载荷，但 SHALL NOT 与服务器规范化冲突导致重复删空。

#### Scenario: 网关直传仍被净化

- **WHEN** 客户端未裁剪而发送含大段披露的 history
- **THEN** Agent Core 仍 SHALL 应用同一套规范化规则
