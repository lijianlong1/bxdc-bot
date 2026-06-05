# 数据库 Skill 类型说明

## 背景

系统现在支持两类存储在数据库中的 Skill，统一保存在 `skills` 表中，并继续使用 `type=EXTENSION` 表示它们属于可动态加载的数据库技能。

真正决定执行方式的是新增字段 `execution_mode`：

- `CONFIG`
- `OPENCLAW`

前端和聊天窗口不会直接展示这两个内部枚举值，而是映射为更易懂的中文文案。

## 对外文案

| 内部值 | 对外展示 |
|---|---|
| `CONFIG` | `预配置` |
| `OPENCLAW` | `自主规划` |

## 两类 Skill 的差异

### 1. 预配置

`CONFIG` 类型用于稳定、确定性的数据库技能。

典型特点：

- 通过结构化 `configuration` 直接驱动执行
- 后端按 `kind` + `preset` / `operation` 进入固定 handler
- 更适合 API 请求、时间查询、服务器状态等强确定性任务
- 聊天窗口通常只展示单层 skill 状态

当前示例：

- `获取时间`
- `服务器资源状态`
- `获取笑话列表`

### 2. 自主规划

`OPENCLAW` 类型用于需要模型在受限工具集内自主规划的数据库技能。

典型特点：

- `configuration` 中包含 prompt/orchestration 协议
- 必须声明 `allowedTools`
- 当前只支持 `serial` 串行编排
- 聊天窗口会展示外层 skill 以及内部子工具轨迹
- 如果用户输入无法可靠解析，必须先追问澄清，不能静默猜测

当前示例：

- `查询距离生日还有几天`

## `skills` 表关键字段

| 字段 | 说明 |
|---|---|
| `type` | 仍表示来源/载体类型，当前数据库技能统一为 `EXTENSION` |
| `execution_mode` | 决定运行方式，取值为 `CONFIG` 或 `OPENCLAW` |
| `configuration` | 具体执行协议；两类 skill 的结构不同 |
| `enabled` | 是否启用 |
| `requires_confirmation` | 是否需要确认 |

## OPENCLAW 配置约定

首版 `OPENCLAW` Skill 的 `configuration` 约定至少包含：

- `kind: "openclaw"`
- `systemPrompt`
- `orchestration.mode: "serial"`

`allowedTools` 为可选字段：

- 可以提供非空数组，限制该 Skill 可调用的内部工具范围
- 也可以保存为空数组，表示这是一个“仅提示词”的自主规划 Skill

示例：

```json
{
  "kind": "openclaw",
  "systemPrompt": "你是一个生日倒计时助手。先查当前日期，再调用计算工具。",
  "allowedTools": ["获取时间", "compute"],
  "orchestration": {
    "mode": "serial"
  }
}
```

## 结构化维护约定

Skill 管理窗口现在不再要求用户直接维护整段 `configuration` JSON，而是按类型提供结构化字段，并在保存时由系统自动拼接为最终 JSON。

### CONFIG

结构化编辑只维护两个基础 `kind`：

- `api`
- `ssh`

在基础类型之下，再通过 `preset` 表示预配置模板。

当前支持的模板示例：

- `kind=api`, `preset=current-time`
- `kind=ssh`, `preset=server-resource-status`

对应规则：

- `api`：维护 `operation`、`method`、`endpoint`，以及可选的 `preset`、`responseWrapper`、`responseTimestampField`、`headers/query/body` JSON 字段、`apiKeyField`、`apiKey`、`autoTimestampField`
- `ssh`：维护 `preset`、`operation`、`lookup`、`executor`、`command`、`readOnly`

### OPENCLAW

结构化编辑会维护：

- Markdown 格式提示词
- `allowedTools`
- `orchestration.mode`

其中：

- 提示词输入区允许直接输入 Markdown 文本
- 保存时 Markdown 原文直接写入 `configuration.systemPrompt`
- `allowedTools` 通过结构化列表维护，不需要手写 JSON 数组
- 如果不需要调用任何工具，可以留空并保存为 `[]`
- 当前编排模式固定为 `serial`

## 历史数据兼容

- 编辑已有 Skill 时，系统会先尝试把历史 `configuration` 解析为结构化表单
- 旧配置 `kind=time` 会被映射为 `kind=api, preset=current-time`
- 旧配置 `kind=monitor` 会被映射为 `kind=ssh, preset=server-resource-status`
- 如果配置包含当前结构化编辑尚不支持的字段或协议不匹配，界面会展示明确提示
- 出现解析失败时，系统会阻止直接结构化覆盖保存，避免静默丢失未知字段

## 轨迹展示规则

### 预配置

- 只展示单层 skill 状态

### 自主规划

- 展示外层 skill 主条目
- 展示内部子工具调用轨迹
- 子工具轨迹至少包含：
  - 工具名称
  - 执行状态
  - 可选摘要

## 迁移与兼容

- 历史数据库记录如果没有 `execution_mode`，服务端会按 `CONFIG` 兜底处理
- 新写入与编辑后保存统一持久化为 canonical 模型：`kind=api|ssh` + 可选/必选 `preset`
- 历史 `time` / `monitor` 配置在兼容窗口内仍可被读取和执行，并会在再次保存时自动转换为 canonical 模型
- `data.sql` 已将默认技能切换为 canonical 模型
- 前端在接口未返回 `execution_mode` 时也会默认按 `预配置` 处理，避免旧数据导致页面报错
- 回滚时可恢复旧写入路径，但建议继续保留旧配置读取兼容，避免存量数据失效

## 验证现状

本次改造已覆盖：

- `skill-gateway` CRUD / 种子数据 / compute 能力更新
- `agent-core` 双类型装载与 `OPENCLAW` 串行执行
- 聊天窗口子工具轨迹渲染
- Skill Hub 类型标签展示

仍建议继续补充：

- 前端层级 SSE 渲染的更完整联调验证
- Skill Hub 混合类型列表的浏览器层验证
