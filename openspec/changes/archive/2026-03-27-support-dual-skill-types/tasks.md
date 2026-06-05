## 1. SkillGateway 数据模型与接口

- [x] 1.1 为 `skills` 数据模型新增 `executionMode` 字段，并为历史 `EXTENSION` 记录设计默认值/迁移策略。
- [x] 1.2 更新 SkillGateway 的 CRUD、列表、详情接口，使响应稳定返回 `executionMode`。
- [x] 1.3 更新 `data.sql`，为现有数据库 skill 补齐 `executionMode=CONFIG`，并新增生日倒计时的 `OPENCLAW` 示例 skill。
- [x] 1.4 为 SkillGateway 增加测试，覆盖新字段持久化、默认值兼容与示例 skill 出现在列表中的行为。

## 2. 计算能力补齐

- [x] 2.1 在计算接口中新增 `date_diff_days` 运算，支持两个 `YYYY-MM-DD` 日期字符串的天数差值计算。
- [x] 2.2 更新计算 skill 的描述与测试，确保 Agent 可识别并正确调用日期差值能力。

## 3. Agent Core 双类型加载与执行

- [x] 3.1 扩展数据库 skill 的读取模型与解析逻辑，支持 `executionMode=CONFIG` 和 `executionMode=OPENCLAW`。
- [x] 3.2 保持 `CONFIG` 类型 skill 继续走现有配置驱动执行链路，并为缺省 `executionMode` 提供 `CONFIG` 兜底。
- [x] 3.3 实现 `OPENCLAW` 类型 skill 的 prompt executor，按 `allowedTools` 白名单和串行模式执行内部工具调用。
- [x] 3.4 为自主规划 skill 的内部子工具调用产出可关联父级的轨迹事件。
- [x] 3.5 为 Agent Core 增加测试，覆盖两类数据库 skill 的注册、执行分流、缺失依赖工具报错与生日倒计时示例链路。

## 4. 事件流与前端轨迹展示

- [x] 4.1 更新 API Gateway 事件模型，支持自主规划 skill 与子工具轨迹的层级化事件输出。
- [x] 4.2 更新前端客户端的 SSE 解析逻辑，使子工具轨迹能够挂载到对应外层 skill 下。
- [x] 4.3 更新聊天窗口 UI，展示自主规划 skill 的内部子工具轨迹，并保持预配置 skill 的单层展示。
- [ ] 4.4 增加前端测试或联调验证，确认旧版单层事件与新版层级事件都能稳定渲染。

## 5. Skill 列表类型展示

- [x] 5.1 更新 Skill Hub 的数据类型与渲染逻辑，使数据库 skill 可显示 `executionMode`。
- [x] 5.2 在 Skill 列表中为 `CONFIG` 与 `OPENCLAW` 分别渲染 `预配置` 与 `自主规划` 标签，并保持现有来源分组结构。
- [ ] 5.3 增加前端测试或联调验证，确认混合类型 skill 列表可正确展示且旧数据不会导致界面异常。

## 6. 示例 Skill 验证与收尾

- [x] 6.1 新增并启用“查询距离生日还有几天”OpenClaw 示例 skill，配置其允许访问的日期查询与计算工具。
- [x] 6.2 验证该示例 skill 支持常见自然语言生日输入，并在无法可靠解析时明确要求用户澄清。
- [x] 6.3 端到端验证该示例 skill 在“生日未到”和“今年已过生日”两种场景下都能返回正确天数。
- [x] 6.4 补充必要文档或说明，记录两类数据库 skill 的字段约定、执行差异、对外文案与迁移注意事项。
