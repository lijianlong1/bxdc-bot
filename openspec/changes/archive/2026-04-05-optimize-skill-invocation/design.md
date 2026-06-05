## Context

当前系统中，技能（skill）在被调用时，`loadGatewayExtendedTools` 会一次性加载该 skill 的所有参数。由于 skill 可能包含大量复杂的参数配置，这种全量加载会导致不必要的性能开销，尤其是在仅需要展示 skill 列表（如名称和简介）的场景下。此外，当前的字段名称不够直观，`Name` 和 `Description` 需要分别展示为“名称”和“技能介绍”，以提升用户体验。

## Goals / Non-Goals

**Goals:**
- 将 `Name` 字段的中文展示更新为“名称”。
- 将 `Description` 字段的中文展示更新为“技能介绍”。
- 优化 `loadGatewayExtendedTools`，在初始加载时仅获取 `Name` 和 `Description`。
- 在用户或系统确认调用该 skill 时，再动态加载该 skill 的全量其他参数。

**Non-Goals:**
- 不改变 skill 的核心执行逻辑和底层数据结构。
- 不涉及其他非 skill 相关的工具加载逻辑优化。

## Decisions

1. **字段名称更新**
   - **Decision**: 在前端展示层或 API 返回的数据转换层，将 `Name` 映射为“名称”，`Description` 映射为“技能介绍”。
   - **Rationale**: 提升界面的本地化体验，让用户更容易理解字段含义。

2. **延迟加载参数 (Lazy Loading)**
   - **Decision**: 修改 `loadGatewayExtendedTools` 的实现。默认情况下，查询 skill 列表时只返回 `Name` 和 `Description`。增加一个新的方法或在原有调用逻辑中增加一个步骤，当明确需要执行 skill 时，通过 skill ID 获取其完整的参数定义。
   - **Rationale**: 减少初始加载的数据量和内存占用，提高系统响应速度。

## Risks / Trade-offs

- **[Risk] 延迟加载带来的额外网络请求或查询开销** → **Mitigation**: 仅在确认调用时触发全量参数加载，此时用户已经做出了明确的操作，稍微的延迟是可以接受的。
- **[Risk] 现有依赖全量参数的逻辑可能会报错** → **Mitigation**: 仔细排查所有调用 `loadGatewayExtendedTools` 的地方，确保只有在真正需要全量参数的环节才去获取完整数据，必要时提供兼容的 fallback 机制。