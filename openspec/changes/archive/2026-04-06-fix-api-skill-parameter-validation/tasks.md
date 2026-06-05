## 1. Setup and Dependencies

- [x] 1.1 在后端项目 (`backend/agent-core/package.json`) 中安装 `ajv` 和 `ajv-formats` (如果尚未安装)。

## 2. Implement Parameter Validation

- [x] 2.1 在 `backend/agent-core/src/tools/java-skills.ts` 中，引入 `Ajv` 并初始化一个实例。
- [x] 2.2 在 `executeConfiguredApiSkill` 函数（或执行 API skill 的位置）中，添加逻辑以使用 `ajv` 根据 `config.parameterContract` 校验传入的 `args`。
- [x] 2.3 如果校验失败，将 `ajv` 错误格式化为清晰可读的字符串。
- [x] 2.4 抛出包含格式化校验信息的错误，以便 agent 框架可以捕获并将其返回给大模型。

## 3. Enhance Prompt Generation

- [x] 3.1 在 `backend/agent-core/src/tools/java-skills.ts` 中，找到构建工具 `description` 的 `buildGeneratedSkill` 函数（或类似函数）。
- [x] 3.2 更新描述生成逻辑，以明确包含来自 `parameterContract` 的信息（例如：必填字段、类型、枚举值、默认值），从而更好地指导大模型。

## 4. Testing

- [x] 4.1 在 `backend/agent-core/test/java-skills.loader.test.cjs`（或相关的测试文件）中编写单元测试，以验证有效参数能够通过校验。
- [x] 4.2 编写单元测试，以验证无效参数（缺少必填项、类型错误、枚举值错误）无法通过校验，并产生预期的错误信息。
- [x] 4.3 运行所有后端测试（`npm run test:tools` 或类似命令）以确保没有破坏任何功能。
