## ADDED Requirements

### Requirement: 可配置的 API Skill HTTP 超时

系统 SHALL 支持在 Skill 的 `configuration`（`ExtendedSkillConfig`）中通过 `timeoutSeconds` 字段声明该 Skill 出站 HTTP 请求的最大等待秒数。

该超时值 MUST 同时应用于：
1. Agent Core 调用 Skill Gateway 的请求（axios 侧 `timeout` 参数）
2. Skill Gateway 向外部 API 发起的出站 HTTP 请求（`RestTemplate` 侧 `connectTimeout` + `readTimeout`）

当 `timeoutSeconds` 未设置时（`undefined`），系统 MUST 使用默认超时值（30 秒），SHALL NOT 引入新的超时行为影响已有 Skill。

#### Scenario: 已配置超时的 API Skill 在超时内返回

- **WHEN** 一个 API Skill 在 `configuration` 中设置了 `timeoutSeconds` 为 300（5 分钟）
- **AND** 上游 API 在 3 分钟内成功返回了响应
- **THEN** 系统 SHALL 正常将响应内容返回给 LLM
- **AND** 系统 MUST NOT 因为超时设置而中断请求或产生时间相关错误

#### Scenario: 已配置超时的 API Skill 超时时返回错误

- **WHEN** 一个 API Skill 设置了 `timeoutSeconds` 为 120
- **AND** 上游 API 在 120 秒内未返回响应
- **THEN** 系统 SHALL 中止 HTTP 请求
- **AND** 系统 MUST 向 LLM 返回结构化错误信息，包含超时事实、已配置的超时值以及"可联系管理员调整超时配置或检查上游服务状态"的提示
- **AND** Gateway MUST 记录该超时事件到审计日志

#### Scenario: 未配置超时的既有 Skill 行为不变

- **WHEN** 一个已有的 API Skill 在 `configuration` 中**未**设置 `timeoutSeconds`
- **AND** 该 Skill 在变更前即可正常工作
- **THEN** 系统 SHALL 对该 Skill 的 HTTP 请求应用默认超时（30 秒）
- **AND** 该 Skill 的调用行为 MUST 与变更前一致（30 秒为合理默认值，不影响绝大多数快速 API 调用）

#### Scenario: Gateway 侧的 RestTemplate 按请求应用超时

- **WHEN** Skill Gateway 的 `ApiProxyService` 向外部 API 发起 HTTP 出站请求
- **AND** 请求关联的 Skill 配置了 `timeoutSeconds`
- **THEN** Gateway MUST 为该次 HTTP 调用设置 connect timeout 和 read timeout，值均取 `timeoutSeconds` 秒
- **AND** Gateway MUST NOT 永久性地修改全局 `RestTemplate` 实例的超时设置，以免影响其他并发的不同超时配置的请求

### Requirement: timeoutSeconds 配置校验

系统 SHALL 在加载 API Skill 配置时校验 `timeoutSeconds` 的合法性。

#### Scenario: timeoutSeconds 最低值校验

- **WHEN** Skill `configuration` 中 `timeoutSeconds` 被设置为小于 1 的值
- **THEN** 系统 SHALL 将取值 clamp 到 1 秒，或回退为默认值 30 秒
- **AND** 系统 SHOULD 记录一条警告日志

#### Scenario: timeoutSeconds 上限校验

- **WHEN** Skill `configuration` 中 `timeoutSeconds` 被设置为大于 3600（1 小时）的值
- **AND** 该 Skill 未配置 `asyncPoll`
- **THEN** 系统 SHALL 将该值 clamp 到 3600 秒并记录警告日志
- **AND** 系统 SHOULD 在提示信息中建议用户为长时间运行的 API 配置 `asyncPoll`

#### Scenario: 异步模式下 timeoutSeconds 不作为总等待上限

- **WHEN** Skill `configuration` 中同时配置了 `timeoutSeconds` 和有效的 `asyncPoll`
- **THEN** `timeoutSeconds` SHALL 仅控制初始 API 调用的 HTTP 超时
- **AND** 总等待时间 MUST 由 `asyncPoll.maxWaitMs`（或 `asyncPoll.maxWaitSeconds`）控制
- **AND** `timeoutSeconds` 若超过 3600 仍 SHALL clamp 到 3600 作为初始请求的 HTTP 保护上限
