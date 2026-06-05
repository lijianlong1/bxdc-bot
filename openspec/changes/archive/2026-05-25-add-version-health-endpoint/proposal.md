## Why

当前运维人员无法快速判断生产/测试环境部署的是哪个版本的 agent-core 和 skill-gateway。现有的 `/health` 和 `/api/health` 接口只返回服务状态和运行时长，不包含版本号信息。在大版本不依赖 git tag 的发布流程中，需要一个人工可维护的版本文件来标识当前部署的服务版本。

因此，为 agent-core 和 skill-gateway 各自新增一个 VERSION 文本文件，并在已有的 health check 接口中返回版本号，使得运维人员通过浏览器直接访问即可得知当前服务版本。

## What Changes

- **agent-core**：
  - 在项目根目录（`backend/agent-core/`）新增 `VERSION` 文本文件，内容由开发人员在发版时手动更新
  - 修改 `health.controller.ts`：在 `/health` 接口的 JSON 响应中新增 `version` 字段，值从 `VERSION` 文件读取
  - 服务启动时一次性读取版本号到内存，避免每次请求都读文件

- **skill-gateway**：
  - 在项目根目录（`backend/skill-gateway/`）新增 `VERSION` 文本文件，内容由开发人员在发版时手动更新
  - 修改 `HealthController.java`：在 `/api/health` 接口的 JSON 响应中新增 `version` 字段，值从 `VERSION` 文件读取
  - 通过 Spring `@Value` 或 `@PostConstruct` 从 classpath 读取，缓存在字段中

- **不变量**：
  - 两个 health 接口的现有字段（`status`、`service`、`timestamp`、`uptimeSeconds`）保持不变
  - `VERSION` 文件不在 `.gitignore` 中（需要版本跟踪）
  - `/health` 和 `/api/health` 的鉴权策略不变（当前均为放通）

## Capabilities

### New Capabilities

- `version-health-endpoint`: agent-core 与 skill-gateway 的 health check 接口均返回 `version` 字段，值来源于项目根目录下手动维护的 `VERSION` 文件。

### Modified Capabilities

（无；仅扩展已有 health 接口的响应字段，不改变现有能力。）

## Impact

| 影响范围 | 说明 |
|----------|------|
| `backend/agent-core/VERSION` | **新增**，纯文本，一行版本号如 `2.1.0` |
| `backend/agent-core/src/controller/health.controller.ts` | **修改**，读取 VERSION 文件并在响应中添加 `version` 字段 |
| `backend/skill-gateway/VERSION` | **新增**，纯文本，一行版本号如 `2.1.0` |
| `backend/skill-gateway/src/main/java/.../controller/HealthController.java` | **修改**，读取 VERSION 文件并在响应中添加 `version` 字段 |
| 零依赖新增 | 纯标准库（Node.js `fs` / Java `ClassPathResource`）实现，不引入任何 npm/maven 依赖 |
