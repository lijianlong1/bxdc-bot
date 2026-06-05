## ADDED Requirements

### Requirement: 统一对外（Outbound）审计持久化

系统必须将 skill-gateway 发起的每一次**对外**动作——无论是调用外部 HTTP API 还是执行 SSH 命令——持久化到**同一张**关系型审计表中，每次对外尝试对应一行。

#### Scenario: HTTP 对外调用被审计

- **WHEN** skill-gateway 代表某次 Skill 执行发送 HTTP 请求
- **THEN** 写入一条新的审计行，包含实际操作的用户身份、UTC 时间戳、目标 URL（或等价标识）、标识该行为 HTTP 的区分字段，以及对出站 HTTP 报文的忠实捕获（由 HTTP 客户端准备发送的 method、headers 与 body）

#### Scenario: SSH 对外执行被审计

- **WHEN** skill-gateway 代表某次 Skill 执行执行 SSH 命令
- **THEN** 写入一条新的审计行，包含实际操作的用户身份、UTC 时间戳、SSH 端点标识（host/port 或配置的目标键）、标识该行为 SSH 的区分字段，以及**实际执行的**完整命令字符串（不得仅为从部分字段拼接还原的摘要）

### Requirement: agent-core 原始入站报文关联

系统必须在每条对外审计行上保存触发该 Skill 执行的、来自 agent-core 的**原始入站请求**：使用 skill-gateway **实际收到的字节**（含 body 及策略允许范围内的 headers），使运维能够对比 agent-core 提交内容与对外 HTTP 或 SSH 内容，而无需依赖反序列化后的 DTO 再拼接。

#### Scenario: 关联标识串联原始请求与对外动作

- **WHEN** skill-gateway 接受来自 agent-core 的 Skill 调用
- **THEN** gateway 为该次调用分配或透传关联标识（correlation id），在该标识下捕获入站报文，并写入对外审计行时引用同一标识且包含已捕获的入站内容

#### Scenario: 入站捕获失败不丢弃对外审计

- **WHEN** 入站捕获失败但对外动作仍继续执行
- **THEN** 系统仍必须持久化对外的忠实捕获，并必须按约定编码将原始请求相关字段标为不完整（例如 null 加原因码）

### Requirement: 保真与可检测的截断

当在 HTTP 边界或入站边界可获得字节级一致捕获时，系统不得仅将基于业务对象拼接的日志字符串作为权威的出站或原始入站存储内容。若超过大小限制，系统必须以**可检测**的方式截断（显式标记及可选的内容哈希），不得静默丢弃超限事实。

#### Scenario: 超大负载处理

- **WHEN** 出站或原始入站负载超过配置的最大存储长度
- **THEN** 仍写入该行（含元数据与截断标记），且保留的字节必须为捕获内容的连续前缀（或文档约定的替代策略）

### Requirement: 每行必须具备用户身份

对于已认证的调用，系统必须在每条对外审计行上填写实际操作**用户**（或已认证的服务主体），且与授权所用的安全上下文一致。

#### Scenario: 已认证 Skill 执行

- **WHEN** 已认证调用方触发 Skill 并产生对外 HTTP 或 SSH 动作
- **THEN** 审计行的用户字段与该认证主体一致，且不得为静态占位值
