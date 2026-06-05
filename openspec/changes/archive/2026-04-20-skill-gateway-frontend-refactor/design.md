## Context

### 当前架构问题

```
当前架构：
┌─────────┐     ┌─────────────┐
│ frontend│────►│ agent-core  │
└─────────┘     └──────┬──────┘
                       │
                       │ 部分调用
                       ▼
                ┌─────────────┐
                │skill-gateway│
                └─────────────┘
```

问题：
1. frontend 需同时维护两个后端连接（agent-core 和 skill-gateway）
2. 会话管理分散在 frontend 和 agent-core 中
3. built-in skill 实现在 agent-core（Node.js），与扩展 skill（Java）分离
4. 日志记录由 agent-core 直接处理或分散存储

### 目标架构

```
目标架构：
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ frontend│────►│skill-gateway│────►│ agent-core  │
└─────────┘     └──────┬──────┘     └─────────────┘
                       │
                       ├─ 会话管理
                       ├─ 请求代理
                       ├─ 日志落库
                       └─ Skill 执行（含 built-in）
```

改进：
1. frontend 只需连接 skill-gateway（单一入口）
2. skill-gateway 统一负责会话、代理、日志、Skill 执行
3. agent-core 专注 ReAct 推理，所有工具调用通过 skill-gateway
4. built-in skill 下沉至 Java 层，与扩展 skill 统一

---

## Goals / Non-Goals

**Goals:**

1. **统一入口**：skill-gateway 成为系统唯一对外服务，frontend 不直连 agent-core
2. **会话上移**：对话创建、历史查询、配置管理等由 skill-gateway 负责
3. **请求代理**：skill-gateway 接收前端请求，转发至 agent-core，代理 SSE 流返回
4. **日志统一**：skill-gateway 统一接收并落库用户对话记录、工具调用记录
5. **Skill 下沉**：built-in skill 实现从 agent-core 迁移至 skill-gateway（Java），agent-core 通过统一方式调用
6. **数据统一**：skill-hub 所有数据从数据库获取，不依赖本地文件或硬编码

**Non-Goals:**

1. **不改动 agent-core 的 ReAct 核心逻辑**：保持 LLM 交互、推理循环不变
2. **不改 LLM 模型选择策略**：保持现有的模型配置和选型逻辑
3. **不引入新的记忆服务**：保持现有 mem0 服务调用方式
4. **不做实时协作/多人在线编辑**：保持单人对话模式
5. **不做复杂权限 RBAC**：保持现有的简单鉴权机制

---

## Decisions

### 1. Frontend 与 skill-gateway 的交互方式

**决策**：所有前端请求统一发送至 skill-gateway，包括对话运行、历史查询、配置管理等。

**API 设计**：
```
POST /api/v1/conversations          - 创建新对话
GET  /api/v1/conversations          - 查询用户的对话列表
GET  /api/v1/conversations/:id      - 获取对话详情和历史记录
PUT  /api/v1/conversations/:id      - 更新对话配置（可用 Skill 列表）
DELETE /api/v1/conversations/:id    - 删除对话

POST /api/v1/conversations/:id/run  - 发送消息，启动 SSE 流
  - 请求体：{ message: string, context?: object }
  - 返回：SSE 流（代理自 agent-core）

GET  /api/v1/skills                 - 查询可用 Skill 列表（根据用户权限过滤）
GET  /api/v1/skills/:id             - 获取 Skill 详情
```

**为何这样设计**：
- skill-gateway 作为 BFF（Backend for Frontend），统一处理会话状态和鉴权
- 前端无需感知 agent-core 的存在，降低复杂度
- skill-gateway 可以在代理过程中插入日志记录、限流、审计等横切面功能

### 2. Skill-gateway 与 agent-core 的交互方式

**决策**：skill-gateway 通过 HTTP 调用 agent-core，使用 SSE 接收流式响应。

**内部 API 设计**：
```
POST /internal/agent/run  - 启动对话运行
  - 请求头：X-Conversation-Id, X-User-Id, X-Skill-Config
  - 请求体：{ message: string, history: Message[], skills: Skill[] }
  - 返回：SSE 流（Thought → Action → Observation → ... → Final）
```

**为何这样设计**：
- agent-core 作为内部服务，不对外暴露，仅接受来自 skill-gateway 的请求
- 通过 HTTP SSE 实现流式响应，与前端体验一致
- X-Skill-Config 头部传递当前对话的可用 Skill 列表和配置

