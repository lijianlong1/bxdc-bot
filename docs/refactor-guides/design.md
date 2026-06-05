## 项目概述

本项目为**全新开发**一套 AI Agent 对话平台，包含：
- **Frontend**：Vue 3 前端应用
- **Skill-gateway**：Spring Boot 后端服务
- **Agent-core**：复用现有服务（内部调用）

### 架构原则

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                       │
│                   Vue 3 + TypeScript + Vite                  │
│                     职责：纯用户界面层                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/SSE
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              服务网关 (Skill-gateway)                         │
│              Spring Boot + Java 17 + MySQL 8                 │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │   会话管理   │  │   请求代理   │  │    Skill 管理       │  │
│  │ (CRUD)      │  │ (转发 SSE)   │  │ (Built-in/Extension)│  │
│  └─────────────┘  └──────┬──────┘  └────────────────────┘  │
│                          │                                  │
│  ┌─────────────┐  ┌──────┴──────┐  ┌────────────────────┐  │
│  │  日志审计    │  │  Skill 执行  │  │    数据存储         │  │
│  │ (统一落库)   │  │ (Java 实现)  │  │    (MySQL/JPA)     │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ 内部 HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              推理引擎 (Agent-core) - 复用现有                 │
│                    NestJS + Node.js 18                       │
│                     职责：仅 ReAct + LLM                     │
│                    约束：不直接对外暴露                       │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：
1. **分层清晰**：frontend 只调 skill-gateway，skill-gateway 可独立部署
2. **单一入口**：skill-gateway 是系统唯一对外服务
3. **职责分离**：会话、Skill、日志在 gateway；推理在 agent-core
4. **数据统一**：所有业务数据由 skill-gateway 写入 MySQL

---

## 技术栈选择

### Frontend

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.4+ | 前端框架 |
| TypeScript | 5.3+ | 类型安全 |
| Vite | 5.0+ | 构建工具 |
| Element Plus | 2.5+ | UI 组件库 |
| Pinia | 2.1+ | 状态管理 |
| Axios | 1.6+ | HTTP 客户端 |
| SSE 客户端 | 原生 | 流式消息接收 |

### Skill-gateway

| 技术 | 版本 | 用途 |
|------|------|------|
| Spring Boot | 3.2+ | 后端框架 |
| Java | 17 | 开发语言 |
| MySQL | 8.0+ | 关系数据库 |
| Spring Data JPA | 3.2+ | ORM 框架 |
| Flyway | 10.0+ | 数据库迁移 |
| SpringDoc | 2.3+ | OpenAPI 文档 |
| HTTP Client | RestTemplate/WebClient | 调用 agent-core |

### Agent-core（复用现有）

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 10+ | Node.js 框架 |
| TypeScript | 5+ | 开发语言 |
| LangChain | 0.1+ | LLM 交互 |
| OpenAI SDK | 4+ | LLM API 调用 |

---

## 系统模块设计

### 1. Frontend 模块

```
src/
├── api/                    # API 接口定义
│   ├── conversation.ts     # 对话相关接口
│   ├── skill.ts           # Skill 相关接口
│   └── types/             # 类型定义
├── components/            # 组件
│   ├── chat/             # 对话组件
│   │   ├── ChatWindow.vue       # 聊天窗口
│   │   ├── MessageList.vue      # 消息列表
│   │   ├── MessageItem.vue      # 单条消息
│   │   └── InputArea.vue        # 输入框
│   ├── conversation/     # 对话管理组件
│   │   ├── ConversationList.vue # 对话列表（左侧）
│   │   ├── ConversationItem.vue # 对话项
│   │   └── NewConversationDialog.vue # 新建对话
│   └── skill/          # Skill 相关组件
│       └── SkillSelector.vue    # Skill 选择器
├── stores/               # Pinia 状态管理
│   ├── conversation.ts   # 对话状态
│   ├── chat.ts          # 聊天状态
│   └── skill.ts         # Skill 状态
├── views/               # 页面
│   ├── ChatView.vue     # 主聊天页面
│   └── SettingsView.vue # 设置页面
└── utils/              # 工具函数
    ├── sse.ts          # SSE 处理
    └── request.ts      # 请求封装
```

