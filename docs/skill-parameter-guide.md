# API Skill 参数格式契约配置指南

本文档说明创建 API Skill 时如何通过 `parameterContract`（JSON Schema）配置参数，包括**可选/必选**、**静态枚举下拉**和**在线字典值**。


## 一、参数格式契约基础

`parameterContract` 是一个符合 [JSON Schema](https://json-schema.org/) 的 JSON 对象，定义 API Skill 调用时 LLM 应传入的参数集合。

### 最小示例

```json
{
  "type": "object",
  "properties": {
    "page": { "type": "number", "description": "页码" },
    "keyword": { "type": "string", "description": "搜索关键词" }
  },
  "required": []
}
```

**字段说明：**

| 字段 | 必须 | 说明 |
|------|------|------|
| `type` | 是 | 固定为 `"object"` |
| `properties` | 是 | 参数定义集合，key 为参数名 |
| `required` | 否 | 必填参数名数组，不在此列表中的即为可选 |

### 每个 `property` 支持的字段

| 字段 | 说明 |
|------|------|
| `type` | 参数类型：`"string"` / `"number"` / `"integer"` / `"boolean"` |
| `description` | 参数说明，会展示给 LLM 帮助理解 |
| `default` | 默认值，LLM 未传时自动填充 |
| `enum` | 静态枚举值，前端展示为下拉框 |
| `enumSource` | 在线字典值配置，前端从 API 动态获取下拉选项 |

> **注意**：`enum` 和 `enumSource` 互斥，只选一种。


## 二、可选参数 vs 必选参数

### 可选参数（默认）

只要参数名**不在** `required` 数组中，就是可选参数。

```json
{
  "type": "object",
  "properties": {
    "page": { "type": "number", "description": "页码，默认第1页", "default": 1 },
    "size": { "type": "number", "description": "每页条数，默认10", "default": 10 },
    "keyword": { "type": "string", "description": "搜索关键词" }
  },
  "required": []
}
```

效果：
- 所有三个参数都是可选
- LLM 可以传任意组合：`{}`, `{"keyword": "测试"}`, `{"page": 2}` 等
- `page` 和 `size` 有默认值，未传时自动使用

### 必选参数

将参数名加入 `required` 数组。

```json
{
  "type": "object",
  "properties": {
    "taskName": { "type": "string", "description": "任务名称" },
    "priority": { "type": "string", "description": "优先级", "default": "normal" }
  },
  "required": ["taskName"]
}
```

效果：
- `taskName`：**必填**，不传则参数校验失败
- `priority`：可选，未传时默认 `"normal"`

### 最佳实践

| 场景 | 建议 |
|------|------|
| API Key / Token 类固定值 | 用 `default` 设置，不在 `required` 中 |
| 每次都需要的业务参数 | 放在 `required` 中 |
| 有合理默认值的 | 设 `default` + 不在 `required` |
| 可留空的搜索/过滤 | 不设 `default`，不放在 `required` |


## 三、静态枚举下拉

### 简化写法（仅值列表）

```json
{
  "type": "object",
  "properties": {
    "sort": {
      "type": "string",
      "description": "排序方式",
      "enum": ["asc", "desc", "popular"],
      "default": "desc"
    }
  },
  "required": []
}
```

效果：前端下拉框中显示三个选项 `asc` / `desc` / `popular`，值和展示文案相同。

### Label/Value 写法（推荐）

当需要**展示中文标签但传英文值**时：

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "description": "任务状态",
      "enum": [
        { "label": "待处理", "value": "pending" },
        { "label": "处理中", "value": "running" },
        { "label": "已完成", "value": "completed" },
        { "label": "已失败", "value": "failed" }
      ],
      "default": "pending"
    }
  },
  "required": ["status"]
}
```

效果：前端下拉显示 `待处理` / `处理中` / `已完成` / `已失败`，实际传给 API 的是 `"pending"` / `"running"` / `"completed"` / `"failed"`。

### 数字枚举

```json
{
  "type": "object",
  "properties": {
    "pageSize": {
      "type": "number",
      "description": "每页条数",
      "enum": [10, 20, 50, 100],
      "default": 20
    }
  },
  "required": []
}
```


## 四、在线字典值（`enumSource`）

当枚举值需要**从外部 API 动态获取**（例如项目列表、部门列表、服务器台账等），使用 `enumSource`。

### 基本结构

```json
{
  "type": "object",
  "properties": {
    "serverId": {
      "type": "string",
      "description": "目标服务器",
      "enumSource": {
        "url": "https://api.example.com/servers",
        "jsonPath": "data.list",
        "valueKey": "id",
        "labelKey": "name"
      }
    }
  },
  "required": ["serverId"]
}
```

### `enumSource` 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | **是** | — | 获取选项的 API 地址（GET 请求） |
| `method` | 否 | `"GET"` | HTTP 方法 |
| `headers` | 否 | `{}` | 请求头（JSON 对象，如 `{"Authorization": "Bearer xxx"}`） |
| `jsonPath` | 否 | 无（取根路径） | 从响应中提取选项数组的 JSON Path（如 `"data.list"`） |
| `valueKey` | 否 | `"value"` | 选项值的字段名 |
| `labelKey` | 否 | `"label"` | 选项展示文本的字段名 |
| `searchParam` | 否 | 无 | 搜索参数字段名（支持前端输入搜索时拼接到 URL） |
| `refreshIntervalSec` | 否 | `300` | 缓存刷新间隔（秒），在此期间不从 API 重新拉取 |

### 示例场景

#### 场景 1：简单字典接口

上游 API 返回格式：

```json
{
  "code": 0,
  "data": [
    { "id": "srv-01", "name": "生产服务器-北京" },
    { "id": "srv-02", "name": "测试服务器-上海" }
  ]
}
```

`parameterContract` 配置：

```json
{
  "type": "object",
  "properties": {
    "serverId": {
      "type": "string",
      "description": "目标服务器",
      "enumSource": {
        "url": "https://your-api.example.com/servers",
        "jsonPath": "data",
        "valueKey": "id",
        "labelKey": "name"
      }
    }
  },
  "required": ["serverId"]
}
```

#### 场景 2：带认证头的字典接口

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "所属项目",
      "enumSource": {
        "url": "https://your-api.example.com/projects",
        "headers": {
          "Authorization": "Bearer your-static-token"
        },
        "jsonPath": "projects",
        "valueKey": "projectId",
        "labelKey": "projectName"
      }
    }
  },
  "required": ["projectId"]
}
```