### 3. Built-in skill 下沉至 Java 层

**决策**：将原 agent-core 中的内置工具（api_caller、compute、ssh_executor 等）迁移至 skill-gateway 实现。

**迁移方式**：
- 在 skill-gateway 中创建 `BuiltinSkillExecutionService`
- 每个 built-in skill 实现 `SkillExecutor` 接口
- agent-core 调用 built-in skill 时，与调用扩展 skill 使用相同 HTTP 接口

**Skill 调用统一接口**：
```
POST /api/v1/skills/:skillId/execute
  - 请求体：{ input: object, context: ExecutionContext }
  - 返回：{ success: boolean, output: object, error?: string }
```

**为何这样设计**：
- 统一调用方式，agent-core 无需区分 built-in 和 extension
- 便于后续扩展新的 built-in skill，无需改动 agent-core
- 安全控制集中在 skill-gateway（鉴权、限流、审计）

### 4. 数据库表设计

**决策**：使用 MySQL 存储会话、历史、日志等数据。

**核心表结构**：

```sql
-- 对话表
CREATE TABLE conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(64) UNIQUE NOT NULL COMMENT '业务ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    name VARCHAR(255) COMMENT '对话名称',
    description TEXT COMMENT '对话描述',
    enabled_skills JSON COMMENT '可用SkillID列表',
    config JSON COMMENT '其他配置（如确认模式）',
    status VARCHAR(32) DEFAULT 'active' COMMENT '状态：active/archived/deleted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='对话会话表';

-- 对话历史表（存储每轮对话内容）
CREATE TABLE conversation_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(64) NOT NULL COMMENT '对话ID',
    role VARCHAR(32) NOT NULL COMMENT '角色：user/assistant/system/tool',
    content TEXT COMMENT '消息内容',
    skill_calls JSON COMMENT '本次调用的Skill列表（Tool Calls）',
    skill_outputs JSON COMMENT 'Skill返回结果',
    latency_ms INT COMMENT '响应耗时（毫秒）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
) ENGINE=InnoDB COMMENT='对话消息表';

-- Skill 定义表（扩展 skill）
CREATE TABLE skills (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'Skill业务ID',
    name VARCHAR(255) NOT NULL COMMENT 'Skill名称',
    description TEXT COMMENT 'Skill描述',
    type VARCHAR(32) NOT NULL COMMENT '类型：api/ssh/template/openclaw',
    kind VARCHAR(32) DEFAULT 'extension' COMMENT '种类：builtin/extension',
    configuration JSON NOT NULL COMMENT '详细配置（endpoint、headers、params等）',
    requires_confirmation BOOLEAN DEFAULT FALSE COMMENT '是否需要运行时确认',
    visibility VARCHAR(32) DEFAULT 'private' COMMENT '可见性：private/public',
    owner_id VARCHAR(64) COMMENT '创建者ID',
    status VARCHAR(32) DEFAULT 'active' COMMENT '状态：active/disabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kind (kind),
    INDEX idx_type (type),
    INDEX idx_visibility (visibility),
    INDEX idx_owner (owner_id)
) ENGINE=InnoDB COMMENT='Skill定义表';

-- Skill 调用日志表（审计用）
CREATE TABLE skill_invocation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_id VARCHAR(64) UNIQUE NOT NULL COMMENT '日志ID',
    conversation_id VARCHAR(64) COMMENT '对话ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    skill_id VARCHAR(64) NOT NULL COMMENT 'Skill ID',
    skill_name VARCHAR(255) COMMENT 'Skill名称',
    input_params JSON COMMENT '输入参数（可脱敏）',
    output_result JSON COMMENT '返回结果（可截断）',
    success BOOLEAN COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    latency_ms INT COMMENT '调用耗时（毫秒）',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_skill_id (skill_id),
    INDEX idx_executed_at (executed_at)
) ENGINE=InnoDB COMMENT='Skill调用审计日志表';

-- 用户操作审计表
CREATE TABLE user_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_id VARCHAR(64) UNIQUE NOT NULL COMMENT '日志ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    action VARCHAR(64) NOT NULL COMMENT '操作类型：create_conversation/delete_skill/...',
    resource_type VARCHAR(64) COMMENT '资源类型：conversation/skill/...',
    resource_id VARCHAR(64) COMMENT '资源ID',
    details JSON COMMENT '操作详情',
    ip_address VARCHAR(64) COMMENT 'IP地址',
    user_agent TEXT COMMENT 'User Agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='用户操作审计表';
```

