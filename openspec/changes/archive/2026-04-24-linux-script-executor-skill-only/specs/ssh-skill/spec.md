## REMOVED Requirements

### Requirement: SSH Skill 通过台账解析登录信息
**Reason**: Agent-facing「SSH Skill」as a distinct public contract is replaced by the single `linux-script-skill` + `linux_script_executor` path; gateway-internal SSH may remain but is not specified as a separate user-facing `ssh` skill in OpenSpec for the Agent.

**Migration**: Use `linux-script-skill` requirements and the `linux_script_executor` / `/api/skills/linux-script` flow; do not reintroduce `JavaSshTool` as a model-visible tool in normal sessions.

### Requirement: SSH Skill 仅可使用当前用户台账
**Reason**: Superseded by the same user-scoped ledger rules embedded in the Linux script execution and gateway resolution for `serverId`/`name`.

**Migration**: Enforce user scope in `linux-script` and server registry code paths; no separate `ssh-skill` requirement block.

### Requirement: 未登记服务器的错误处理
**Reason**: Same behavior is required under `linux-script-skill` illegal/unknown id scenarios.

**Migration**: See `linux-script-skill`「非法 serverId」/别名错误处理 scenarios.

### Requirement: SSH Skill 保留命令安全校验
**Reason**: Retained in spirit under `linux-script-skill`「安全命令过滤」; duplicate normative text removed from `ssh-skill` to avoid conflicting definitions.

**Migration**: All remote command entry points SHALL apply `SecurityFilterService` (or equivalent) per `linux-script-skill`.

### Requirement: SSH Skill User Confirmation
**Reason**: Confirmation for dangerous operations remains the responsibility of `skill-confirmation` / extended skill confirmation and gateway policies; the standalone heading under `ssh-skill` is removed to avoid implying a separate Agent `ssh` tool.

**Migration**: For CONFIG skills, use `requiresConfirmation` and existing interrupt UI; do not key off a distinct `ssh` skill name for Agent routing.

### Requirement: SSH Skill Server Name Support
**Reason**: Server name / alias support is defined under `linux-script-skill` and gateway resolution.

**Migration**: Use alias/`serverId` fields documented in `linux-script-skill` delta and `server-ledger-*` specs as applicable.
