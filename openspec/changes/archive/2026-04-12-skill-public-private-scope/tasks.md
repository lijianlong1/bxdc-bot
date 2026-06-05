## 1. 数据模型与迁移

- [x] 1.1 在 `Skill` 实体与 `skills` 表增加 `visibility`（`PUBLIC`/`PRIVATE`）与 `createdBy` 字段，并补充迁移脚本或 JPA 策略
- [x] 1.2 为历史数据设置默认 `visibility=PUBLIC`，`createdBy` 按设计处理可空或占位；若存在 Built-in 对应种子行，则 `visibility=PUBLIC` 且 `createdBy=public`（或与系统用户对齐）
- [x] 1.3 确认 `name` 全局唯一策略与私人 Skill 冲突时的错误提示（与设计 Open Questions 对齐）

## 2. SkillGateway API 与授权

- [x] 2.1 列表与详情接口按当前用户过滤 `PUBLIC` + 本人 `PRIVATE`；越权访问私人他人记录返回安全语义（如 404）
- [x] 2.2 创建接口强制写入当前用户为 `createdBy`，接收可见性字段；**未传可见性时默认 `PRIVATE`**
- [x] 2.3 更新/删除接口校验私人 Skill 仅创建者可写；公共 Skill 写策略按设计锁定（全员可改或仅创建者）并实现
- [x] 2.4 DTO/OpenAPI 或等价文档更新，标明新增字段

## 3. Agent Core 与身份传递

- [x] 3.1 确保 Agent 调用 `GET /api/skills`（或等价）时携带与会话一致的用户身份
- [x] 3.2 验证仅注册对当前用户可见的扩展 Skill，不加载他人私人 Skill

## 4. 前端：Skill Hub 与管理界面

- [x] 4.1 Skill 新建/编辑表单增加「公共 / 私人」选择并绑定 API；**新建时默认选中私人**
- [x] 4.2 Skill Hub 与管理列表仅展示后端返回的可见 Skill；无权限编辑时不展示可提交表单
- [x] 4.3 更新前端类型与请求体，处理越权/404 提示

## 5. 生成类路径

- [x] 5.1 API 描述生成（`api-skill-generation` 链路）保存时写入 `createdBy` 与默认可见性（如 `PRIVATE`）
- [x] 5.2 Built-in / `JavaSkillGeneratorTool` 等生成保存路径统一设置创建者与可见性
- [x] 5.3 覆盖同名 Skill 时校验目标是否为本人可写记录，拒绝覆盖他人私人 Skill

## 6. 验证与收尾

- [x] 6.1 补充或更新集成测试：用户 A/B、公共/私人列表与编辑边界
- [x] 6.2 走查设计中的 Open Questions（公共写策略、`name` 唯一性），在代码或文档中落地结论
