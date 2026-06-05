# agent-client

## Purpose

定义前端客户端与 Agent 后端的交互行为，包括任务提交、SSE 订阅、连接处理及 Skill 状态解析。
## Requirements
### Requirement: 任务提交

客户端 MUST 通过 HTTP POST 将用户消息发送到后端（可使用 Vue composables 或等效方式）。

#### Scenario:发送任务

- **当** 用户提交消息时
- **那么** 客户端发送带有消息内容的 `POST /api/tasks` 请求
- **并且** 处理响应（成功或错误）

### Requirement: 实时更新

客户端 MUST 订阅 Server-Sent Events (SSE) 以获取 Agent 更新。

#### Scenario:订阅事件

- **当** 任务成功提交时
- **那么** 客户端打开到 `/api/tasks/{id}/events` 的 `EventSource` 连接
- **并且** 监听 `message` 事件
- **并且** 根据事件数据更新 UI 或响应式状态（Vue `ref` / `reactive`）

### Requirement: 连接处理

客户端 MUST 处理连接错误和重连。

#### Scenario:连接断开

- **当** SSE 连接中断时
- **那么** 客户端尝试自动重连或通知用户

### Requirement: 流式事件解析

前端客户端 MUST 能从任务 SSE 中解析 assistant 文本内容与 Skill 调用状态事件，并分别写入消息状态。

#### Scenario:解析 assistant 文本

- **当** SSE 事件中包含 assistant 文本内容
- **那么** 客户端更新当前 assistant 消息正文
- **并且** 不影响已记录的 Skill 调用状态列表

#### Scenario:解析 Skill 状态事件

- **当** SSE 事件中包含结构化的 Skill 调用状态
- **那么** 客户端提取 Skill 名称与状态
- **并且** 将其关联到当前 assistant 消息

### Requirement: 多 Skill 顺序维护

前端客户端 MUST 为单条 assistant 消息维护有序的 Skill 调用列表，并支持同一 Skill 的增量状态更新。

#### Scenario:首次收到 Skill 事件

- **当** 某个 Skill 首次出现在当前回复的事件流中
- **那么** 客户端在该消息的 Skill 列表末尾追加一条记录

#### Scenario:收到同一 Skill 的后续状态

- **当** 客户端再次收到同一 Skill 的更新事件
- **那么** 客户端更新已有 Skill 记录的状态
- **并且** 不新增重复条目

### Requirement: Thinking 状态收敛

前端客户端 MUST 在流式会话生命周期内正确维护 thinking 状态，避免 loading 与 Skill 状态残留。

#### Scenario:正常完成

- **当** SSE 收到完成事件
- **那么** 客户端结束 thinking 状态
- **并且** 保留最终 assistant 文本与 Skill 完成态

#### Scenario:请求失败

- **当** SSE 连接失败或任务执行失败
- **那么** 客户端结束 thinking 状态
- **并且** 不再继续追加 Skill 或文本更新

### Requirement: 层级化 Skill 轨迹解析

前端客户端 MUST 能解析带有父子关系的 skill/tool 事件，并将自主规划 skill 的内部子工具轨迹关联到对应外层 skill。

#### Scenario: 解析外层与子工具关系

- **WHEN** SSE 事件中包含自主规划 skill 主条目及其子工具轨迹
- **THEN** 客户端识别外层 skill 与子工具之间的归属关系
- **AND** 将子工具轨迹挂载到对应的外层 skill 下

#### Scenario: 维护子工具顺序

- **WHEN** 同一个自主规划 skill 在一次回复中连续触发多个子工具
- **THEN** 客户端按实际接收顺序维护这些子工具条目
- **AND** 后续状态更新不会打乱既有顺序

#### Scenario: 兼容旧版单层事件

- **WHEN** SSE 中只包含现有单层 skill 事件而没有父子关系字段
- **THEN** 客户端继续按现有方式解析
- **AND** 不因缺少新字段而导致消息渲染失败

### Requirement: 当前对话日志状态维护
前端客户端 SHALL 为当前对话维护结构化 LLM 日志状态，并将其与聊天会话关联。

#### Scenario: 接收日志更新
- **WHEN** 前端收到当前对话的结构化 LLM 日志事件或接口响应
- **THEN** 客户端将日志写入当前对话的响应式状态
- **AND** 不影响已有 assistant 文本与 Skill 状态更新逻辑

#### Scenario: 会话切换隔离日志
- **WHEN** 用户切换到其他对话或发起新的任务
- **THEN** 客户端仅展示与当前会话关联的日志状态
- **AND** 不复用上一轮对话的日志内容

### Requirement: 日志增量更新解析
前端客户端 SHALL 能解析结构化的 LLM 请求/响应日志更新，并按类型更新日志列表。

#### Scenario: 解析请求日志事件
- **WHEN** 客户端收到一条 LLM 请求日志更新
- **THEN** 客户端识别其为请求侧日志
- **AND** 将其写入当前对话日志列表的对应位置

#### Scenario: 解析响应日志事件
- **WHEN** 客户端收到一条 LLM 响应日志更新
- **THEN** 客户端识别其为响应侧日志
- **AND** 将其与同一轮调用的请求日志维持可理解的顺序关系

