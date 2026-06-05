## 1. Java Skill Gateway 接口

- [x] 1.1 新增 Linux 脚本执行请求模型，定义 `serverId` 和 `command` 输入
- [x] 1.2 在 `SkillController` 中新增 built-in skill 端点，例如 `POST /api/skills/linux-script`
- [x] 1.3 复用 `SecurityFilterService` 对命令进行安全校验，并返回明确错误信息

## 2. 服务器映射与执行链路

- [x] 2.1 实现 `serverId` 到 SSH 连接配置的解析逻辑
- [x] 2.2 复用 `SSHExecutorService` 执行远程命令，并返回标准输出结果
- [x] 2.3 为未知 `serverId`、连接失败和命令执行失败增加明确错误处理

## 3. Agent 集成

- [x] 3.1 在 `backend/agent-core/src/tools/java-skills.ts` 中新增对应的 Java Tool
- [x] 3.2 将新 Tool 注册到 Agent 的 tools 列表中，使其成为 built-in skill
- [x] 3.3 补充测试或验证流程，确认 `serverId + command` 能成功返回脚本执行结果