### 2. Skill-gateway 模块

```
src/main/java/com/lobsterai/skillgateway/
├── controller/           # 控制器层（REST API）
│   ├── ConversationController.java
│   ├── SkillController.java
│   └── AgentProxyController.java
├── service/             # 服务层（业务逻辑）
│   ├── ConversationService.java
│   ├── SkillService.java
│   ├── AgentProxyService.java
│   ├── SkillExecutionService.java
│   └── AuditLogService.java
├── repository/          # 数据访问层（JPA）
│   ├── ConversationRepository.java
│   ├── ConversationMessageRepository.java
│   ├── SkillRepository.java
│   └── SkillInvocationLogRepository.java
├── entity/              # 实体类
│   ├── Conversation.java
│   ├── ConversationMessage.java
│   ├── Skill.java
│   └── SkillInvocationLog.java
├── dto/                 # 数据传输对象
│   ├── request/
│   └── response/
├── executor/            # Skill 执行器（Built-in）
│   ├── SkillExecutor.java              # 接口
│   ├── ApiCallerExecutor.java          # api_caller
│   ├── ComputeExecutor.java            # compute
│   └── SshExecutor.java                # ssh_executor
├── config/              # 配置类
└── SkillGatewayApplication.java
```

---

## 数据库设计

### 表清单

| 表名 | 用途 | 主要字段 |
|------|------|----------|
| `conversations` | 对话会话 | id, user_id, name, enabled_skills, status |
| `conversation_messages` | 对话消息 | id, conversation_id, role, content, skill_calls |
| `skills` | Skill 定义 | id, name, type, kind, configuration, visibility |
| `skill_categories` | Skill 分类 | id, name, description |
| `skill_invocation_logs` | Skill 调用日志 | id, skill_id, user_id, input, output, latency |
| `user_audit_logs` | 用户操作审计 | id, user_id, action, resource_type, details |

### 详细表结构