### Requirement: Tool 调用参数合并

前端客户端 MUST 在更新单条 assistant 消息上的 Tool/Skill 调用记录时保留有效的调用参数：任一阶段收到的非空 `arguments` 在后续状态更新中不得被「未携带参数字段」的事件静默清空；从流式图 chunk 中解析出的 tool call MUST 尽可能提取并关联与 `tool_status` 一致的参数信息（在可解析的前提下）。

#### Scenario: running 带参、completed 不带参

- **WHEN** 客户端先收到包含非空 `arguments` 的 `tool_status`（running）
- **AND** 随后收到同一 `toolId` 的 `tool_status`（completed）且载荷中未包含 `arguments` 或为空占位
- **THEN** 客户端仍展示 running 阶段已记录的参数

#### Scenario: 从 chunk 解析 tool call 时补齐参数

- **WHEN** SSE 事件为 LangGraph 流式 chunk 且其中包含带参数的 tool call 结构
- **THEN** 客户端将该参数合并到对应 Tool/Skill 记录中
- **AND** 不因后续仅含状态不含参数的 chunk 而丢失已解析参数

### Requirement: 调用日志时间轴顺序

前端客户端 MUST 在「调用日志」或等效查看器中，将 Tool/Skill 状态轨迹与 LLM 结构化日志按**单次 assistant 回复内**的真实发生顺序呈现；该顺序 MUST 基于事件接收顺序或后端提供的单调可排序字段（若实现），不得将整类 Tool 条目固定渲染在全部 LLM 条目之前或之后而脱离实际时间线。

#### Scenario: Tool 与 LLM 交错展示

- **WHEN** 一次回复中依次发生「LLM 请求 → 工具调用 → LLM 再次请求」等交错事件
- **THEN** 日志查看器中条目顺序与上述先后一致
- **AND** 用户可据此理解「何时调用模型、何时调用工具」

#### Scenario: 仅存在其中一类事件

- **WHEN** 当前消息仅有 Tool 轨迹或仅有 LLM 日志
- **THEN** 客户端仍正常展示该类条目
- **AND** 不出现空白或错误的占位顺序

### Requirement: 用户 LLM 设置界面

前端客户端 MUST 提供界面供登录用户配置 OpenAI 兼容的 API base URL、模型名称与 API Key，并支持保存与更新。

#### Scenario: 打开设置并保存

- **WHEN** 用户在设置界面填写 base URL、模型名与 API Key 并提交
- **THEN** 客户端调用后端保存接口
- **AND** 成功后在界面展示已保存状态（不含完整 Key 明文）

#### Scenario: 掩码展示

- **WHEN** 用户再次打开设置且此前已保存过 API Key
- **THEN** 客户端展示「已配置」或掩码提示
- **AND** 不要求用户重新输入 Key 除非用户选择更换

### Requirement: 注册与资料中的头像交互

客户端 MUST 在注册与用户资料流程中提供 emoji 选择能力，并提供可选的「自动生成」操作；不得在无用户操作下自动请求 LLM 生成头像。

#### Scenario: 默认选择 emoji

- **WHEN** 用户完成注册或编辑资料且仅使用 emoji 选择器
- **THEN** 客户端不发送静默 LLM 头像生成请求

#### Scenario: 显式生成

- **WHEN** 用户点击「自动生成」
- **THEN** 客户端调用后端头像生成接口
- **AND** 根据响应更新预览或头像字段

#### Scenario: 无 Key 时禁用自动生成

- **WHEN** 当前解析得到的用于 LLM 的 API Key 为空（用户设置与环境均未提供）
- **THEN** 「自动生成」按钮处于禁用状态或等价不可交互
- **AND** 用户仍可使用 emoji 选择器

### Requirement: 任务历史载荷与后端压缩策略一致

前端客户端在构造 `POST /api/tasks` 所附带的 **对话 history**（若实现向网关传递多轮 `user`/`assistant` 消息）时，SHALL 与 `agent-history-compression` 及后端 sanitize 策略 **兼容**：可选地预先缩短或省略渐进披露大段正文，SHALL NOT 依赖「仅前端裁剪」作为唯一净化手段（服务端仍为权威）。

#### Scenario: 可选客户端裁剪

- **WHEN** 产品选择在客户端层减少 history 体积
- **THEN** 客户端 MAY 省略已知的 `REQUIRE_PARAMETERS` 大块正文
- **AND** 仍应保留用户消息与关键 tool 结果以便展示与审计（与 `useChat` 本地消息列表可分离存储的实现允许在发送请求时派生「瘦身」副本）

### Requirement: 不向用户隐藏必要消息正文

在执行可选裁剪时，客户端 SHALL NOT 因压缩而破坏聊天 UI 中用户已看到的完整线程，除非产品明确将「展示层」与「发往 Agent 的 history」分离；若分离，SHALL 仅对发往后端的副本瘦身。

#### Scenario: UI 完整、请求可瘦身

- **WHEN** 采用双副本策略（UI 完整、请求瘦身）
- **THEN** 用户在本机消息列表中仍能看到过往完整 assistant 内容（除非用户自行清除）
- **AND** 发往任务的 history 副本符合压缩 spec

