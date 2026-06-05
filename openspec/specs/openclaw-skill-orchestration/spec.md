# openclaw-skill-orchestration Specification

## Purpose
TBD - created by archiving change support-dual-skill-types. Update Purpose after archive.
## Requirements
### Requirement: OpenClaw 类型数据库 Skill 协议
系统 MUST 支持在数据库中存储 OpenClaw 类型 skill 的 prompt 编排协议，并以受限工具集运行该 skill。

#### Scenario: 保存 OpenClaw skill 配置
- **WHEN** 用户或初始化脚本创建 `executionMode=OPENCLAW` 的数据库 skill
- **THEN** 其 `configuration` 中包含 prompt/orchestration 所需字段
- **AND** 至少声明 `allowedTools` 与串行编排模式

#### Scenario: 受限工具集执行
- **WHEN** Agent 执行某个 OpenClaw 类型 skill
- **THEN** skill 内部只可访问该 skill 配置中声明的 `allowedTools`
- **AND** 不可隐式调用未授权工具

#### Scenario: 串行工具编排
- **WHEN** OpenClaw 类型 skill 需要完成多步工具调用
- **THEN** 系统按串行顺序执行这些步骤
- **AND** 后一步可以读取前一步的结果继续推理或计算

### Requirement: OpenClaw Skill 内部轨迹可见
系统 MUST 为 OpenClaw 类型 skill 输出可追踪的内部子工具调用轨迹，供聊天窗口展示。

#### Scenario: 输出子工具调用轨迹
- **WHEN** OpenClaw 类型 skill 在执行过程中调用了内部白名单工具
- **THEN** 系统为每次子工具调用输出可识别的轨迹事件
- **AND** 这些轨迹事件能够关联回所属的外层 skill

#### Scenario: 轨迹展示最小信息
- **WHEN** 聊天窗口展示 OpenClaw 类型 skill 的内部轨迹
- **THEN** 每个子工具条目至少包含工具名称与执行状态
- **AND** 可附带简短结果摘要
- **AND** 不要求默认展示完整原始参数与响应体

### Requirement: 生日倒计时 OpenClaw 示例 Skill
系统 MUST 提供一个数据库中的 OpenClaw 类型示例 skill，用于查询距离下一次生日还有几天。

#### Scenario: 示例 skill 出现在数据库列表中
- **WHEN** 系统初始化或加载默认数据库 skill
- **THEN** 存在一个名称明确表达“查询距离生日还有几天”的数据库 skill
- **AND** 其 `executionMode` 为 `OPENCLAW`

#### Scenario: 生日尚未到来
- **WHEN** 用户调用该 skill 且提供的生日信息可被系统解析，并且生日在当前年份尚未到来
- **THEN** skill 先调用当前日期查询工具获取当前日期
- **AND** 再调用计算工具计算当前日期与本年度生日之间的天数
- **AND** 返回距离生日的剩余天数

#### Scenario: 今年生日已经过去
- **WHEN** 用户调用该 skill 且提供的生日信息可被系统解析，并且生日在当前年份已经过去
- **THEN** skill 先调用当前日期查询工具获取当前日期
- **AND** 将目标日期推导为下一年的生日
- **AND** 再调用计算工具返回距离下一次生日的剩余天数

### Requirement: OpenClaw Skill 的错误反馈
系统 MUST 在 OpenClaw 类型 skill 缺少必要输入或依赖工具不可用时返回可操作的错误信息。

#### Scenario: 缺少生日输入
- **WHEN** 用户调用生日倒计时 skill 但未提供可识别的生日
- **THEN** skill 明确提示需要补充生日日期信息
- **AND** 不继续执行后续工具调用

#### Scenario: 自然语言生日无法可靠解析
- **WHEN** 用户使用自然语言提供生日信息，但系统无法可靠推断出具体日期
- **THEN** skill 明确要求用户澄清生日
- **AND** 不以猜测结果继续执行

#### Scenario: 依赖工具缺失
- **WHEN** OpenClaw 类型 skill 声明的某个 `allowedTools` 在当前运行时不可用
- **THEN** 系统返回指出缺失工具名称的错误
- **AND** 阻止该次 skill 执行进入不完整状态

