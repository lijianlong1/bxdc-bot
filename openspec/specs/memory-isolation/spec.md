# memory-isolation

## Purpose

定义用户记忆的按用户隔离存储、检索与管理，确保不同用户的记忆互不干扰。
## Requirements
### Requirement: 按用户存储记忆
系统 MUST 将所有用户记忆与关联的用户 ID 一起存储。在使用 `mem0` 服务时，MUST 通过 `userid` 参数确保记忆的隔离。

#### Scenario: 保存记忆
- **当** 系统提取新记忆（通过调用 `mem0` 的 `/madd` 接口）
- **那么** 它 MUST 传入当前活动的用户 ID
- **并且** `mem0` 服务确保该记忆仅属于该用户，不将其与其他用户关联

### Requirement: 按用户检索记忆
系统 MUST 仅检索属于当前已验证用户的记忆。在使用 `mem0` 服务时，MUST 通过 `/msearch` 接口的 `userid` 参数进行过滤。

#### Scenario: 搜索记忆
- **当** Agent 搜索相关上下文（通过调用 `mem0` 的 `/msearch` 接口）
- **那么** 它 MUST 传入当前活动的用户 ID
- **并且** `mem0` 服务仅返回匹配该用户 ID 的记忆
- **并且** 忽略来自其他用户的记忆

### Requirement: 按用户管理记忆

系统 MUST 允许用户仅删除自己的记忆。

#### Scenario: 删除记忆

- **当** 用户请求遗忘某事
- **那么** 系统仅从该用户的记忆存储中删除匹配条目

