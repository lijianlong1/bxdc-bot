# chat-ui

## Purpose

定义聊天界面的输入区、消息列表、Markdown 渲染、空状态、初始欢迎语，以及 Skill 调用状态与 Thinking loading 的展示方式。
## Requirements
### Requirement: 聊天输入

界面 MUST 提供一个文本输入区域供用户输入消息，使用 t-textarea 与 t-button，并置于带视觉边界的容器内。

#### Scenario: 发送消息

- **当** 用户输入消息并按 Enter 或点击发送时
- **那么** 消息被添加到聊天记录中
- **并且** 消息被发送到后端
- **并且** 输入字段被清空

#### Scenario: 输入区样式

- **当** 聊天界面加载
- **那么** 输入区使用 TDesign 经典组件
- **并且** 输入区有明确的视觉边界（边框或 Card）

### Requirement:聊天记录

界面 MUST 显示用户和 Agent 的消息滚动列表，使用 TDesign 经典组件（Card、Space、Avatar 等）增强视觉层次。

#### Scenario: 显示消息

- **当** 添加新消息（来自用户或 Agent）时
- **那么** 它出现在列表底部
- **并且** 视图自动滚动到最新消息
- **并且** 消息使用 TDesign 经典组件呈现（如 Avatar、Space）

### Requirement:Markdown 渲染

界面 MUST 使用 Markdown 渲染 Agent 响应。

#### Scenario: 渲染代码块

- **当** Agent 响应包含代码块 (```) 时
- **那么** 它被渲染为语法高亮的代码块
- **并且** 用户可以复制代码

### Requirement:空状态

当无消息时，界面 MUST 使用 t-empty 或带图标的占位内容展示空状态。

#### Scenario: 空状态

- **当** 聊天记录为空且无进行中的请求
- **那么** 显示 TDesign 空状态或等效占位
- **并且** 用户可识别「暂无消息」

### Requirement:初始欢迎语

系统 MUST 在用户首次进入聊天时生成一条欢迎语。

#### Scenario: 生成欢迎语

- **当** 用户首次进入聊天界面
- **并且** 聊天记录为空
- **那么** 系统根据用户的昵称和头像生成个性化的欢迎语
- **并且** 将其显示在聊天界面中

### Requirement:Skill 状态展示

界面 MUST 在 assistant 消息正文下方展示与该条回复关联的执行状态信息，且与正文内容分离渲染。

#### Scenario: 展示单个 Skill 调用状态

- **当** assistant 回复过程中触发一个 Skill 调用事件
- **那么** 该条 assistant 消息下方显示该 Skill 的名称
- **并且** 状态信息使用小字号辅助文本展示

#### Scenario: 展示多个 Skill 调用状态

- **当** 同一条 assistant 回复过程中按顺序触发多个 Skill 调用事件
- **那么** 界面按实际触发顺序逐条展示多个 Skill
- **并且** 先前已展示的 Skill 状态不会被后续 Skill 覆盖

### Requirement:Skill 调用完成态

界面 MUST 在 Skill 调用成功完成后为对应条目展示明确的完成标记。

#### Scenario: Skill 调用成功

- **当** 某个 Skill 的状态变为完成
- **那么** 该 Skill 条目显示成功完成态
- **并且** 条目末尾显示一个小对勾

#### Scenario: Skill 调用进行中

- **当** 某个 Skill 尚未完成
- **那么** 该 Skill 条目显示进行中状态文案
- **并且** 不显示完成对勾

### Requirement:Thinking Loading 展示

界面 MUST 使用「思考中」文案配合 emoji 和动态效果表示 assistant 正在处理中，而不是默认的三个点。

#### Scenario: 请求处理中

- **当** 用户发送消息后 assistant 尚未完成回复
- **那么** 界面展示包含「思考中」字样的 loading 状态
- **并且** loading 中包含一个 emoji
- **并且** loading 具有可感知的动态效果

#### Scenario: 请求完成

- **当** assistant 回复流结束或请求失败
- **那么** 「思考中」loading 状态消失

### Requirement: 自主规划 Skill 内部轨迹展示

界面 MUST 在自主规划类 skill 的主条目下展示其内部子工具调用轨迹，帮助用户理解执行过程。

#### Scenario: 展示自主规划 skill 的子工具轨迹

- **WHEN** assistant 回复过程中触发一个 `自主规划` 类型的 skill，且该 skill 内部又调用了多个子工具
- **THEN** 聊天窗口在该 skill 主条目下方按执行顺序展示子工具轨迹
- **AND** 用户可以识别这些子工具属于哪个外层 skill

#### Scenario: 子工具轨迹最小展示信息

- **WHEN** 某个子工具轨迹条目被渲染
- **THEN** 条目显示子工具名称与执行状态
- **AND** 可显示简短摘要信息
- **AND** 不要求默认展示完整原始参数与响应体

#### Scenario: 预配置 skill 不显示伪层级

- **WHEN** assistant 回复过程中触发一个 `预配置` 类型的 skill
- **THEN** 界面仍按现有单层 skill 条目展示
- **AND** 不为没有内部编排的 skill 人为渲染子工具层级

### Requirement: 日志查看按钮
聊天界面 SHALL 提供一个“日志查看”入口，用于查看当前对话中的大模型请求与响应日志。

#### Scenario: 打开日志查看器
- **WHEN** 用户在当前聊天界面点击日志查看按钮
- **THEN** 系统打开日志查看面板、抽屉或弹窗
- **AND** 该查看器绑定当前对话上下文

### Requirement: 结构化日志展示

聊天界面中的日志查看器 SHALL 以结构化方式展示当前对话的 LLM 请求与响应日志，**以及**与同一次 assistant 回复关联的 Tool/Skill 调用轨迹；上述条目 MUST 按实际发生顺序混合排列在同一时间轴内，而非按类型分块固定顺序堆叠。

#### Scenario: 区分请求参数与响应内容

- **WHEN** 用户查看日志条目
- **THEN** 界面明确区分「送给大模型的参数」和「大模型返回的内容」
- **AND** 用户无需阅读原始纯文本日志即可理解两者差异

#### Scenario: 查看对话过程中的多次调用

- **WHEN** 当前对话中发生多次 LLM 调用
- **THEN** 日志查看器按实际发生顺序展示这些调用记录
- **AND** 每次调用的请求与响应内容能够对应起来

#### Scenario: Tool 与 LLM 在同一时间轴内排序

- **WHEN** 同一次 assistant 回复中既存在 Tool/Skill 状态事件又存在 LLM 结构化日志
- **THEN** 日志查看器在单一列表中按正确时间顺序交错展示两类条目
- **AND** Tool 条目不得被整体固定在列表顶端而与 LLM 调用时间线脱节

#### Scenario: 查看 Tool 调用参数

- **WHEN** 用户展开某条 Tool/Skill 日志条目
- **THEN** 界面展示该次调用已知的参数内容（在客户端或后端曾提供过非空参数的前提下）
- **AND** 参数展示方式与 LLM 请求/响应区块一样易于阅读（如格式化 JSON）

### Requirement: 聊天界面用户头像与统一 emoji 策略一致

聊天消息列表中展示 **当前用户** 头像时，SHALL 使用与 `emoji-display-unification` 一致的渲染方式，避免侧栏/设置与消息区**同一用户头像观感不一致**。

#### Scenario: 消息区与资料区一致

- **WHEN** 用户已设置头像并在聊天中发送消息
- **THEN** 消息列表中该用户头像的展示与统一 emoji 策略 **一致**（同一组件或同一渲染链路）

