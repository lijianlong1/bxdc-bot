## 1. Java Skill Gateway - Compute 端点

- [x] 1.1 在 SkillController 或新建 ComputeController 中新增 `POST /api/skills/compute` 端点
- [x] 1.2 实现请求体解析：`{ "operation": "<op>", "operands": [...] }`，支持 operation 为 add/subtract/multiply/divide/factorial/square/sqrt/timestamp_to_date
- [x] 1.3 实现加减乘除运算（operands 两个数字，除法除数为 0 返回错误）
- [x] 1.4 实现阶乘（operands 一个非负整数，n 过大时返回错误）、平方、开方（operands 一个非负数字，负数返回错误）
- [x] 1.5 实现 timestamp_to_date：毫秒级 Unix 时间戳转 YYYY-MM-DD 字符串（按系统默认时区）
- [x] 1.6 统一响应格式：成功 `{ "result": <value> }`，失败 `{ "error": "<message>" }`；复用 X-Agent-Token 认证

## 2. Agent Core - JavaComputeTool

- [x] 2.1 在 `java-skills.ts` 中新增 `JavaComputeTool`，与 JavaSshTool/JavaApiTool 一致地调用 `{gateway}/api/skills/compute`
- [x] 2.2 为 JavaComputeTool 编写 description，明确说明可执行时间戳转日期、加减乘除、阶乘、平方、开方
- [x] 2.3 在 `agent.ts` 的 tools 数组中注册 JavaComputeTool

## 3. 测试

- [x] 3.1 为 compute 端点编写单元测试：各 operation 的正确性与错误处理（除零、负数开方、无效 operation 等）
- [x] 3.2 验证 Agent 能通过 JavaComputeTool 成功调用 compute 并返回正确结果（可选集成测试）
