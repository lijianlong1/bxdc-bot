## ADDED Requirements

### Requirement: API Skill 异步轮询策略选择
系统 SHALL 在 API Skill 的表单 schema 中提供异步轮询启停控件和策略选择，支持 PERIODIC（周期轮询）和 SINGLE_CALL（单次长调用）两种模式。

#### Scenario: 启用异步轮询
- **WHEN** 用户在 API Skill 表单中勾选"启用异步轮询"checkbox
- **THEN** 系统展示轮询策略选择（radio group：PERIODIC / SINGLE_CALL）
- **AND** 默认策略 SHALL 为 PERIODIC

#### Scenario: 选择 SINGLE_CALL 模式
- **WHEN** 用户选择 SINGLE_CALL 策略
- **THEN** 系统展示"单次调用 read timeout（秒）"数字输入框
- **AND** 隐藏 PERIODIC 的异步轮询 JSON 配置编辑器

#### Scenario: 选择 PERIODIC 模式
- **WHEN** 用户选择 PERIODIC 策略
- **THEN** 系统展示"异步轮询配置 (JSON)"编辑器
- **AND** 隐藏 SINGLE_CALL 的 read timeout 输入框

#### Scenario: 取消异步轮询
- **WHEN** 用户取消勾选"启用异步轮询"checkbox
- **THEN** 系统隐藏所有异步轮询相关配置字段
- **AND** 保存时 asyncPoll 字段 SHALL 为 null/undefined

#### Scenario: SINGLE_CALL 保存
- **WHEN** 用户启用异步轮询、选择 SINGLE_CALL、设置 read timeout 并保存
- **THEN** 系统将配置序列化为 `{ pollStrategy: "SINGLE_CALL", singleCallReadTimeoutSeconds: <value> }`
- **AND** 不要求用户填写 `pollEndpoint` 或 `idJsonPath`

#### Scenario: PERIODIC 保存
- **WHEN** 用户启用异步轮询、选择 PERIODIC、填写 JSON 配置并保存
- **THEN** 系统将用户填写的 JSON 直接作为 asyncPoll 值保存
- **AND** JSON 中允许包含 `pollEndpoint`、`idJsonPath`、`completionJsonPath`、`completionValue` 等字段

### Requirement: ConfigFormRenderer 支持 checkbox 和 radio UI 类型
系统 SHALL 在 ConfigFormRenderer 组件中支持 schema 属性 `ui: "checkbox"` 和 `ui: "radio"`，通过 TDesign 组件渲染。

#### Scenario: 渲染 checkbox 字段
- **WHEN** schema 属性 `ui` 为 `"checkbox"` 且 `type` 为 `"boolean"`
- **THEN** 系统渲染 `<t-checkbox>` 组件
- **AND** modelValue 绑定为 boolean 值
- **AND** 默认值使用 schema 中定义的 `default`

#### Scenario: 渲染 radio 字段
- **WHEN** schema 属性 `ui` 为 `"radio"` 且提供 `enum` 数组
- **THEN** 系统渲染 `<t-radio-group>` 组件
- **AND** 每个 `enum` 值渲染为 `<t-radio>` 子项
- **AND** 默认值使用 schema 中定义的 `default`

### Requirement: ConfigFormRenderer 支持字段条件可见性
系统 SHALL 支持 schema 属性中的 `visibleWhen` 配置，根据同表单其他字段的值控制当前字段是否渲染。

#### Scenario: 满足条件时渲染
- **WHEN** schema 属性定义了 `visibleWhen: { field: "asyncPollStrategy", equals: "SINGLE_CALL" }`
- **AND** 表单中 `asyncPollStrategy` 的当前值为 `"SINGLE_CALL"`
- **THEN** 该字段正常渲染

#### Scenario: 不满足条件时隐藏
- **WHEN** schema 属性定义了 `visibleWhen: { field: "asyncPollStrategy", equals: "SINGLE_CALL" }`
- **AND** 表单中 `asyncPollStrategy` 的当前值为 `"PERIODIC"`
- **THEN** 该字段不渲染（隐藏）

#### Scenario: 字段无 visibleWhen 配置时始终渲染
- **WHEN** schema 属性未定义 `visibleWhen`
- **THEN** 该字段始终渲染，不受其他字段值影响
