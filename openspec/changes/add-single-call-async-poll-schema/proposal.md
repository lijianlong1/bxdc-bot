## Why

hebing 分支为 API Skill 异步轮询提供了 SINGLE_CALL 和 PERIODIC 两种策略的选择 UI，合并后因 SkillManagementModal 改为 schema 驱动渲染，当前后端 schema 仅包含一个 `asyncPoll` JSON 编辑器，导致 SINGLE_CALL 策略无法在前端配置。

## What Changes

- 后端 `buildApiConfigSchema()` 新增 `asyncPollEnabled` (checkbox)、`asyncPollStrategy` (radio) 和 `asyncPollReadTimeoutSeconds` (number) schema 字段
- 前端 `ConfigFormRenderer` 新增 `checkbox`、`radio` UI 类型支持，以及字段条件可见性（如 `visibleWhen`）
- `SkillManagementModal` 的 API draft 类型与 schema 字段对齐，正确处理三种异步轮询配置的序列化/反序列化
- 原有 `asyncPoll` JSON 编辑器字段保留，仅在选择 PERIODIC 时展示

## Capabilities

### New Capabilities
<!-- None - this is modifying existing capability -->

### Modified Capabilities
- `skill-management-editor`: 扩展 API Skill 表单 schema，增加异步轮询策略选择（SINGLE_CALL / PERIODIC）UI

## Impact

- **前端**: `ConfigFormRenderer.vue`（新增 UI 类型）、`SkillManagementModal.vue`（API draft 字段对齐）
- **后端**: `SystemSkillController.java`（`buildApiConfigSchema` 扩展字段）
- **不涉及**: agent-core 异步轮询逻辑（已是两种策略并存，无需修改）