```sql
-- 对话表
CREATE TABLE conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(64) UNIQUE NOT NULL COMMENT '业务ID，UUID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    title VARCHAR(255) COMMENT '对话标题（可自动生成）',
    enabled_skills JSON COMMENT '启用的Skill ID列表',
    config JSON COMMENT '对话配置（温度、确认模式等）',
    status VARCHAR(32) DEFAULT 'active' COMMENT '状态：active/archived',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='对话会话表';

-- 对话消息表
CREATE TABLE conversation_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id VARCHAR(64) UNIQUE NOT NULL COMMENT '消息ID',
    conversation_id VARCHAR(64) NOT NULL COMMENT '所属对话',
    role VARCHAR(32) NOT NULL COMMENT '角色：user/assistant/tool/system',
    content TEXT COMMENT '消息内容',
    skill_calls JSON COMMENT '调用的Skill列表（工具调用）',
    skill_outputs JSON COMMENT 'Skill返回结果',
    latency_ms INT COMMENT '生成耗时（毫秒）',
    token_count INT COMMENT 'Token数量（可选）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
) ENGINE=InnoDB COMMENT='对话消息表';

-- Skill 表（Built-in + Extension 统一）
CREATE TABLE skills (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'Skill业务ID',
    name VARCHAR(255) NOT NULL COMMENT 'Skill名称',
    description TEXT COMMENT 'Skill描述',
    icon VARCHAR(255) COMMENT '图标URL或class',
    type VARCHAR(32) NOT NULL COMMENT '类型：api/ssh/template/openclaw',
    kind VARCHAR(32) NOT NULL COMMENT '种类：builtin/extension',
    category_id BIGINT COMMENT '分类ID',
    configuration JSON NOT NULL COMMENT '详细配置（端点、参数等）',
    input_schema JSON COMMENT '输入参数JSON Schema',
    output_schema JSON COMMENT '输出参数JSON Schema',
    requires_confirmation BOOLEAN DEFAULT FALSE COMMENT '是否需要确认',
    timeout_seconds INT DEFAULT 30 COMMENT '超时时间（秒）',
    visibility VARCHAR(32) DEFAULT 'private' COMMENT '可见性：private/public',
    owner_id VARCHAR(64) COMMENT '创建者ID（builtin为null）',
    status VARCHAR(32) DEFAULT 'active' COMMENT '状态',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kind (kind),
    INDEX idx_type (type),
    INDEX idx_category (category_id),
    INDEX idx_visibility (visibility),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='Skill定义表';

-- Skill 分类表
CREATE TABLE skill_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    category_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL COMMENT '分类名称',
    description TEXT COMMENT '分类描述',
    icon VARCHAR(255) COMMENT '图标',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Skill分类表';

-- Skill 调用日志表
CREATE TABLE skill_invocation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_id VARCHAR(64) UNIQUE NOT NULL,
    conversation_id VARCHAR(64) COMMENT '对话ID',
    message_id VARCHAR(64) COMMENT '消息ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    skill_id VARCHAR(64) NOT NULL COMMENT 'Skill ID',
    skill_name VARCHAR(255) COMMENT 'Skill名称（快照）',
    input_params TEXT COMMENT '输入参数（JSON，可脱敏）',
    output_result TEXT COMMENT '输出结果（JSON，可截断）',
    success BOOLEAN COMMENT '是否成功',
    error_code VARCHAR(64) COMMENT '错误码',
    error_message TEXT COMMENT '错误信息',
    latency_ms INT COMMENT '调用耗时',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation (conversation_id),
    INDEX idx_user (user_id),
    INDEX idx_skill (skill_id),
    INDEX idx_executed (executed_at)
) ENGINE=InnoDB COMMENT='Skill调用日志表';

-- 用户审计日志表
CREATE TABLE user_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL COMMENT '操作类型',
    resource_type VARCHAR(64) COMMENT '资源类型：conversation/skill/...',
    resource_id VARCHAR(64) COMMENT '资源ID',
    details JSON COMMENT '操作详情',
    ip_address VARCHAR(64) COMMENT 'IP地址',
    user_agent TEXT COMMENT 'User Agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='用户审计日志表';
```

---

## API 接口设计

### 1. 对话管理 API

```yaml
# 创建对话
POST /api/v1/conversations
Request:
  title: string          # 可选，不传则自动生成
  enabled_skills: string[]  # 可选，不传则使用默认Skill
  config: object         # 可选配置
Response:
  conversation_id: string
  title: string
  created_at: datetime

# 查询对话列表
GET /api/v1/conversations?page=1&size=20
Response:
  total: number
  items:
    - conversation_id: string
      title: string
      updated_at: datetime
      message_count: number

# 获取对话详情
GET /api/v1/conversations/{conversation_id}
Response:
  conversation_id: string
  title: string
  enabled_skills: Skill[]
  messages: Message[]     # 最近N条，支持分页
  config: object

# 更新对话
PUT /api/v1/conversations/{conversation_id}
Request:
  title: string
  enabled_skills: string[]
  config: object

# 删除对话
DELETE /api/v1/conversations/{conversation_id}
```

### 2. 对话运行 API（核心）

```yaml
# 发送消息并启动流式响应
POST /api/v1/conversations/{conversation_id}/run
Content-Type: application/json
Accept: text/event-stream

Request:
  message: string        # 用户输入
  context: object        # 可选上下文

Response: SSE Stream
  # 事件类型1: thought - AI思考过程
  event: thought
  data: { content: string, step: number }
  
  # 事件类型2: tool_call - 准备调用Skill
  event: tool_call
  data: { skill_id: string, name: string, input: object }
  
  # 事件类型3: tool_output - Skill返回结果
  event: tool_output
  data: { skill_id: string, output: object, latency_ms: number }
  
  # 事件类型4: confirmation_request - 需要用户确认
  event: confirmation_request
  data: { request_id: string, skill_name: string, description: string, params: object }
  
  # 事件类型5: message - AI回复片段（流式）
  event: message
  data: { content: string, is_complete: boolean }
  
  # 事件类型6: done - 完成
  event: done
  data: { message_id: string, token_count: number }
  
  # 事件类型7: error - 错误
  event: error
  data: { code: string, message: string }
```

