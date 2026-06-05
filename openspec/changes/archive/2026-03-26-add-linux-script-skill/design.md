## Context

当前 Java Skill Gateway 已经具备 `/api/skills/ssh` 接口和 `SSHExecutorService`，能够通过 SSH 连接执行远程命令。但这一能力面向的是底层连接参数输入，要求调用方提供 `host`、`username`、`privateKey` 等敏感信息。对于 built-in skill 场景，更合适的方式是让 Agent 只提交 `serverId` 和 `command`，再由 Java 服务端统一解析服务器配置并执行命令。

## Goals / Non-Goals

**Goals:**

- 新增一个 Java 实现的 built-in skill，用于执行 Linux 服务器脚本
- 输入仅包含 `serverId` 和 `command`
- 服务端根据 `serverId` 查找服务器连接配置，并复用现有 `SSHExecutorService`
- 执行结果以文本形式返回给 Agent
- 沿用现有安全策略，对危险命令进行拦截

**Non-Goals:**

- 不支持由 Agent 动态传入 SSH 凭证
- 不实现完整服务器管理后台，本阶段仅关注脚本执行 Skill
- 不支持长时间持续运行的交互式会话，仅支持一次命令执行并返回结果
- 不在本阶段处理复杂脚本上传、文件分发或批量多机执行

## Decisions

### 1. 接口形式：新增专用 built-in skill 端点

**决策**：在 Java Skill Gateway 中新增专用端点，例如 `POST /api/skills/linux-script`，请求体使用 `{ "serverId": "...", "command": "..." }`。

**理由**：这比继续复用 `/api/skills/ssh` 更适合作为 built-in skill 暴露给 Agent。接口语义更清晰，也避免把底层 SSH 参数暴露给上层调用方。

### 2. 服务器解析：由服务端维护 `serverId` 到连接配置的映射

**决策**：由 Java 服务端根据 `serverId` 解析出 `host`、`port`、`username`、`privateKey`。初始版本可以采用配置文件、环境变量或固定 registry 的方式实现。

**理由**：`serverId` 是稳定、可控的外部标识，便于审计和权限收敛。替代方案是让 Agent 直接传 SSH 参数，但这会带来安全风险，也不利于后续统一管理。

### 3. 执行链路：复用现有 `SSHExecutorService`

**决策**：新 Skill 仅新增参数解析与请求封装层，实际远程执行仍由 `SSHExecutorService` 完成。

**理由**：现有 Java 端已经具备 SSH 能力，复用可减少重复实现，并保持与现有 interface call 风格一致。

### 4. 安全策略：继续使用 `SecurityFilterService`

**决策**：对 `command` 执行与 `/api/skills/ssh` 相同的危险命令过滤，并继续要求 built-in skill 调用走现有 Token 鉴权链路。

**理由**：Linux 脚本执行是高风险能力，必须保持与现有 Java Skill Gateway 一致的安全边界。

### 5. Agent 集成：新增 Java Tool

**决策**：在 `backend/agent-core/src/tools/java-skills.ts` 中新增一个 Java Tool，描述该 built-in skill 的输入为 `serverId` 与 `command`，输出为脚本执行结果。

**理由**：与现有 `JavaApiTool`、`JavaSshTool` 的接入方式保持一致，Agent 易于识别和调用，也便于后续将该能力显示到 SkillHub 中。

## Risks / Trade-offs

- [风险] `serverId` 映射来源如果写死在代码中，后续扩展和运维会比较麻烦 → **缓解**：先定义统一的配置抽象，初版实现可以简单，后续可平滑切换到数据库或配置中心
- [风险] Linux 命令执行本身具备高权限风险 → **缓解**：继续使用命令黑名单过滤，并要求连接到受控服务器账号
- [风险] 单次命令执行超时或输出过大可能影响 Agent 响应 → **缓解**：限制超时时间与返回内容长度，并在失败时返回明确错误
- [风险] 与现有 `/api/skills/ssh` 能力存在部分重叠 → **缓解**：明确职责边界，`ssh` 用于底层直接调用，`linux-script` 用于 built-in skill 场景

## Migration Plan

- 新增端点与 Tool 后，不影响现有 `/api/skills/ssh` 和 `/api/skills/api`
- 先以增量方式接入 Agent Tool 列表，再逐步补充 SkillHub 展示与默认 Skill 元数据
- 若实现不符合预期，可仅回退新端点和对应 Tool，不影响现有 Java Skill Gateway 功能

## Open Questions

- `serverId` 的映射应优先放在配置文件、环境变量还是数据库中？
- `privateKey` 是否需要支持按 `serverId` 从本地文件路径读取，而不是直接写在配置值中？
- 是否需要对不同 `serverId` 配置不同的命令白名单或超时策略？
