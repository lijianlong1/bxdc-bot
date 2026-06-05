## 1. 环境准备与基础设置

- [ ] 1.1 创建 skill-gateway 新模块结构（controller/service/repository/entity）
- [ ] 1.2 配置数据库连接（MySQL）
- [ ] 1.3 添加 JPA/Hibernate 依赖和配置
- [ ] 1.4 创建数据库迁移脚本（Flyway/Liquibase），包含所有新表
- [ ] 1.5 配置 skill-gateway 内部网络访问 agent-core（HTTP client）

## 2. 阶段 1：请求代理实现（前端统一入口）

- [ ] 2.1 实现 `POST /api/v1/conversations/:id/run` 接口
  - [ ] 2.1.1 创建 AgentProxyService，负责转发请求至 agent-core
  - [ ] 2.1.2 实现 SSE 流代理（接收 agent-core 事件，转发给前端）
  - [ ] 2.1.3 添加请求头传递（X-Conversation-Id, X-User-Id）
- [ ] 2.2 实现基础鉴权中间件（验证用户身份）
- [ ] 2.3 frontend 调整：将请求地址改为 skill-gateway
  - [ ] 2.3.1 移除 agent-core 相关配置
  - [ ] 2.3.2 统一使用 skill-gateway 地址
- [ ] 2.4 联调测试：验证 SSE 流正常传输
- [ ] 2.5 部署验证：确认代理链路延迟可接受

## 3. 阶段 2：会话管理实现（对话 CRUD）

- [ ] 3.1 数据库表实现
  - [ ] 3.1.1 创建 Conversation 实体和 Repository
  - [ ] 3.1.2 创建 ConversationMessage 实体和 Repository
  - [ ] 3.1.3 添加数据库索引优化查询
- [ ] 3.2 API 实现：对话管理
  - [ ] 3.2.1 `POST /api/v1/conversations` - 创建对话
  - [ ] 3.2.2 `GET /api/v1/conversations` - 查询对话列表（分页）
  - [ ] 3.2.3 `GET /api/v1/conversations/:id` - 获取对话详情和历史
  - [ ] 3.2.4 `PUT /api/v1/conversations/:id` - 更新对话配置
  - [ ] 3.2.5 `DELETE /api/v1/conversations/:id` - 删除对话（软删除）
- [ ] 3.3 实现对话历史查询服务（分页加载，支持往上翻看）
- [ ] 3.4 frontend 接入新接口
  - [ ] 3.4.1 左侧对话列表组件（类似 DeepSeek）
  - [ ] 3.4.2 对话创建/删除/重命名功能
  - [ ] 3.4.3 历史消息分页加载
- [ ] 3.5 联调测试：完整对话生命周期

## 4. 阶段 3：日志统一实现（审计日志）

- [ ] 4.1 数据库表实现
  - [ ] 4.1.1 创建 SkillInvocationLog 实体和 Repository
  - [ ] 4.1.2 创建 UserAuditLog 实体和 Repository
- [ ] 4.2 skill-gateway 实现日志接收接口
  - [ ] 4.2.1 `POST /internal/logs/conversation` - 接收对话日志
  - [ ] 4.2.2 `POST /internal/logs/skill-invocation` - 接收 Skill 调用日志
- [ ] 4.3 实现异步日志落库（避免阻塞主流程）
- [ ] 4.4 agent-core 调整：修改日志上报路径
  - [ ] 4.4.1 移除直接数据库写入代码
  - [ ] 4.4.2 改为 HTTP 上报至 skill-gateway
- [ ] 4.5 实现日志查询接口（供管理后台使用）

## 5. 阶段 4：Built-in Skill 下沉（Java 实现）

- [ ] 5.1 设计 Built-in Skill 执行框架
  - [ ] 5.1.1 创建 `SkillExecutor` 接口
  - [ ] 5.1.2 创建 `BuiltinSkillExecutionService`
  - [ ] 5.1.3 设计 Skill 注册机制（Spring Bean 自动注册）
