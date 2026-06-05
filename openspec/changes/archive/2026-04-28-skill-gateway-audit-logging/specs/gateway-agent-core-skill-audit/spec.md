## ADDED Requirements

### Requirement: 经 skill-gateway 落库的 agent-core Skill 调用审计

对于执行路径中会**调用 agent-core**（回调或往返）的 Skill，系统必须将审计记录通过 **skill-gateway** 持久化到可靠数据库中。

#### Scenario: 调用 agent-core 成功时记录

- **WHEN** skill-gateway 中某 Skill 执行路径调用 agent-core 并收到成功响应
- **THEN** 系统写入一行，包含实际操作用户、UTC 时间戳、Skill 名称（或稳定的 Skill 标识）、gateway 观测到的发往 Skill/agent-core 的参数负载，以及 agent-core 返回的 response body 或结构化结果

#### Scenario: 调用 agent-core 失败时记录

- **WHEN** 某 Skill 执行路径调用 agent-core 收到错误响应或发生传输层异常
- **THEN** 系统写入一行，包含相同的身份类字段，并捕获错误信息（若适用则含 HTTP status，以及按约定安全编码后的 error body 或异常消息）

### Requirement: Skill 参数与结果的完整性

系统记录 Skill **入参**与**输出/结果**时必须达到足以支撑排障还原的保真度：存储值必须是 gateway 与 agent-core 之间 hop 上**实际发送/接收**的序列化形式（或原始 HTTP 报文捕获），不得仅为字段的近似字符串拼接。

#### Scenario: 往返负载保真

- **WHEN** gateway 为某 Skill 向 agent-core 转发 JSON（或其他格式）负载
- **THEN** 审计行的请求与响应负载列中包含 gateway 实际发出与接收的同一字节序列（受与其他审计表相同的截断与脱敏规则约束）

### Requirement: 与用户及时间的绑定

每一行 agent-core Skill 调用审计记录必须包含 Skill 运行时的**用户**，以及调用**完成或失败**时刻的 **UTC 时间**。

#### Scenario: 时间戳可排序查询

- **WHEN** 同一用户发生多次调用
- **THEN** 每行时间戳反映真实完成时刻，并适用于按时间范围查询