### 3. Skill 管理 API

```yaml
# 查询可用Skill列表
GET /api/v1/skills?type=&category=&keyword=
Response:
  items:
    - skill_id: string
      name: string
      description: string
      icon: string
      type: string
      kind: string        # builtin/extension
      requires_confirmation: boolean

# 获取Skill详情
GET /api/v1/skills/{skill_id}
Response:
  skill_id: string
  name: string
  description: string
  type: string
  kind: string
  configuration: object    # 配置详情（owner可见完整配置）
  input_schema: object       # 输入参数Schema
  sample_inputs: object[]    # 示例输入

# 创建Extension Skill（Skill生成工具调用）
POST /api/v1/skills
Request:
  name: string
  description: string
  type: string
  configuration: object
Response:
  skill_id: string

# 更新Skill
PUT /api/v1/skills/{skill_id}

# 删除Skill
DELETE /api/v1/skills/{skill_id}
```

### 4. 确认流 API

```yaml
# 提交确认结果（用户点击确认/取消）
POST /api/v1/conversations/{conversation_id}/confirm
Request:
  request_id: string     # confirmation_request中的ID
  confirmed: boolean     # true确认，false取消
Response:
  success: boolean
```

### 5. 内部 API（Skill-gateway ↔ Agent-core）

```yaml
# 代理对话运行（内部使用）
POST /internal/agent/run
Headers:
  X-Conversation-Id: string
  X-User-Id: string
  X-Enabled-Skills: string[]  # JSON数组
Request:
  message: string
  history: Message[]         # 历史消息
Response: SSE Stream
  # 与外部API相同的事件类型

# 上报日志（Agent-core调用）
POST /internal/logs/conversation
Request:
  conversation_id: string
  messages: Message[]
  
POST /internal/logs/skill-invocation
Request:
  conversation_id: string
  message_id: string
  invocations: SkillInvocation[]
```

---

## Skill 执行设计

### Built-in Skill 实现

所有 Built-in Skill 在 Java 层实现，实现 `SkillExecutor` 接口：

```java
public interface SkillExecutor {
    String getSkillId();
    String getSkillName();
    SkillOutput execute(SkillInput input, ExecutionContext context);
}

// 示例：api_caller 实现
@Component
public class ApiCallerExecutor implements SkillExecutor {
    
    @Override
    public String getSkillId() {
        return "api_caller";
    }
    
    @Override
    public SkillOutput execute(SkillInput input, ExecutionContext context) {
        // 1. 解析配置（endpoint、method、headers）
        ApiConfig config = parseConfig(input);
        
        // 2. 组装HTTP请求
        HttpRequest request = buildRequest(config, input.getParams());
        
        // 3. 执行请求
        HttpResponse response = httpClient.execute(request);
        
        // 4. 处理响应
        return SkillOutput.builder()
            .success(response.isSuccess())
            .data(parseResponse(response))
            .build();
    }
}
```

### Skill 执行路由

```java
@Service
public class SkillExecutionService {
    
    private final Map<String, SkillExecutor> builtinExecutors;
    private final SkillRepository skillRepository;
    
    public SkillOutput execute(String skillId, SkillInput input, ExecutionContext ctx) {
        // 1. 查询Skill
        Skill skill = skillRepository.findBySkillId(skillId);
        
        // 2. 根据kind路由
        if ("builtin".equals(skill.getKind())) {
            // Built-in: 本地执行
            SkillExecutor executor = builtinExecutors.get(skillId);
            return executor.execute(input, ctx);
        } else {
            // Extension: 代理执行
            return executeExtension(skill, input, ctx);
        }
    }
    
    private SkillOutput executeExtension(Skill skill, SkillInput input, ExecutionContext ctx) {
        // 根据type执行：API/SSH/Template/OPENCLAW
        switch (skill.getType()) {
            case "api":
                return executeApiSkill(skill, input);
            case "ssh":
                return executeSshSkill(skill, input);
            case "template":
                return executeTemplateSkill(skill, input);
            case "openclaw":
                return executeOpenclawSkill(skill, input, ctx);
            default:
                throw new UnsupportedSkillTypeException();
        }
    }
}
```