#### 场景 3：支持搜索的字典接口

当上游 API 支持 `?keyword=` 搜索参数时：

```json
{
  "type": "object",
  "properties": {
    "departmentId": {
      "type": "string",
      "description": "部门",
      "enumSource": {
        "url": "https://your-api.example.com/departments",
        "jsonPath": "data",
        "valueKey": "id",
        "labelKey": "name",
        "searchParam": "keyword"
      }
    }
  },
  "required": ["departmentId"]
}
```

前端搜索"技术"时，实际请求：
```
GET https://your-api.example.com/departments?keyword=%E6%8A%80%E6%9C%AF
```

### `enumSource` 数据流

```
Skill Management 页面加载
    ↓
检测 enumSource 配置
    ↓
POST /api/skills/enum-source → skill-gateway
    ↓ callApi(url, method, headers)
上游 API 返回 JSON
    ↓ jsonPath 提取数组
    ↓ valueKey/labelKey 提取 key-value
    ↓
前端下拉框展示
    │
    │  refreshIntervalSec 控制缓存,
    │  过期后重新拉取(默认300s)
    │
    ↻
```


## 五、完整配置示例

以下是一个综合示例，展示了可选参数、静态枚举和在线字典值的混合使用：

```json
{
  "type": "object",
  "properties": {
    "env": {
      "type": "string",
      "description": "部署环境",
      "enum": [
        { "label": "开发环境", "value": "dev" },
        { "label": "测试环境", "value": "test" },
        { "label": "预发布", "value": "staging" },
        { "label": "生产环境", "value": "prod" }
      ],
      "default": "dev"
    },
    "serverId": {
      "type": "string",
      "description": "目标服务器（从台账中选择）",
      "enumSource": {
        "url": "https://your-api.example.com/servers",
        "jsonPath": "data",
        "valueKey": "id",
        "labelKey": "name"
      }
    },
    "action": {
      "type": "string",
      "description": "操作类型",
      "enum": ["restart", "stop", "status"],
      "default": "status"
    },
    "version": {
      "type": "string",
      "description": "部署版本号（可选，不填则用最新版本）"
    },
    "skipBackup": {
      "type": "boolean",
      "description": "是否跳过备份",
      "default": false
    }
  },
  "required": ["serverId"]
}
```

效果：
- `env`：下拉可选 4 个环境，默认开发，**非必填**
- `serverId`：从在线 API 动态拉取服务器列表，**必填**
- `action`：静态下拉 3 个操作，默认 `"status"`，**非必填**
- `version`：自由输入文本，**非必填**（可选参数）
- `skipBackup`：布尔开关，默认 `false`，**非必填**


## 六、常见问题

### Q: `enum` 和 `enumSource` 可以同时存在吗？

**不可以。** 它们是互斥的。前者用于静态枚举，后者用于动态从 API 获取。

### Q: `enumSource` 的响应格式有要求吗？

上游 API 响应必须是 JSON。`jsonPath` 取到的值必须是**数组**，数组中每个元素包含 `valueKey` 和 `labelKey` 对应的字段。

### Q: 可选参数 LLM 不传时参数校验会报错吗？

不会。`required` 列表之外的参数，LLM 可以自由决定传或不传。不传时，如果配置了 `default` 会自动填充，无 `default` 则该字段不出现在实际请求中。

### Q: 如何调试 enumSource？

在浏览器 Network 面板查看 `POST /api/skills/enum-source` 请求的请求体和响应。或查看 skill-gateway 控制台日志。

### Q: 参数绑定 (`parameterBinding`) 影响 enum?

不影响。`parameterBinding` 只决定参数映射到 HTTP 请求的位置（URL Query / JSON Body / Form Body），与参数的可选性、枚举来源无关。


## 七、相关规范

- JSON Schema 标准：https://json-schema.org/
- AI 优化参数契约：在 Skill 编辑表单中点击 "✨ AI 优化" 按钮，可让大模型自动补全和修正参数格式契约
- 异步轮询配置：`asyncPoll` 字段说明见 [api-skill-upstream-requirements.md](./api-skill-upstream-requirements.md)
