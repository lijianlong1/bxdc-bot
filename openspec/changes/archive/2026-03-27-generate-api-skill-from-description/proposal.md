## Why

当前系统虽然已经支持通过 SkillGateway 持久化和动态加载 Extended Skills，但新增一个 API 类型的 skill 仍然需要人工整理接口说明、手写 `configuration`、再手动执行验证，流程繁琐且容易出错。为了让新增 API skill 的过程更接近自然语言协作，需要提供一个 built-in skill，能够根据用户输入的 API 描述自动生成符合现有标准的 skill 配置，并立即执行一次验证请求。

## What Changes

- 新增一个 built-in skill，用于接收用户提供的 API 描述并生成符合当前 SkillGateway / Agent Core 标准的 API skill。
- 为该 built-in skill 增加结构化输出能力，至少产出可直接写入 `skills.configuration` 的配置、推荐的 `name` / `description`，以及必要的执行参数说明。
- 增加一条自动化验证链路：在新 skill 生成并保存后，由系统立即调用该 skill 一次，返回验证结果给用户。
- 为生成失败、接口描述不完整、验证失败等情况补充清晰的错误反馈，避免生成不可用或含糊的 skill。

## Capabilities

### New Capabilities
- `api-skill-generation`: 根据用户提供的 API 描述自动生成 API 类型的 Extended Skill，并在生成后执行一次验证调用。

### Modified Capabilities
无

## Impact

- **Agent Core**：新增一个 built-in skill 负责解析 API 描述、生成 skill 配置、触发保存与试跑验证。
- **SkillGateway**：复用现有 `skills` CRUD 与 `/api/skills/api` 代理接口承载新生成的 skill 持久化与验证执行。
- **Skill 数据模型/配置标准**：需要明确 API 类型 skill 的标准配置字段，确保生成结果与当前动态加载逻辑兼容。
- **对话体验**：Agent 在收到 API 描述后，可以直接完成“生成 skill + 验证可用性”的闭环反馈。