---

## 关键流程设计

### 1. 对话运行完整流程

```
1. 用户在前端输入消息
   ↓
2. Frontend → POST /api/v1/conversations/{id}/run
   ↓
3. Skill-gateway 验证对话、查询配置
   ↓
4. Skill-gateway → POST /internal/agent/run (带历史消息和可用Skill列表)
   ↓
5. Agent-core 启动 ReAct 循环
   ↓
6. 需要调用Skill时 → Agent-core → Skill-gateway (HTTP请求)
   ↓
7. Skill-gateway 执行Skill（Built-in本地执行 / Extension代理）
   ↓
8. 返回结果 → Agent-core 继续推理
   ↓
9. Agent-core SSE 流式返回 → Skill-gateway → Frontend
   ↓
10. Skill-gateway 异步记录日志到数据库
```

### 2. 多对话管理流程

```
用户打开页面
   ↓
GET /api/v1/conversations (加载对话列表)
   ↓
显示左侧对话列表（类似DeepSeek）
   ↓
用户点击某个对话
   ↓
GET /api/v1/conversations/{id} (加载详情和历史消息)
   ↓
显示历史消息（支持向上滚动加载更多）
   ↓
用户输入新消息 → 走"对话运行流程"
```

---

## 开发顺序建议

### 阶段 1：基础搭建（2周）

1. **数据库**：创建表结构，配置 Flyway 迁移
2. **Skill-gateway**：搭建 Spring Boot 项目，配置 JPA
3. **Frontend**：搭建 Vue 3 项目，配置路由和基础布局

### 阶段 2：核心功能（3周）

1. **对话管理**：实现对话 CRUD API 和前端界面
2. **请求代理**：实现 agent-core 代理层
3. **基础对话**：实现消息发送和 SSE 接收

### 阶段 3：Skill 体系（3周）

1. **Skill 管理**：CRUD、分类、列表展示
2. **Built-in 实现**：api_caller、compute、ssh_executor
3. **Skill 执行**：统一执行接口，路由逻辑

### 阶段 4：高级功能（2周）

1. **日志系统**：审计日志落库和查询
2. **确认流**：运行时确认机制
3. **历史翻看**：分页加载历史消息

### 阶段 5：完善上线（2周）

1. **鉴权限流**：JWT、限流、安全加固
2. **监控告警**：指标采集、告警配置
3. **性能优化**：慢查询优化、缓存
4. **部署上线**：Docker、K8s、文档

---

## 设计决策

### 1. 为何 Built-in Skill 下沉至 Java？

**理由**：
- 统一调用方式，agent-core 无需区分 built-in/extension
- 安全控制集中在 gateway（鉴权、限流、审计）
- 便于后续扩展，新增 built-in 无需改动 agent-core

### 2. 为何 Session 管理放在 gateway？

**理由**：
- agent-core 保持无状态，便于水平扩展
- 会话恢复：gateway 可从数据库重建上下文
- 断线重连、多设备同步等高级功能更易实现

### 3. 为何使用 SSE 而非 WebSocket？

**理由**：
- SSE 更简单，天然支持自动重连
- 单向通信足够（server → client）
- 与现有 agent-core 实现兼容

### 4. 数据模型为何用 JSON 字段？

**理由**：
- Skill 配置、对话配置灵活多变
- 避免频繁 DDL
- MySQL 8 JSON 类型支持索引和查询

---

## 相关文档

- 需求文档：`docs/platform-requirements.md`
- 现有 Skill 执行流程：`docs/agent-skill-execution-flows.md`
- Agent-core 现有实现：`backend/agent-core/`
