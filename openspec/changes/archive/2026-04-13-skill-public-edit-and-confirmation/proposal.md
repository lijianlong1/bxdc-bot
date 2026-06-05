## Why

公开（`PUBLIC`）的数据库 Skill 目前可被任意带 `X-User-Id` 的调用方更新或删除，与「仅创建者维护」的产品预期不符。另，`requiresConfirmation` 已持久化并在 UI 可配置，但 Agent 执行扩展 Skill 的路径未在调用前校验该标志，导致「需要确认」勾选对用户侧无实际效果。

## What Changes

- **写授权**：将 `PUBLIC` Skill 的更新/删除限制为 **创建者**（`createdBy` 与当前用户一致）。**例外**：`createdBy` 为平台作者 `public` 的行，仅 **固定管理员用户 ID `890728`**（实现中写死为常量，与 `X-User-Id` 字符串比较）可写。非授权写操作保持与私人 Skill 一致的安全语义（如 404）。
- **需要确认**：在 Agent Core 加载并执行 SkillGateway 扩展 Skill 时，若 `requiresConfirmation === true`，则在未收到用户确认前 **不得执行** 实际副作用，并返回与 `skill-confirmation` 一致的 `CONFIRMATION_REQUIRED` 响应；用户确认后允许再次调用并执行。
- **前端（如需要）**：管理列表仅对创建者展示编辑/删除；公开 Skill 对他人为只读（与后端一致）。

## Capabilities

### New Capabilities

- （无；行为收紧与既有规格对齐。）

### Modified Capabilities

- **skill-visibility**：将「公共 Skill 写策略」收紧为 **仅创建者可更新/删除**，并 **ADDED**：`createdBy=public` 的平台行仅 **硬编码管理员 ID `890728`** 可写。
- **skill-confirmation**：补充扩展 Skill **执行路径**上 `requiresConfirmation` 与 `CONFIRMATION_REQUIRED` / 再次带确认调用的要求（覆盖当前仅描述「标志存在」而未绑定执行的缺口）。
- **extended-skill-management**：将公开 Skill 的管理权限写清为 **仅创建者可编辑/删除**；并 **ADDED**：用户 **`890728`** 可对 `createdBy=public` 的平台行执行同等管理操作。

## Impact

- **backend/skill-gateway**：`SkillService.canWriteSkill`（或等价授权层）及必要测试。
- **backend/agent-core**：`java-skills.ts` 中 `loadGatewayExtendedTools` 生成的 DynamicTool 需在执行前处理 `requiresConfirmation`（含 OpenClaw / API / template 等分支）；可能需约定二次调用的确认参数格式。
- **frontend**：Skill Hub / 管理弹窗对无写权限的 Skill 隐藏或禁用编辑、删除（若当前仍展示则改）。