**为何这样设计**：
- 对话与消息分离，便于分页查询历史
- JSON 字段存储灵活配置，避免频繁 DDL
- 审计表独立，支持大数据量归档

### 5. 技术栈选择

**决策**：
- **skill-gateway**：Spring Boot 3.x + Java 17 + MySQL 8 + JPA
- **frontend**：Vue 3 + TypeScript + Vite（保持现有技术栈）
- **agent-core**：Node.js 18 + NestJS（保持现状，仅调整部署配置）

**为何这样设计**：
- 后端技术栈与现有 skill-gateway 一致，便于开发维护
- frontend 保持 Vue 3，减少重构成本
- agent-core 不重写，仅调整调用方式和部署

### 6. 会话状态管理

**决策**：会话状态由 skill-gateway 管理，agent-core 无状态。

**状态流转**：
```
用户创建对话 → skill-gateway 生成 conversation_id，存入数据库
用户发送消息 → skill-gateway 查询对话配置，组装请求发送至 agent-core
agent-core 处理 → 流式返回 SSE 事件
skill-gateway 代理 → 同时记录日志，转发给前端
对话结束 → skill-gateway 更新数据库，归档历史
```

**为何这样设计**：
- agent-core 可以水平扩展（无状态）
- 会话恢复：skill-gateway 可以从数据库重建对话上下文
- 便于实现断线重连、消息补发等功能

---

## Risks / Trade-offs

**[Risk] 性能损耗（增加一跳代理）**
→ **缓解**：
- skill-gateway 与 agent-core 部署在同一内网，延迟 < 5ms
- 使用长连接/连接池减少连接建立开销
- 关键路径异步处理（日志落库）

**[Risk] agent-core 升级时兼容性**
→ **缓解**：
- 保持 agent-core HTTP API 稳定
- skill-gateway 适配层隔离差异
- 蓝绿部署，先升级 skill-gateway，后升级 agent-core

**[Risk] 数据迁移（现有对话历史）**
→ **缓解**：
- 新建表结构，旧数据保留在 mem0 或本地文件
- 提供迁移脚本，将近期活跃对话导入新表
- 历史查询降级：新对话走数据库，旧对话走原方式

**[Risk] 开发工作量较大**
→ **缓解**：
- 分阶段实施：先代理层，后会话管理，最后 built-in 下沉
- 保持 agent-core 不变，减少回归测试范围
- 每阶段独立上线，可回滚

**[Trade-off] 架构复杂度增加（新增代理层）**
→ **接受**：换取前端简化、安全统一、可扩展性提升

---

## Migration Plan

### 阶段 1：请求代理（2 周）
1. skill-gateway 新增 `/api/v1/conversations/:id/run` 接口，代理至 agent-core
2. frontend 切换调用路径（指向 skill-gateway）
3. 验证 SSE 流代理正常
4. **回滚**：切回 frontend 直连 agent-core

### 阶段 2：会话管理（2 周）
1. 创建 conversations、conversation_messages 表
2. skill-gateway 实现对话 CRUD 接口
3. frontend 接入新接口（对话列表、历史查询）
4. 对话历史从 skill-gateway 查询，不再依赖 agent-core
5. **回滚**：数据库保留，回退到 frontend 不查历史

### 阶段 3：日志统一（1 周）
1. skill-gateway 新增审计日志接收接口
2. agent-core 调整日志上报路径（指向 skill-gateway）
3. 验证日志落库正常

### 阶段 4：Built-in 下沉（3 周）
1. Java 层实现 api_caller、compute、ssh_executor
2. agent-core 移除内置工具实现，改为 HTTP 调用
3. 回归测试所有 built-in skill
4. **回滚**：agent-core 恢复内置实现

### 阶段 5：清理与优化（1 周）
1. agent-core 关闭对外端口（仅监听内网）
2. 移除 frontend 中直连 agent-core 的代码
3. 性能调优、监控完善

---

## Open Questions

1. **是否需要 WebSocket 支持？** 当前使用 SSE，是否需支持 WebSocket 用于双向通信？
2. **多轮对话的最大轮数限制？** 数据库表设计支持，但业务上是否需要限制（如 1000 轮）？
3. **是否需要对话归档/导出功能？** 用户是否需要导出对话记录为 PDF/Markdown？
4. **skill-gateway 的负载均衡策略？** 无状态设计，是否直接轮询即可？
