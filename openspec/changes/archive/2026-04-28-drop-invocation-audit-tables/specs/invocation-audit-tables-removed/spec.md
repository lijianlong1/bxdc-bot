## ADDED Requirements

### Requirement: 不再提供两类 invocation 审计表

系统不得再创建、写入或依赖数据库表 `agent_core_invocation_audit_logs` 与 `user_skill_invocation_logs`；skill-gateway 代码库中不得保留针对上述表的持久化逻辑。

#### Scenario: 部署后库中表被移除

- **WHEN** 使用更新后的 skill-gateway 与 schema 脚本连接既有 MySQL 实例并完成初始化
- **THEN** 上述两张表不存在或已被删除，且应用启动与 Skill 相关接口不因缺失该表而失败

#### Scenario: 调用 agent-core 与 Skill 仍可用

- **WHEN** 客户端继续调用原有 agent-core 回调与 Skill 执行接口
- **THEN** 行为与未引入上述两表审计前一致（除不再写入这两张表外），且不引入新的强制审计依赖
