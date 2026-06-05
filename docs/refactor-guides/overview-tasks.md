# 整体任务计划

## 分工总览

| 角色 | 核心职责 | 主要模块 |
|------|----------|----------|
| **Frontend** | 用户界面、交互实现 | 对话界面、对话管理、Skill 选择、实时流展示 |
| **Backend (Skill-gateway)** | 业务逻辑、数据管理、代理转发 | 对话管理、Skill 管理、执行引擎、日志审计、鉴权安全 |
| **Agent-core** | 保持现状，微调配置 | ReAct 循环、LLM 交互、工具调用（改为调用 gateway） |

---

## Frontend 开发任务

### 1. 基础框架搭建
- 项目初始化（Vue 3 + TypeScript + Vite）
- 目录结构设计（api / components / stores / views / utils）
- 路由配置（Vue Router）
- 状态管理（Pinia）
- UI 组件库集成（Element Plus）
- HTTP 客户端封装（Axios + SSE）

### 2. 对话管理模块
- 对话列表组件（左侧边栏）
- 新建/删除/重命名对话
- 对话切换与状态保持
- 历史消息分页加载（向上滚动）

### 3. 聊天交互模块
- 消息列表展示（用户/助手/工具）
- 输入框组件（文本输入、发送）
- SSE 流式接收与展示（打字机效果）
- 消息角色区分样式

### 4. Skill 配置模块
- Skill 列表展示（分类筛选）
- 对话级 Skill 选择器（多选）
- Skill 详情弹窗

### 5. 确认流模块
- 确认弹窗组件
- 展示 Skill 名称、参数、风险说明
- 确认/取消操作

### 6. 鉴权模块
- 登录状态管理
- Token 自动注入请求头
- 登录页/路由守卫

---

## Backend (Skill-gateway) 开发任务

### 1. 基础框架搭建
- 项目初始化（Spring Boot + Java 17）
- 目录结构设计（controller/service/repository/entity/dto）
- 数据库连接配置（MySQL + JPA）
- 数据库迁移（Flyway）
- API 文档（SpringDoc）

### 2. 数据库模块
- 对话表（conversations）
- 消息表（conversation_messages）
- Skill 表（skills）
- Skill 分类表（skill_categories）
- 调用日志表（skill_invocation_logs）
- 审计日志表（user_audit_logs）

### 3. 对话管理模块
- 对话 CRUD 接口
- 消息历史查询（分页）
- 对话配置管理（启用 Skill 列表）

### 4. Agent 代理模块
- HTTP Client 配置（连接池、超时）
- 请求转发至 agent-core
- SSE 流代理（接收并转发）
- 会话上下文组装（历史消息 + 可用 Skill）

### 5. Skill 管理模块
- Skill CRUD 接口
- Skill 分类管理
- 权限过滤（公开/私有/内置）

### 6. Skill 执行引擎
- **Built-in 执行器**
  - api_caller（HTTP 请求）
  - compute（表达式计算）
  - ssh_executor（SSH 脚本）
- **Extension 执行器**
  - API 代理执行
  - Template 渲染
  - OPENCLAW 编排
- 执行路由（根据 skill 类型分发）

### 7. 确认流模块
- 确认请求生成与缓存
- 等待/响应机制
- 超时处理
- 确认提交接口

### 8. 日志审计模块
- 日志接收接口（供 agent-core 调用）
- 异步落库（对话记录、调用记录）
- 敏感信息脱敏
- 日志查询接口

### 9. 鉴权安全模块
- JWT 鉴权（Token 生成/验证）
- 接口权限控制
- 限流（用户级/全局）
- CORS 配置

### 10. 监控运维模块
- 性能指标暴露（Micrometer）
- 健康检查接口
- 日志结构化（JSON）

---

## Agent-core 调整任务

### 1. 调用方式调整
- 移除内置工具实现（api_caller、compute、ssh_executor）
- 改为 HTTP 调用 skill-gateway 的统一执行接口
- 配置 skill-gateway 地址

### 2. 日志上报调整
- 移除直接数据库写入
- 改为 HTTP 上报至 skill-gateway

### 3. 部署安全调整
- 配置仅监听内网地址
- 添加 IP 白名单（仅允许 skill-gateway）

---

## 依赖关系

```
Frontend ──────► Skill-gateway ──────► Agent-core
                    │
                    ├──► MySQL (数据)
                    └──► 外部服务 (SSH/API/运维平台)
```

**开发顺序建议**：
1. Frontend 和 Backend 基础框架可并行
2. Backend 数据库模块优先（为后续模块奠基）
3. Backend 对话管理完成后，Frontend 对话界面可联调
4. Backend 代理模块完成后，可与 Agent-core 联调
5. Skill 执行引擎完成后，端到端测试可开展
6. 确认流、日志、鉴权可并行开发
