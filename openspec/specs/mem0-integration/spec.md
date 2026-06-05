# mem0-integration Specification

## Purpose
TBD - created by archiving change integrate-mem0-service. Update Purpose after archive.
## Requirements
### Requirement: 集成 mem0 服务进行记忆管理
系统 MUST 使用外部 `mem0` 服务（通过 HTTP API）来接管现有的本地 SQLite 记忆模式。

#### Scenario: 检索记忆
- **当** Agent 需要检索相关上下文时
- **那么** 系统 MUST 调用 `mem0` 服务的 `/msearch` 接口
- **并且** 传入 `sentence` (用户输入), `userid` (当前用户 ID) 和 `topk` (返回数量)
- **并且** 将返回的记忆内容注入到 Agent 的 Prompt 上下文中

#### Scenario: 存储记忆
- **当** Agent 完成一次对话回合后
- **那么** 系统 MUST 调用 `mem0` 服务的 `/madd` 接口
- **并且** 传入 `sentencein` (用户输入), `sentenceout` (系统回复) 和 `userid` (当前用户 ID)
- **并且** `mem0` 服务负责提取并持久化长短期记忆