- [ ] 5.2 实现 api_caller（API 调用）
  - [ ] 5.2.1 实现 HTTP 请求组装和执行
  - [ ] 5.2.2 支持 GET/POST/PUT/DELETE 方法
  - [ ] 5.2.3 支持 header、query、body 参数映射
- [ ] 5.3 实现 compute（计算）
  - [ ] 5.3.1 实现表达式计算引擎
  - [ ] 5.3.2 支持数学运算、字符串处理
- [ ] 5.4 实现 ssh_executor（SSH 执行）
  - [ ] 5.4.1 集成 SSH 客户端库（如 JSch）
  - [ ] 5.4.2 实现服务器台账查询
  - [ ] 5.4.3 实现固化脚本执行（限制命令白名单）
  - [ ] 5.4.4 添加危险命令确认流（与 confirmation 模块集成）
- [ ] 5.5 实现 Skill 统一执行接口
  - [ ] 5.5.1 `POST /api/v1/skills/:skillId/execute`
  - [ ] 5.5.2 区分 built-in 和 extension，路由到不同执行器
- [ ] 5.6 agent-core 调整：移除内置工具实现
  - [ ] 5.6.1 移除 `JavaApiTool`、`JavaComputeTool`、`JavaSshTool` 实现
  - [ ] 5.6.2 改为 HTTP 调用 skill-gateway 的统一执行接口
  - [ ] 5.6.3 保持工具名称不变，确保兼容性
- [ ] 5.7 回归测试：验证所有 built-in skill 功能正常
- [ ] 5.8 性能测试：确保下沉后性能不下降

## 6. 阶段 5：数据迁移与 Skill Hub 统一

- [ ] 6.1 Skill Hub 数据从数据库获取
  - [ ] 6.1.1 实现 `SkillRepository` 查询所有 Skill（built-in + extension）
  - [ ] 6.1.2 实现 `GET /api/v1/skills` 接口，统一返回所有可用 Skill
  - [ ] 6.1.3 根据用户权限过滤（自己的 + 公开的 + 内置）
- [ ] 6.2 built-in skill 数据初始化
  - [ ] 6.2.1 创建数据库种子脚本，插入 built-in skill 元数据
  - [ ] 6.2.2 配置 `kind=builtin`，与 extension 区分
- [ ] 6.3 agent-core 调整 Skill 加载
  - [ ] 6.3.1 从 skill-gateway 拉取所有 Skill（不再区分 built-in/extension）
  - [ ] 6.3.2 统一注册为可调用的工具
- [ ] 6.4 联调测试：验证 Skill 发现和调用正常

## 7. 阶段 6：安全加固与部署优化

- [ ] 7.1 agent-core 安全加固
  - [ ] 7.1.1 配置仅监听内网地址（如 127.0.0.1 或内部 VPC）
  - [ ] 7.1.2 添加 IP 白名单，仅允许 skill-gateway 访问
  - [ ] 7.1.3 移除或禁用原对外暴露的端口和接口
- [ ] 7.2 skill-gateway 安全增强
  - [ ] 7.2.1 实现 JWT 鉴权中间件
  - [ ] 7.2.2 实现请求限流（Rate Limiting）
  - [ ] 7.2.3 添加敏感参数脱敏（密码、Token 等）
- [ ] 7.3 frontend 清理
  - [ ] 7.3.1 移除所有直连 agent-core 的代码和配置
  - [ ] 7.3.2 更新环境变量配置（只保留 skill-gateway 地址）
- [ ] 7.4 部署配置更新
  - [ ] 7.4.1 更新 Docker Compose 配置（网络隔离）
  - [ ] 7.4.2 更新 Kubernetes YAML（Service、NetworkPolicy）
  - [ ] 7.4.3 更新 Nginx/网关配置（路由规则）

## 8. 监控与运维

- [ ] 8.1 添加监控指标
  - [ ] 8.1.1 skill-gateway 请求量、延迟、错误率
  - [ ] 8.1.2 agent-core 代理请求延迟
  - [ ] 8.1.3 数据库连接池监控
