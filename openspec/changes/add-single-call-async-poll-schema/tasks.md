## 1. 后端 - SystemSkillController schema 扩展

- [x] 1.1 在 `buildApiConfigSchema()` 中新增 `asyncPollEnabled` 字段（type: boolean, ui: checkbox, default: false）
- [x] 1.2 新增 `asyncPollStrategy` 字段（type: string, ui: radio, enum: ["PERIODIC", "SINGLE_CALL"], default: "PERIODIC"）
- [x] 1.3 新增 `asyncPollReadTimeoutSeconds` 字段（type: number, ui: number, default: 600, minimum: 1, maximum: 3600），添加 `visibleWhen` 约束仅在 SINGLE_CALL 时可见
- [x] 1.4 为已有 `asyncPoll` JSON 编辑器字段添加 `visibleWhen` 约束（仅在 `asyncPollEnabled === true` 且 `asyncPollStrategy === "PERIODIC"` 时可见）

## 2. 前端 - ConfigFormRenderer 新 UI 类型

- [x] 2.1 type 定义扩展：`ConfigSchemaProperty` 新增可选 `visibleWhen?: { field: string; equals: unknown }` 字段
- [x] 2.2 实现 checkbox 渲染：`ui === "checkbox"` 时使用 `<t-checkbox>`，modelValue 绑定 boolean
- [x] 2.3 实现 radio 渲染：`ui === "radio"` 时使用 `<t-radio-group>`，选项来自 `enum` 数组
- [x] 2.4 实现 visibleWhen 过滤器：在 computed 中过滤 properties，只渲染满足条件的字段

## 3. 前端 - SkillManagementModal 字段对齐

- [x] 3.1 `draftToFormValues` 扩展：从 apiDraft 读取 `asyncPollEnabled`、`asyncPollStrategy`、`asyncPollReadTimeoutSeconds` 写入返回值
- [x] 3.2 `updateDraftFromFormValues` 扩展：从 values 读取上述字段写回 apiDraft（覆盖 `skillEditor.ts` 中已有的派生逻辑）

## 4. 验证

- [x] 4.1 本地启动 gateway，访问 `/api/system-skills/execution-types`，确认新字段在 JSON 中
- [x] 4.2 前端 `npm run build` 确保无 TS 编译错误（仅剩合并遗留的 MessageInput/MessageList 错误，非本次变更引入）
- [ ] 4.3 手动测试：新建/编辑 API Skill → 勾选异步轮询 → 切换 PERIODIC/SINGLE_CALL → 保存 → 重新打开确认回填正确
