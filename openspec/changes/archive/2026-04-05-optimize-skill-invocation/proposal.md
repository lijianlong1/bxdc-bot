## Why

我们需要优化技能（skill）的字段名称展示以及调用方式。当前字段名称不够直观，且在加载工具时一次性加载了所有参数，可能会导致不必要的性能开销或上下文冗余。通过延迟加载全量参数，可以提升系统的响应速度和资源利用率。

## What Changes

- 修改字段名称展示：
  - `Name` 字段中文名展示为“名称”。
  - `Description` 字段中文展示为“技能介绍”。
- 调整 skill 调用方式：
  - 在 `loadGatewayExtendedTools` 阶段，仅加载 `Name` 和 `Description` 字段。
  - 当确认要调用该 skill 时，再加载该 skill 的全量其他参数。

## Capabilities

### New Capabilities

- `skill-invocation-optimization`: 优化 skill 字段展示名称和延迟加载参数的机制。

### Modified Capabilities

- `api-skill-flow`: 修改了 `loadGatewayExtendedTools` 的行为。

## Impact

- 影响 `loadGatewayExtendedTools` 函数的实现逻辑。
- 影响前端或 UI 层对 `Name` 和 `Description` 字段的中文展示。
- 影响 skill 确认调用时的参数加载逻辑。