- [ ] 8.2 配置告警规则
  - [ ] 8.2.1 高延迟告警
  - [ ] 8.2.2 错误率告警
  - [ ] 8.2.3 数据库连接池耗尽告警
- [ ] 8.3 日志聚合配置
  - [ ] 8.3.1 配置日志收集（ELK 或 Loki）
  - [ ] 8.3.2 配置链路追踪（可选）

## 9. 文档与交付

- [ ] 9.1 更新 API 文档
  - [ ] 9.1.1 skill-gateway 对外 API 文档（OpenAPI/Swagger）
  - [ ] 9.1.2 skill-gateway 与 agent-core 内部 API 文档
- [ ] 9.2 更新部署文档
  - [ ] 9.2.1 新的部署架构图
  - [ ] 9.2.2 环境变量配置说明
  - [ ] 9.2.3 数据库迁移指南
- [ ] 9.3 更新开发人员文档
  - [ ] 9.3.1 新的开发流程（frontend 只调 skill-gateway）
  - [ ] 9.3.2 新增 Skill 开发指南（Java 层）
  - [ ] 9.3.3 调试和排障指南
- [ ] 9.4 编写迁移手册
  - [ ] 9.4.1 现有环境迁移步骤
  - [ ] 9.4.2 数据迁移脚本使用说明
  - [ ] 9.4.3 回滚方案

## 10. 验收测试

- [ ] 10.1 功能验收
  - [ ] 10.1.1 所有用户故事场景验证（6 个故事）
  - [ ] 10.1.2 多对话管理验证
  - [ ] 10.1.3 Skill 生成工具验证
  - [ ] 10.1.4 运行时确认功能验证
- [ ] 10.2 性能验收
  - [ ] 10.2.1 端到端延迟测试（< 3s 首字返回）
  - [ ] 10.2.2 并发用户测试（100 并发）
  - [ ] 10.2.3 数据库性能测试（分页查询 < 200ms）
- [ ] 10.3 安全验收
  - [ ] 10.3.1 agent-core 无法从公网访问
  - [ ] 10.3.2 鉴权绕过测试（未授权访问被拒绝）
  - [ ] 10.3.3 敏感数据泄露测试（日志中无密码）

---

## 附录：技术栈参考

### skill-gateway（Java）
- **框架**：Spring Boot 3.2.x
- **JDK**：Java 17
- **数据库**：MySQL 8.0
- **ORM**：Spring Data JPA
- **迁移**：Flyway
- **文档**：SpringDoc OpenAPI

### frontend（保持现有）
- **框架**：Vue 3
- **语言**：TypeScript
- **构建**：Vite

### agent-core（保持现有，仅调整部署）
- **框架**：NestJS
- **语言**：TypeScript
- **运行环境**：Node.js 18

---

## 风险与回滚

| 阶段 | 风险 | 回滚方案 |
|------|------|----------|
| 阶段 1 | SSE 代理异常 | 切回 frontend 直连 agent-core |
| 阶段 2 | 对话历史查询慢 | 回退到不查询历史，或增加缓存 |
| 阶段 4 | built-in skill 功能异常 | agent-core 恢复内置实现，回滚 Java 代码 |
| 阶段 6 | 数据迁移异常 | 使用备份恢复，或双写期过渡 |

---

## 预估工时

| 阶段 | 预估工时 | 主要工作 |
|------|----------|----------|
| 阶段 1 | 2 周 | 代理层实现、frontend 切换 |
| 阶段 2 | 2 周 | 会话管理、数据库设计、frontend 组件 |
| 阶段 3 | 1 周 | 日志接收、异步落库、agent-core 调整 |
| 阶段 4 | 3 周 | built-in 下沉、回归测试 |
| 阶段 5 | 1 周 | 数据迁移、Skill Hub 统一 |
| 阶段 6 | 1 周 | 安全加固、部署优化 |
| 阶段 7-10 | 2 周 | 监控、文档、验收 |
| **总计** | **12 周** | 约 3 个月（含缓冲）|
