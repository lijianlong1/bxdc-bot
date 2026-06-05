## 1. Built-in Skill 生成链路

- [x] 1.1 在 `Agent Core` 中新增一个 built-in skill，用于接收用户提供的 API 描述并提取标准化 skill 字段。
- [x] 1.2 为生成器实现 API 类型 skill 配置归一化逻辑，输出符合当前 `configuration` 协议的 `kind`、`operation`、`method`、`endpoint`、`headers`、`query` 等字段。
- [x] 1.3 为生成器补充推荐 `name`、`description`、验证输入和错误提示逻辑，确保描述不完整时不会生成不可执行 skill。

## 2. 持久化与验证执行

- [x] 2.1 复用现有 SkillGateway CRUD 接口，实现新生成 skill 的创建或同名更新逻辑。
- [x] 2.2 在 skill 保存成功后串联一次自动验证调用，并将验证输入传给新生成的 skill 执行链路。
- [x] 2.3 区分“生成失败”“保存失败”“验证失败”三类结果，统一返回结构化反馈给用户。

## 3. 测试与联调

- [x] 3.1 为生成器补充单元测试，覆盖完整 API 描述、缺少关键字段、同名更新等场景。
- [x] 3.2 为自动验证链路补充测试，覆盖验证成功、外部 API 返回错误、返回体不可解析等场景。
- [x] 3.3 进行一次端到端联调：输入一段 API 描述，确认系统能生成 skill、保存到 SkillGateway，并完成一次实际试跑验证。
