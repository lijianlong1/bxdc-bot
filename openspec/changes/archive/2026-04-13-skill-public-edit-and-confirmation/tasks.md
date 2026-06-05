## 1. SkillGateway 写授权

- [x] 1.1 在 SkillGateway 增加硬编码常量（如 `SKILL_PLATFORM_ADMIN_USER_ID = "890728"`），修改 `SkillService.canWriteSkill`：`PUBLIC` 且 `createdBy` 与 `PLATFORM_PUBLIC_AUTHOR` 相等时，仅当 `userId` 等于该常量时允许写；其余 `PUBLIC` 仅当 `userId` 与 `createdBy` 一致；`PRIVATE` 逻辑不变。
- [x] 1.2 为公开 Skill 越权 `PUT`/`DELETE` 补充或更新控制器测试（期望 404）；并增加 **`890728` + `createdBy=public`** 可写、`890728` 不可写他人 `createdBy` 的用例。
- [x] 1.3 （可选）在 `application.properties` 或 README 中一行说明平台行维护账号 ID，避免运维遗忘（**非**配置项，仅文档）。

## 2. Agent Core 扩展 Skill 确认

- [x] 2.1 在 `loadGatewayExtendedTools` 中，于各执行分支（API、SSH preset、template、OPENCLAW 等）之前统一检查 `requiresConfirmation` 与输入中的确认标志（见 design：JSON `confirmed` 约定）。
- [x] 2.2 未确认时返回 `CONFIRMATION_REQUIRED` JSON，且 instruction 说明如何带 `confirmed` 再次调用。
- [x] 2.3 必要时补充单元测试或最小集成验证。（与 CRUD 测试相同环境；本地若 Mockito 正常可跑 `SkillControllerCrudTest` 验证网关侧。）

## 3. 前端 Skill 管理

- [x] 3.1 在扩展 Skill 列表/管理弹窗中，仅当 **当前用户为 `createdBy`** 或 **（用户 ID 为 `890728` 且 `createdBy` 为 `public`）** 时显示编辑、删除、启用开关；其余对他人 Skill 只读。
- [x] 3.2 与网关错误响应（404）对齐，避免误报成功。

## 4. 收尾

- [ ] 4.1 手动验证：用户 A 创建公开 Skill，用户 B 无法编辑；勾选「需要确认」后首次执行应要求确认。
- [x] 4.2 归档前将本变更的 delta specs 合并入 `openspec/specs/`（按项目 OpenSpec 流程执行）。
