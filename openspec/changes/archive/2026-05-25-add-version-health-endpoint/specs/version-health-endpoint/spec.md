# version-health-endpoint Specification

## Purpose

约定 agent-core 与 skill-gateway 各自的 health check 接口均返回服务版本号，版本号来源于各项目根目录下手动维护的 `VERSION` 纯文本文件。

## ADDED Requirements

### Requirement: agent-core 版本健康检查

agent-core 的 `GET /health` 接口 SHALL 在现有 JSON 响应中包含 `version` 字段，值来源于 `backend/agent-core/VERSION` 文件。

#### Scenario: 正常返回版本号

- **WHEN** 浏览器或运维工具访问 `GET /health`
- **THEN** HTTP 状态码 SHALL 为 200
- **AND** 响应体 SHALL 包含 `version` 字段（值为 `VERSION` 文件内容，如 `"2.1.0"`）
- **AND** 响应体 SHALL 保留已有字段：`status`、`service`、`timestamp`、`uptimeSeconds`

#### Scenario: VERSION 文件不存在

- **WHEN** `backend/agent-core/VERSION` 文件被误删或部署时缺失
- **THEN** `GET /health` SHALL 仍返回 200
- **AND** `version` 字段 SHALL 为 `"unknown"`
- **AND** 服务 SHALL NOT 因缺少文件而启动失败

#### Scenario: VERSION 文件内容有换行符

- **WHEN** `VERSION` 文件末尾包含 `\n` 或 `\r\n`
- **THEN** 读取逻辑 SHALL 使用 `.trim()` 去除首尾空白字符
- **AND** 返回的 `version` 值 SHALL 不包含换行符

#### Scenario: 版本读取方式

- **WHEN** 服务启动时
- **THEN** 版本号 SHALL 一次性读取并缓存在内存变量中
- **AND** 后续每次 `/health` 请求 SHALL 直接使用缓存值
- **AND** SHALL NOT 每次请求都重新读取文件

### Requirement: skill-gateway 版本健康检查

skill-gateway 的 `GET /api/health` 接口 SHALL 在现有 JSON 响应中包含 `version` 字段，值来源于 `backend/skill-gateway/VERSION` 文件。

#### Scenario: 正常返回版本号

- **WHEN** 浏览器或运维工具访问 `GET /api/health`
- **THEN** HTTP 状态码 SHALL 为 200
- **AND** 响应体 SHALL 包含 `version` 字段（值为 `VERSION` 文件内容，如 `"2.1.0"`）
- **AND** 响应体 SHALL 保留已有字段：`status`、`service`、`timestamp`、`uptimeSeconds`

#### Scenario: VERSION 文件不存在

- **WHEN** `backend/skill-gateway/VERSION` 文件未被包含在 classpath 或部署时缺失
- **THEN** `GET /api/health` SHALL 仍返回 200
- **AND** `version` 字段 SHALL 为 `"unknown"`
- **AND** 服务 SHALL NOT 因缺少文件而启动失败

#### Scenario: VERSION 文件内容有换行符

- **WHEN** `VERSION` 文件末尾包含 `\n` 或 `\r\n`
- **THEN** 读取逻辑 SHALL 使用 `.trim()` 去除首尾空白字符
- **AND** 返回的 `version` 值 SHALL 不包含换行符

#### Scenario: 版本读取方式

- **WHEN** Bean 初始化时（`@PostConstruct`）
- **THEN** 版本号 SHALL 一次性读取并保存在字段中
- **AND** 后续每次 `/api/health` 请求 SHALL 直接使用该字段值
- **AND** SHALL NOT 每次请求都重新读取文件

### Requirement: VERSION 文件规范

两个项目的 `VERSION` 文件 SHALL 遵循统一格式。

#### Scenario: 文件位置

- **WHEN** 部署构建产物
- **THEN** `VERSION` 文件 SHALL 位于各项目根目录下（与 `package.json` / `pom.xml` 同级）
- **AND** agent-core 的 `VERSION` 文件 SHALL 在编译时被拷贝到 `dist/` 目录（或通过 `assets` 配置）
- **AND** skill-gateway 的 `VERSION` 文件 SHALL 位于 `src/main/resources/` 下（随 classpath 打包进 JAR）

#### Scenario: 文件内容格式

- **WHEN** 开发人员手动维护版本号
- **THEN** `VERSION` 文件内容 SHALL 为纯文本，第一行为版本号
- **AND** 建议格式为语义化版本（如 `2.1.0`），但 SHALL NOT 强制校验格式
- **AND** 文件编码 SHALL 为 UTF-8

#### Scenario: VERSION 文件纳入版本控制

- **WHEN** 查看 `.gitignore`
- **THEN** `VERSION` SHALL NOT 被忽略
- **AND** 修改版本号 SHALL 作为正常代码提交的一部分

### Requirement: 响应格式一致

两个服务的 health check 响应格式 SHALL 保持一致的结构。

#### Scenario: 统一 JSON 结构

- **WHEN** 访问任一服务的 health 接口
- **THEN** 响应 SHALL 符合以下 JSON Schema：
```json
{
  "status": "ok",
  "service": "<agent-core|skill-gateway>",
  "version": "<VERSION 文件内容>",
  "timestamp": "<ISO-8601>",
  "uptimeSeconds": 12345
}
```
- **AND** `version` 字段的位置 SHALL 在 `service` 之后、`timestamp` 之前

### Requirement: 不新增外部依赖

此变更 SHALL NOT 引入任何新的 npm 或 Maven 依赖。

#### Scenario: agent-core 不引入新依赖

- **WHEN** 实现版本号读取
- **THEN** SHALL 使用 Node.js 内置 `fs.readFileSync` 读取文件
- **AND** SHALL NOT 安装任何新的 npm 包

#### Scenario: skill-gateway 不引入新依赖

- **WHEN** 实现版本号读取
- **THEN** SHALL 使用 Spring 的 `ClassPathResource` 或 `InputStream` 读取文件
- **AND** SHALL NOT 在 `pom.xml` 中新增任何 `<dependency>`
