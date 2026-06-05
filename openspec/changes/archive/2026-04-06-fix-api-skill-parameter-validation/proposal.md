## Why

目前，当要求大模型调用 API skill 时，它经常无法生成严格遵守已定义 JSON schema 的参数（例如：缺少必填字段、类型不正确或忽略默认值）。此外，系统在发送请求之前缺乏严格的校验，导致 API 调用格式错误。此变更旨在确保大模型接收到明确的参数约束，并且系统在执行之前严格根据 skill 定义的 schema 对生成的参数进行校验。

## What Changes

- **增强参数 Schema 提示词**: 改进提示词生成逻辑，在调用 API skill 时向大模型清晰地传达预期的参数 schema（包括类型、描述、枚举值和默认值）。
- **严格的参数校验**: 实现严格的校验逻辑，在执行 API 调用之前，根据 skill 的 `parameterContract` (JSON schema) 检查大模型生成的参数。
- **错误反馈循环**: 如果校验失败，向大模型返回结构化的错误信息，促使其纠正参数并重试。

## Capabilities

### New Capabilities
- `api-parameter-validation`: 在执行之前，根据定义的 JSON schema 对 API skill 参数进行严格校验。

### Modified Capabilities
- `api-skill-invocation`: 增强该能力，加入严格的参数校验和错误反馈机制。

## Impact

- **Backend (`agent-core`)**: 修改工具执行逻辑（可能在 `java-skills.ts` 或相关文件中）以实现 JSON schema 校验。
- **Prompt Generation**: 更新向大模型呈现 skill 描述和参数 schema 的方式。
