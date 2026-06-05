# skill-ssh-invocation-audit

## Purpose

定义 **SSH 类 Skill**（含经 **`/api/skills/ssh`**、**`/api/skills/linux-script`** 等路径触发的远程 shell 执行）在 skill-gateway 侧的**专用审计表**应记录的内容：Skill、用户、agent 入参、网关解析后的执行参数、目标主机与执行结果，**不得** 持久化私钥或密码明文。

**OPENCLAW** 内**实际执行**的 **SSH/ linux-script 类** 子扩展 Skill 调用 **同样** 落本表；**`skill_id` 为当时触发的子 Skill**，与 `gateway-http-skill-outbound-audit` 对 OPENCLAW 子 API 的约定对称，**无需** 在本阶段为容器 Skill 再套一层必录规则。

## ADDED Requirements

### Requirement: 专用审计表存在且与 HTTP 外呼审计可区分

系统 SHALL 提供独立关系表（名称以设计为准，例如 `skill_ssh_invocation_audit_logs`）用于 **SSH 类 Skill 调用**审计，**不得** 仅依赖 `gateway_outbound_audit_logs` 的 `outbound_kind=SSH` 行作为唯一长期方案（允许**过渡双写**，见迁移策略）。

#### Scenario: 新写入落专用表

- **WHEN** 某次 **Skill 相关** SSH 执行完成（成功或失败）
- **THEN** 系统 SHALL 在专用表中插入 **至少一行** 审计记录（在审计子系统启用且未显式关闭的前提下）

### Requirement: 审计字段覆盖 Skill、用户与 agent 请求

专用表 **MUST** 包含以下语义（可映射为列或 JSON 子结构，名以设计为准）：

- **`skill_id`**：扩展 Skill 主键，**可空**（无关联时）。  
- **`user_id`**：执行用户（终端用户），与 `X-User-Id` / 认证解析规则 **一致**。  
- **`agent_request`**：agent-core 发往 skill-gateway 的 **原始请求参数**（例如 JSON body），**不得** 丢弃与排障相关的关键字段（在截断策略内）。

#### Scenario: 带 Skill 与用户的调用

- **WHEN** agent 提供 `X-User-Id` 与约定 `X-Skill-Id`（若适用）
- **THEN** 对应列 MUST 写入与入站一致的值

### Requirement: 执行参数与目标服务器

专用表 **MUST** 记录 **skill-gateway 实际用于建立 SSH 会话并执行** 的参数子集（如 **host**、**port**、**username**、**command**），**MUST NOT** 以明文存储 **privateKey**、**password** 等凭据；可存 **是否使用密钥/密码** 的枚举或哈希指纹（以设计为准）。

**目标服务器** MUST 可识别（如 `host:port` + 可选 **server ledger id**）。

#### Scenario: 合规不存密钥

- **WHEN** 请求体含私钥或密码字段
- **THEN** 审计持久化 MUST  strip 或替换为占位符，**不得** 完整原文落库

### Requirement: 执行结果

专用表 **MUST** 记录 **执行返回结果**（标准输出摘要、退出码或网关统一错误串，以实际实现为准），并 **MAY** 对过长内容截断 + 哈希。

#### Scenario: 失败路径

- **WHEN** SSH 执行失败（连接失败、认证失败、命令非零退出等）
- **THEN** 审计行 MUST 记录 **可诊断** 的失败原因字段（在不含秘密的前提下）
