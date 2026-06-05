## 1. 编辑态模型与配置转换

- [x] 1.1 盘点现有数据库 Skill 的 `CONFIG` / `OPENCLAW` 配置协议，明确首版结构化编辑需覆盖的字段集合。
- [x] 1.2 为 `CONFIG` 与 `OPENCLAW` 定义前端编辑态 draft 类型，以及 `configuration` 的 parser / serializer 接口。
- [x] 1.3 实现历史 Skill `configuration` 到结构化 draft 的解析逻辑，并为无法安全解析的情况设计错误返回。
- [x] 1.4 实现结构化 draft 到持久化 `configuration` JSON 的序列化逻辑，确保 Markdown 提示词与工具列表正确转义。

## 2. Skill 管理窗口改造

- [x] 2.1 重构 Skill 管理表单，移除“手写完整 JSON”主编辑方式，改为按 `executionMode` 切换结构化编辑区域。
- [x] 2.2 为 `CONFIG` 类型实现按 `kind` 分段的结构化字段输入与表单校验。
- [x] 2.3 为 `OPENCLAW` 类型实现 Markdown 提示词输入、`allowedTools` 列表维护和编排字段输入。
- [x] 2.4 在编辑已有 Skill 时接入 parser 回填，并在解析失败时展示明确提示与安全保护。

## 3. 保存链路与接口适配

- [x] 3.1 将 Skill 新增/更新保存链路接入 serializer，确保提交给后端的仍是兼容的 `Skill + configuration` 结构。
- [x] 3.2 校验启用/确认开关、执行类型切换和结构化字段在保存与重新打开编辑时保持一致。
- [x] 3.3 视需要补充 `agent-core` 或 `skill-gateway` 的输入校验/兼容逻辑，确保结构化维护后的配置可被稳定持久化。

## 4. 验证与文档

- [x] 4.1 为 parser / serializer 增加测试，覆盖典型 `time`、`api`、`monitor`、`openclaw` 配置及解析失败场景。
- [ ] 4.2 联调验证新建与编辑两类 Skill 时，结构化字段、Markdown 提示词和工具白名单都能正确保存与回填。
- [x] 4.3 更新相关文档，说明两类 Skill 的结构化维护字段约定、历史数据兼容行为和已支持的 `CONFIG.kind` 范围。
