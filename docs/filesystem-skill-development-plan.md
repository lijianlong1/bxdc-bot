# 文件系统 Skill 开发方案（完善版）

> 版本: v2.0 | 日期: 2026-06-08 | 开发人数: 3人

---

## 对比 8 项顶层要求的方案调整

| # | 顶层要求 | 原方案状态 | 调整内容 |
|---|---------|-----------|---------|
| 1 | 支持上传 `.md/.txt/.ppt/.xlsx/.docx/.dsps/.py`，仅供自己使用 | 部分覆盖 | 补充 `dsps`/`py` 类型；明确用户隔离的独立上传 API |
| 2 | 上传及附件管理完全独立，与大模型无关 | **缺失** | 新增独立的文件管理 CRUD API 章节 |
| 3 | 大模型可读写/复制/删除/新建文件 | 仅有 read/write | 扩展 action 枚举：增加 `copy`/`delete`/`create` |
| 4 | 分片读取为核心：确定文件 → 了解结构 → 拉取相关内容 → 完成任务 | 已有 outline→range | **提升为核心设计原则**，所有文件类型围绕此流程设计 |
| 5 | 严格与 Agent 解耦，重点在 Java Tool 开发 + 接口文档 | 已提及 | 增加完整 API 接口文档章节；承诺 Agent Core 零改动 |
| 6 | 文件可作为脚本在沙盒中执行 | **缺失** | 新增沙盒执行能力章节（`.py` 脚本） |
| 7 | 文件放入上下文作知识库，与 Skill 强关联（类似 skill.zip） | 部分覆盖 | 新增 Skill-文件关联机制章节 |
| 8 | 分步落地，低成本 MVP，先读后写/先 txt+excel 后 word+ppt | 任务列表有但不够清晰 | 重构为 4 阶段渐进式交付 |

---

## 目录

1. [项目背景与目标](#1-项目背景与目标)
2. [核心设计原则](#2-核心设计原则)
3. [整体架构](#3-整体架构)
4. [模块拆分（3人并行）](#4-模块拆分3人并行)
5. [独立文件管理 API（与大模型无关）](#5-独立文件管理-api与大模型无关)
6. [Agent Tool 接口设计（大模型侧）](#6-agent-tool-接口设计大模型侧)
7. [各文件类型处理方案](#7-各文件类型处理方案)
8. [沙盒执行能力](#8-沙盒执行能力)
9. [Skill-文件关联机制（知识库）](#9-skill-文件关联机制知识库)
10. [安全设计](#10-安全设计)
11. [分阶段落地计划（MVP 优先）](#11-分阶段落地计划mvp-优先)
12. [技术选型](#12-技术选型)
13. [配置与依赖](#13-配置与依赖)
14. [API 接口文档](#14-api-接口文档)
15. [数据库变更](#15-数据库变更)
16. [可扩展接口](#16-可扩展接口)

---

## 1. 项目背景与目标

### 1.1 背景

当前 Agent 平台已支持 SSH 远程执行、API 调用等 Skill 类型。用户需要在 Agent 对话中：

- **上传管理办公文档**：Word、Excel、PPT、Markdown、TXT、CSV、DSPS、Python 脚本
- **Agent 操作文件**：读取、写入、复制、删除、新建文件
- **分片读取大文件**：类似 TRAE 读取项目代码的方式，先了解结构，再按需拉取
- **执行脚本**：在沙盒中运行 `.py` 文件
- **知识库关联**：将文件挂载到 Skill 作为上下文

### 1.2 目标

| 目标 | 说明 |
|------|------|
| **独立文件管理** | 上传/删除/列表等操作完全独立于大模型，走独立 API |
| **Agent 文件操作** | 大模型通过 Tool 接口读写/复制/删除/新建文件 |
| **分片读取** | 为核心能力，先 outline 再 range，避免上下文溢出 |
| **沙盒执行** | 在隔离环境中执行 `.py` 脚本 |
| **Skill 关联** | 文件可挂载到 Skill 作为知识库，类似 skill.zip 模式 |
| **零改动 Agent Core** | 全部在 Gateway 层实现，复用 `POST /api/skills/execute` |
| **MVP 优先** | Phase 1 最小可用 → 逐阶段扩展 |

### 1.3 支持的文件类型

| 类型 | 扩展名 | 读 | 写 | 搜索 | 执行 | 阶段 |
|------|--------|:--:|:--:|:--:|:--:|------|
| 纯文本 | `.txt` | Y | Y | Y | — | Phase 1 |
| CSV | `.csv` | Y | Y | Y | — | Phase 1 |
| Markdown | `.md` | Y | Y | Y | — | Phase 2 |
| Excel | `.xlsx/.xls` | Y | Y | Y | — | Phase 2 |
| DSPS | `.dsps` | Y | Y | Y | — | Phase 2 |
| Word | `.docx` | Y | Y(追加) | Y | — | Phase 3 |
| PPT | `.pptx` | Y | Y(追加) | Y | — | Phase 3 |
| Python | `.py` | Y | Y | — | Y | Phase 3 |

---

## 2. 核心设计原则

### 2.1 分片读取为核心流程

这是整个文件系统 Skill 的**灵魂设计**。所有文件类型的读取都遵循同一模式：

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────┐
│ Agent 确定   │ ──→ │ outline 模式     │ ──→ │ range 模式       │ ──→ │ 完成任务 │
│ 要读哪个文件 │     │ 了解文档结构     │     │ 拉取任务相关内容 │     │          │
└──────────────┘     └──────────────────┘     └──────────────────┘     └──────────┘
     Round 1               Round 2                 Round 3
```

**核心理念**：
- Agent 不需要一次性拉取整个文件
- 先花很小代价（outline）了解文件有什么
- 再精确拉取任务相关的那部分（range）
- 大幅节省 Token，避免上下文溢出

### 2.2 独立与耦合的边界

```
┌─────────────────────────────────────────────────────┐
│                  前端 / 用户                          │
│                                                     │
│  ┌──────────────┐        ┌──────────────────────┐   │
│  │ 文件管理界面 │        │  Agent 对话界面       │   │
│  │ (上传/删除/  │        │  (LLM 调用 Tool)     │   │
│  │  列表管理)   │        │                      │   │
│  └──────┬───────┘        └──────────┬───────────┘   │
└─────────┼──────────────────────────┼────────────────┘
          │                          │
          │ 独立 API                  │ 统一 Skill API
          │ (与大模型无关)            │ POST /api/skills/execute
          ▼                          ▼
┌─────────────────────────────────────────────────────┐
│                 Gateway (Java)                       │
│                                                     │
│  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ FileController   │  │ SkillController        │   │
│  │ /api/files/*     │  │ /api/skills/execute    │   │
│  │                  │  │ kind: "filesystem"     │   │
│  └────────┬─────────┘  └───────────┬────────────┘   │
│           │                        │                │
│  ┌────────▼────────────────────────▼───────────┐    │
│  │         FilesystemExecutionService          │    │
│  │  内部方法被两个 Controller 共享调用          │    │
│  └─────────────────────┬───────────────────────┘    │
│                        │                            │
│  ┌─────────────────────▼───────────────────────┐    │
│  │       Apache Commons VFS 2.9                │    │
│  └─────────────────────┬───────────────────────┘    │
└────────────────────────┼────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  FTP 服务器                          │
│  /user-files/{userId}/                              │
│    ├── documents/       ← Word/PPT                  │
│    ├── spreadsheets/    ← Excel/CSV/DSPS            │
│    ├── notes/           ← Markdown/TXT              │
│    ├── scripts/         ← Python 脚本               │
│    └── .backup/         ← 自动备份                  │
└─────────────────────────────────────────────────────┘
```

### 2.3 Agent Core 零改动承诺

| 组件 | 改动 | 说明 |
|------|:----:|------|
| `java-skills.ts` | **不动** | `loadGatewayExtendedTools` 自动发现 kind="filesystem" 的 Skill |
| `skill-generator.ts` | **仅加一个枚举值** | `targetType` 枚举加 `"filesystem"`，约 1 行 |
| `openclaw-executor.ts` | **不动** | 完全不动 |
| Gateway `SkillExecutionService` | **加一个 case** | `case "filesystem":` 约 3 行 |
| Gateway 新增类 | **全部新增** | `FilesystemExecutionService` 等，不影响存量代码 |

---

## 3. 整体架构

### 3.1 两条独立路径

```
路径 A: 用户文件管理（与大模型完全无关）
─────────────────────────────────────────────
  前端 → POST /api/files/upload
       → GET  /api/files
       → DELETE /api/files/{id}
       → Gateway FileController → FileStorageService → FTP

路径 B: Agent 文件操作（大模型调用 Tool）
─────────────────────────────────────────────
  Agent Core → POST /api/skills/execute { kind: "filesystem" }
             → Gateway SkillController → SkillExecutionService
             → case "filesystem" → FilesystemExecutionService
             → ReadHandler / WriteHandler / SearchHandler / ExecuteHandler
             → FTP
```

### 3.2 调用链

```
Agent Core (TypeScript)
  │
  │  POST /api/skills/execute
  │  { skillId, parameters: { action, filePath, mode, ... } }
  ▼
Gateway SkillController
  │
  ▼
Gateway SkillExecutionService.execute()
  │
  │  switch (kind) {
  │    case "api": ...
  │    case "ssh": ...
  │    case "filesystem":  ← 新增
  │      return filesystemExecutionService.execute(request);
  │  }
  ▼
FilesystemExecutionService
  │
  │  根据 action 分发:
  ├── "read"    → ReadHandler.handle(params)
  ├── "write"   → WriteHandler.handle(params)
  ├── "delete"  → DeleteHandler.handle(params)
  ├── "copy"    → CopyHandler.handle(params)
  ├── "search"  → SearchHandler.handle(params)
  └── "execute" → ExecuteHandler.handle(params)  ← 沙盒执行
```

---

## 4. 模块拆分（3人并行）

### 4.1 模块 A: FTP 存储与传输层 — 开发者 A

**职责**：文件上传/下载、FTP 连接管理、VFS 适配、备份机制、独立文件管理 API

**核心类**：
```
backend/skill-gateway/src/main/java/.../filesystem/
├── storage/
│   ├── VfsProvider.java              # VFS 连接工厂，FTP 连接池
│   ├── FileStorageService.java       # 文件 CRUD（上传/下载/删除/移动/复制）
│   ├── BackupService.java            # 写入前自动备份
│   └── PathValidator.java            # 路径安全校验（防穿越、用户隔离）
├── controller/
│   └── FileController.java           # 独立文件管理 API（/api/files/*）
└── entity/
    └── FileRecord.java               # 文件元数据实体
```

**关键设计**：
- FTP 连接池：`GenericObjectPool<FileObject>`，最大 20 连接，空闲 5 分钟回收
- 用户隔离：所有路径强制前缀 `/user-files/{userId}/`，拒绝 `..` 穿越
- 备份策略：写入前复制到 `.backup/{filename}.{timestamp}`，保留最近 5 个版本

### 4.2 模块 B: 文档解析引擎 — 开发者 B

**职责**：各文件类型的 outline/range 读取、写入、格式转换

**核心类**：
```
backend/skill-gateway/src/main/java/.../filesystem/
├── parser/
│   ├── DocumentParser.java           # 解析器接口
│   ├── ExcelParser.java              # SAX 读 + SXSSF 写
│   ├── WordParser.java               # XWPF 段落/表格提取
│   ├── PptParser.java                # XSLF 幻灯片文本提取
│   ├── MarkdownParser.java           # MD 按标题分段
│   ├── CsvParser.java                # Commons CSV 流式读写
│   ├── TextParser.java               # 纯文本 + FTP REST offset 读取
│   └── ParserRegistry.java           # 按扩展名分发解析器
```

**各文件类型 outline/range 行为**：

| 类型 | outline 返回 | range 参数 | range 返回 |
|------|-------------|-----------|-----------|
| `.txt` | `{ fileSize, firstLines, encoding }` | `{ offset, length }` | 指定字节范围的文本 |
| `.csv` | `{ headers[], rowCount }` | `{ columns[], startRow, endRow }` | 指定行列的 CSV 数据 |
| `.md` | `{ headings[{level,title,lineStart,lineEnd}] }` | `{ headingTitle, startLine, endLine }` | 指定段落的 Markdown |
| `.xlsx` | `{ sheetNames[], perSheet:{columns[],rowCount} }` | `{ sheet, columns[], startRow, endRow }` | 指定列的表格数据 |
| `.dsps` | `{ sheetNames[], perSheet:{columns[],rowCount} }` | `{ sheet, columns[], startRow, endRow }` | 同 Excel |
| `.docx` | `{ paragraphCount, tableCount, totalChars }` | `{ startPara, endPara }` | 指定段落文本 |
| `.pptx` | `{ slideCount, perSlide:{textSummary} }` | `{ startSlide, endSlide }` | 指定幻灯片文本 |
| `.py` | `{ lineCount, imports[], functions[] }` | `{ startLine, endLine }` | 指定行范围的代码 |

### 4.3 模块 C: 搜索与 Agent 接口层 — 开发者 C

**职责**：Agent Tool 接口、倒排索引搜索、Skill-文件关联、沙盒执行调度、Gateway 集成

**核心类**：
```
backend/skill-gateway/src/main/java/.../filesystem/
├── search/
│   ├── SearchProvider.java           # 搜索接口（可扩展）
│   ├── InvertedIndexProvider.java   # 字级倒排索引实现
│   └── SearchResult.java             # 搜索结果 DTO
├── FilesystemExecutionService.java  # Agent Tool 执行服务
├── handlers/
│   ├── ReadHandler.java
│   ├── WriteHandler.java
│   ├── DeleteHandler.java
│   ├── CopyHandler.java
│   └── SearchHandler.java
├── sandbox/
│   └── SandboxExecutionService.java # Python 沙盒执行
└── skill/
    └── SkillFileBindingService.java # Skill-文件关联管理
```

---

## 5. 独立文件管理 API（与大模型无关）

> **对应顶层要求 #1, #2**：上传及文件管理完全独立于大模型。

### 5.1 API 列表

| 方法 | 路径 | 说明 | 大模型相关 |
|------|------|------|:----------:|
| `POST` | `/api/files/upload` | 上传文件 | **否** |
| `GET` | `/api/files` | 文件列表 | **否** |
| `GET` | `/api/files/{id}` | 文件详情 | **否** |
| `DELETE` | `/api/files/{id}` | 删除文件 | **否** |
| `GET` | `/api/files/{id}/download` | 下载文件 | **否** |

### 5.2 上传

```
POST /api/files/upload
Header: X-User-Id: {userId}
Content-Type: multipart/form-data

参数:
  file:      (binary)      文件内容
  directory: (string)      目标子目录，默认 "documents"

响应 200:
{
  "id": 123,
  "originalName": "report.xlsx",
  "ftpPath": "/user-files/42/spreadsheets/report.xlsx",
  "fileSize": 204800,
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "uploadedAt": "2026-06-08T10:30:00Z"
}

约束:
  - 文件大小上限: 50MB
  - 允许的扩展名: .md, .txt, .ppt, .pptx, .xls, .xlsx, .doc, .docx, .dsps, .py, .csv
  - 用户的文件仅自己可见（按 X-User-Id 隔离）
```

### 5.3 文件列表

```
GET /api/files?directory=spreadsheets
Header: X-User-Id: {userId}

响应 200:
{
  "files": [
    {
      "id": 123,
      "originalName": "report.xlsx",
      "ftpPath": "/user-files/42/spreadsheets/report.xlsx",
      "fileSize": 204800,
      "mimeType": "...",
      "uploadedAt": "..."
    }
  ],
  "totalSize": 5120000
}
```

### 5.4 自动归类

上传时根据扩展名自动归入子目录：

| 扩展名 | 目标子目录 |
|--------|-----------|
| `.docx`, `.doc`, `.pptx`, `.ppt` | `documents/` |
| `.xlsx`, `.xls`, `.csv`, `.dsps` | `spreadsheets/` |
| `.md`, `.txt` | `notes/` |
| `.py` | `scripts/` |

---

## 6. Agent Tool 接口设计（大模型侧）

> **对应顶层要求 #3, #4, #5**：大模型操作文件能力 + 分片读取为核心 + 与 Agent 解耦。

### 6.1 Tool Schema 定义

暴露给 LLM 的 `schemaProperties`（JSON，存储在 `skills` 表的 `parameter_contract` 字段）：

```json
{
  "action": {
    "type": "string",
    "enum": ["read", "write", "delete", "copy", "create", "search", "execute"],
    "description": "操作类型"
  },
  "filePath": {
    "type": "string",
    "description": "文件在 FTP 上的相对路径，如 spreadsheets/report.xlsx"
  },
  "mode": {
    "type": "string",
    "enum": ["auto", "outline", "range"],
    "description": "读取模式。auto: 自动判断; outline: 仅返回结构; range: 读取指定范围"
  },
  "range": {
    "type": "object",
    "description": "range 模式的读取范围。结构因文件类型而异（见 6.3 节）"
  },
  "content": {
    "type": "string",
    "description": "write/create 操作时要写入的内容"
  },
  "targetPath": {
    "type": "string",
    "description": "copy 操作的目标路径"
  },
  "query": {
    "type": "string",
    "description": "search 操作的搜索关键词"
  },
  "topK": {
    "type": "integer",
    "default": 5,
    "description": "search 操作的返回数量"
  },
  "scriptArgs": {
    "type": "array",
    "items": { "type": "string" },
    "description": "execute 操作的脚本参数"
  }
}
```

### 6.2 Action 说明

| Action | 说明 | 必填参数 | 示例 |
|--------|------|---------|------|
| `read` | 读取文件 | `filePath` + (`mode` 默认 auto) | 核心分片读取 |
| `write` | 写入已有文件 | `filePath`, `content` | 修改 Excel 列、追加 MD 段落 |
| `delete` | 删除文件 | `filePath` | 删除临时文件 |
| `copy` | 复制文件 | `filePath`, `targetPath` | 复制模板文件 |
| `create` | 新建文件 | `filePath`, `content` | 新建 `config.txt` |
| `search` | 搜索文件内容 | `query` | 模糊查找文档内容 |
| `execute` | 沙盒执行脚本 | `filePath` | 运行 `.py` 脚本 |

### 6.3 分片读取的三步流程（核心）

**这是整个文件系统 Skill 最核心的交互模式。**

#### Step 1 — auto 模式（LLM 第一次调用）

```
LLM 调用:
  action: read
  filePath: "spreadsheets/sales.xlsx"
  mode: auto

Gateway 行为:
  - 文件 < 10KB → 返回完整内容
  - 文件 ≥ 10KB → 降级为 outline 模式

Gateway 返回:
{
  "mode": "outline",
  "fileName": "sales.xlsx",
  "fileSize": 5242880,
  "outline": {
    "type": "excel",
    "sheets": [
      {
        "name": "Sheet1",
        "columns": ["日期", "产品", "金额", "区域", "销售员"],
        "rowCount": 50000
      }
    ]
  },
  "hint": "文件较大(5MB)，请使用 mode=range 指定读取范围"
}
```

#### Step 2 — range 模式（LLM 第二次调用）

```
LLM 调用:
  action: read
  filePath: "spreadsheets/sales.xlsx"
  mode: range
  range: {
    sheet: "Sheet1",
    columns: ["产品", "金额"],
    startRow: 0,
    endRow: 100
  }

Gateway 返回:
{
  "mode": "range",
  "data": [
    { "产品": "Widget A", "金额": 1500 },
    { "产品": "Widget B", "金额": 2300 },
    ...
  ],
  "range": { "startRow": 0, "endRow": 100 },
  "totalRows": 50000,
  "truncated": true
}
```

#### Step 3 — 继续拉取（如需要）

```
LLM 调用:
  action: read
  filePath: "spreadsheets/sales.xlsx"
  mode: range
  range: {
    sheet: "Sheet1",
    columns: ["产品", "金额"],
    startRow: 100,
    endRow: 200
  }
```

### 6.4 range 参数按文件类型的完整定义

```json
// Excel / DSPS
{
  "sheet": "Sheet1",
  "columns": ["列A", "列B"],
  "startRow": 0,
  "endRow": 500
}

// CSV
{
  "columns": ["列A", "列B"],
  "startRow": 0,
  "endRow": 500
}

// Markdown
{
  "headingTitle": "## 需求分析",
  "startLine": 50,
  "endLine": 200
}

// TXT
{
  "offset": 0,
  "length": 4096
}

// Word
{
  "startParagraph": 0,
  "endParagraph": 50
}

// PPT
{
  "startSlide": 0,
  "endSlide": 5
}

// Python
{
  "startLine": 10,
  "endLine": 50
}
```

---

## 7. 各文件类型处理方案

### 7.1 Excel (.xlsx/.xls) / DSPS (.dsps)

**读取（SAX 流式）**：使用 POI `XSSFReader` + SAX ContentHandler，逐行解析不加载全表。按列名过滤，支持行范围截取。

**写入（SXSSF 流式）**：使用 100 行滑动窗口的 `SXSSFWorkbook`，内存恒定 ~5MB。支持新增列、修改单元格。

**场景**：
```
用户: "处理XXX工作，参考 sales.xlsx 中'注意事项'列的内容"
→ outline → 返回列名列表
→ range(columns=["注意事项"]) → 返回该列全部数据
→ LLM 基于内容完成任务

用户: "在 sales.xlsx 中新增一列'折扣价'，值=金额*0.8"
→ outline → 确认列不存在
→ write → SXSSF 流式写入 → 备份原文件
```

### 7.2 CSV (.csv)

**读取**：Commons CSV `CSVParser` 流式逐行解析。outline 返回列头+行数，range 按列名和行范围。

**写入**：Commons CSV `CSVPrinter` 流式写入。支持追加行、新增列。

### 7.3 Markdown (.md)

**读取**：按 `#` 标题分段解析。outline 返回标题树，range 返回指定标题段或行范围。

**写入**：支持追加/替换段落、修改 frontmatter。

**知识库场景**（核心场景）：
```
用户: "根据 knowledge.md 回答什么是 SSO"
→ outline → headings: [概述, SSO认证, 权限管理, ...]
→ range(headingTitle="## SSO认证") → 该段落完整内容
→ LLM 基于该内容生成回答
```

### 7.4 Word (.docx)

**读取**：XWPF 提取段落和表格。outline 返回段落数/表格数/总字符数，range 返回指定段落范围。

**写入**：支持追加段落、追加表格行（不修改现有内容）。（完整格式重写为后续扩展能力）

### 7.5 PPT (.pptx)

**读取**：XSLF 提取幻灯片文本。outline 返回幻灯片数及每页文本摘要，range 返回指定幻灯片内容。

**写入**：支持在末尾追加新幻灯片（文本+基本格式）。（复杂格式重写为后续扩展能力）

### 7.6 TXT (.txt)

**读取**：利用 FTP `REST` 命令实现字节偏移量部分读取。outline 返回文件大小+前 50 行预览，range 精确按 `offset + length` 截取。

### 7.7 Python (.py)

**读取**：作为文本文件读取。outline 返回行数/import 列表/函数定义列表，range 按行范围读取。

**执行**：见第 8 章沙盒执行。

---

## 8. 沙盒执行能力

> **对应顶层要求 #6**：文件可用来当做程序脚本被执行（在沙盒中执行）。

### 8.1 设计原则

- **仅支持 `.py` 文件**
- 在 Docker 容器中执行，每次执行新建容器，执行完销毁
- 网络隔离（无外网访问）
- 时间限制（默认 30 秒超时）
- 内存限制（默认 256MB）
- 文件系统限制（只能读 `/sandbox/workspace/` 下的文件）

### 8.2 执行流程

```
Agent 调用:
  action: execute
  filePath: "scripts/process_data.py"
  scriptArgs: ["--input", "/sandbox/workspace/data.csv", "--output", "/sandbox/workspace/result.csv"]

Gateway 行为:
  1. 从 FTP 下载 .py 文件和相关数据文件到临时目录
  2. 启动 Docker 容器（python:3.12-slim）
  3. 挂载临时目录到 /sandbox/workspace
  4. 执行: python /sandbox/workspace/process_data.py --input ... --output ...
  5. 收集 stdout/stderr、执行时间、退出码
  6. 将输出文件上传回 FTP
  7. 销毁容器，清理临时文件

返回:
{
  "exitCode": 0,
  "stdout": "Processing complete. 1000 rows processed.\n",
  "stderr": "",
  "executionTimeMs": 12500,
  "outputFiles": [
    "spreadsheets/result.csv"
  ]
}
```

### 8.3 Docker 约束配置

```yaml
# docker run 参数
--memory=256m
--memory-swap=256m
--cpus=1
--network=none
--read-only
--tmpfs=/tmp:rw,noexec,nosuid,size=100m
--ulimit=nproc=50
--pids-limit=100
```

### 8.4 安全措施

- 容器以非 root 用户运行（UID 1000）
- 不允许 `subprocess.call(['pip', 'install', ...])`（通过 AST 静态分析检测）
- 不允许 `open('/etc/passwd')` 等路径穿越（动态注入 `builtins.open` hook）
- 执行超时 SIGKILL 强制终止

---

## 9. Skill-文件关联机制（知识库）

> **对应顶层要求 #7**：文件可放入上下文中，作为知识库，并与 Skill 强关联。

### 9.1 设计思路

参照现有的 Skill 目录结构（`SKILLs/{skillId}/SKILL.md`），Skill 可以声明自己需要的文件，这些文件在 Skill 被加载时自动注入到上下文中。

### 9.2 Skill 声明文件关联

在 `SKILL.md` 的 frontmatter 中声明：

```yaml
---
name: sales-analysis
description: 销售数据分析助手
metadata:
  category: business
files:
  - path: spreadsheets/sales_template.xlsx
    role: template
    description: 销售数据模板，用于生成报表
  - path: notes/sales_knowledge.md
    role: knowledge_base
    description: 销售知识库，包含产品信息和定价策略
---
```

### 9.3 文件角色定义

| 角色 | 说明 | 上下文注入方式 |
|------|------|---------------|
| `template` | 模板文件，Agent 可复制后修改 | 注入文件名和结构(outline) |
| `knowledge_base` | 知识库文件，用于检索 | 建立索引，按需 search/range |
| `reference` | 参考文件，Agent 可读取 | 注入文件名和路径 |
| `script` | 可执行脚本 | 注入函数签名和用法说明 |

### 9.4 Skill 加载时的文件注入

```
Agent Core 加载 Skill "sales-analysis"
  → 解析 SKILL.md frontmatter 中的 files 字段
  → 调用 Gateway: GET /api/files/skill-bindings?skillId=sales-analysis
  → Gateway 返回关联文件列表:
      [
        { "path": "spreadsheets/sales_template.xlsx", "role": "template", "outline": {...} },
        { "path": "notes/sales_knowledge.md", "role": "knowledge_base", "outline": {...} }
      ]
  → Agent Core 将文件信息注入到 Skill prompt:
      "此 Skill 关联以下文件:
       - sales_template.xlsx (模板): [列: 日期,产品,金额,区域]
       - sales_knowledge.md (知识库): [章节: 产品介绍,定价策略,客户分类]"
```

### 9.5 Skill-文件绑定 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/files/bind` | 将文件绑定到 Skill |
| `DELETE` | `/api/files/bind/{id}` | 解绑 |
| `GET` | `/api/files/skill-bindings` | 查询 Skill 的关联文件 |

### 9.6 知识库使用流程

```
用户: "根据产品定价策略分析本月的销售数据"
  → Agent 知道 Skill 关联了 sales_knowledge.md
  → Agent 调用: action=search, query="定价策略"
  → Gateway 倒排索引搜索 → 返回相关内容片段
  → Agent 调用: action=read, mode=range(headingTitle="## 定价策略")
  → Gateway 返回该章节完整内容
  → LLM 基于知识库内容 + 销售数据 → 生成分析
```

---

## 10. 安全设计

### 10.1 用户隔离

```java
public class PathValidator {
    public void validate(String userId, String relativePath) {
        // 强制前缀
        String prefix = "/user-files/" + userId + "/";
        String fullPath = prefix + relativePath;
        
        // 防路径穿越
        if (fullPath.contains("..")) {
            throw new SecurityException("Path traversal detected");
        }
        
        // 规范化后检查是否仍在用户目录内
        String normalized = Paths.get(fullPath).normalize().toString();
        if (!normalized.startsWith(prefix)) {
            throw new SecurityException("Access outside user directory");
        }
    }
}
```

### 10.2 写入安全

- **自动备份**：写入前复制到 `.backup/{filename}.{timestamp}`，保留最近 5 个版本
- **确认机制**：覆盖/删除已有文件时 Gateway 返回 `CONFIRMATION_REQUIRED`
- **文件类型白名单**：仅允许指定的扩展名
- **文件大小上限**：上传 50MB，单次读取 1MB

### 10.3 危险操作确认

复用 Gateway 已有的 `PendingConfirmationStore` 机制（与 SSH 一致）：

```
高危操作 → Gateway 返回 { status: "CONFIRMATION_REQUIRED", ... }
         → Agent 提示用户确认
         → 用户确认后重新调用
```

---

## 11. 分阶段落地计划（MVP 优先）

> **对应顶层要求 #8**：分步落地，低成本完成最小可用原型，确保方案可行及架构健壮没有冗余。

### 整体原则

- **先读后写**：先实现完整的读取链路，再扩展到写入
- **先简单后复杂**：txt/csv → excel/dsps/md → word/ppt
- **每阶段可独立交付验证**

### Phase 1: MVP — 读取纯文本 + CSV（预计 1 周）

**目标**：跑通全链路，验证架构

| ID | 任务 | 负责人 | 估时 |
|----|------|--------|------|
| P1-A1 | Commons VFS 集成 + FTP 连接池 | A | 1d |
| P1-A2 | FileStorageService（上传/下载/删除） | A | 1d |
| P1-A3 | PathValidator + 用户隔离 | A | 0.5d |
| P1-A4 | FileController（独立文件管理 API） | A | 1d |
| P1-B1 | DocumentParser 接口 + ParserRegistry | B | 0.5d |
| P1-B2 | TextParser（outline + range + FTP REST offset） | B | 1d |
| P1-B3 | CsvParser（outline + range） | B | 1d |
| P1-C1 | FilesystemExecutionService + action 路由 | C | 1d |
| P1-C2 | ReadHandler（read action + auto/outline/range 模式） | C | 1d |
| P1-C3 | Tool Schema 定义（schemaProperties JSON） | C | 0.5d |
| P1-C4 | Gateway 集成（SkillExecutionService 加 case "filesystem"） | C | 0.5d |
| P1-INT | 端到端联调（上传 → Agent read → FTP 验证） | A+B+C | 1d |

**Phase 1 交付物**：
- 用户可以上传/删除/列表管理 txt 和 csv 文件
- Agent 可以 read txt/csv（outline + range 分片读取）
- 独立 APIs（`/api/files/*`）可用
- Agent Core 零改动（除 `skill-generator.ts` 加一个枚举值）

### Phase 2: Excel/DSPS 读取 + 写入能力 + 复制/新建/删除（预计 1.5 周）

| ID | 任务 | 负责人 | 估时 |
|----|------|--------|------|
| P2-A1 | BackupService（自动备份机制） | A | 1d |
| P2-B1 | ExcelParser（SAX 读 + SXSSF 写） | B | 3d |
| P2-B2 | DspsParser（同 Excel） | B | 0.5d |
| P2-B3 | MarkdownParser（按标题分段） | B | 1d |
| P2-C1 | WriteHandler（write action） | C | 1d |
| P2-C2 | DeleteHandler + CopyHandler | C | 1d |
| P2-C3 | Tool Schema 扩展（新增 action 枚举值） | C | 0.5d |
| P2-INT | 联调 + 写入回归测试 | A+B+C | 1d |

**Phase 2 交付物**：
- Excel/DSPS/Markdown 全部可读（outline + range）
- 所有类型支持 write（txt/csv/excel/dsps/md）
- 支持 delete/copy/create 操作
- SXSSF 流式写入 Excel（大文件不 OOM）

### Phase 3: Word/PPT 读取 + Python 沙盒（预计 1 周）

| ID | 任务 | 负责人 | 估时 |
|----|------|--------|------|
| P3-B1 | WordParser（XWPF 段落/表格提取 + 追加写入） | B | 2d |
| P3-B2 | PptParser（XSLF 幻灯片文本提取 + 追加幻灯片） | B | 2d |
| P3-C1 | SandboxExecutionService（Docker Python 沙盒） | C | 2d |
| P3-C2 | ExecuteHandler（execute action） | C | 1d |
| P3-C3 | AST 静态分析（脚本安全检查） | C | 1d |
| P3-INT | 联调 + 安全测试 | A+B+C | 1d |

### Phase 4: 搜索 + Skill 关联 + 完善（预计 1 周）

| ID | 任务 | 负责人 | 估时 |
|----|------|--------|------|
| P4-C1 | InvertedIndexProvider（字级倒排索引） | C | 2d |
| P4-C2 | SearchHandler（search action） | C | 1d |
| P4-C3 | SkillFileBindingService（Skill-文件关联 CRUD） | C | 1d |
| P4-C4 | Skill 加载时文件注入（Agent Core 侧，改 prompt 拼接） | C | 1d |
| P4-B1 | Word/PPT 写入补充（追加段落/幻灯片） | B | 1d |
| P4-INT | 全链路联调 + 回归测试 | A+B+C | 2d |

---

## 12. 技术选型

| 组件 | 选型 | 版本 | 用途 |
|------|------|------|------|
| 文件系统抽象 | Apache Commons VFS | 2.9 | 统一 FTP/Local/S3 访问 |
| Excel 读取 | Apache POI (XSSFReader) | 5.5 | SAX 流式读取大 Excel |
| Excel 写入 | Apache POI (SXSSF) | 5.5 | 流式写入，100 行滑动窗口 |
| Word 读取 | Apache POI (XWPF) | 5.5 | .docx 段落/表格提取 |
| PPT 读取 | Apache POI (XSLF) | 5.5 | .pptx 幻灯片文本提取 |
| CSV 解析 | Apache Commons CSV | 1.12 | 流式 CSV 读写 |
| 连接池 | Apache Commons Pool2 | 2.12 | FTP 连接池 |
| Python 沙盒 | Docker (python:3.12-slim) | — | 隔离执行 |
| 倒排索引 | 自研（内存） | — | 字级倒排索引，零依赖 |
| MIME 检测 | Apache Tika | 3.1 | 文件类型识别（可选） |

### 为何不选其他方案

| 方案 | 放弃原因 |
|------|----------|
| MinIO/S3 SDK | 需要额外基础设施，FTP 已就绪 |
| EasyExcel (阿里) | 功能重叠，POI 更标准 |
| Elasticsearch | 过重，倒排索引已满足需求，Phase 4 作为可选扩展 |
| 直接 `java.io.File` | 无法支持 FTP，扩展性差 |
| PyPy/sandbox 库 | Docker 更标准化，隔离性更强 |

---

## 13. 配置与依赖

### 13.1 Maven 依赖（pom.xml 新增）

```xml
<!-- Apache Commons VFS -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-vfs2</artifactId>
    <version>2.9.0</version>
</dependency>

<!-- FTP 支持 -->
<dependency>
    <groupId>commons-net</groupId>
    <artifactId>commons-net</artifactId>
    <version>3.10.0</version>
</dependency>

<!-- Apache POI (Excel/Word/PPT) -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.5.0</version>
</dependency>

<!-- Apache Commons CSV -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-csv</artifactId>
    <version>1.12.0</version>
</dependency>

<!-- Apache Commons Pool2 -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
    <version>2.12.0</version>
</dependency>

<!-- Docker Java Client (沙盒执行) -->
<dependency>
    <groupId>com.github.docker-java</groupId>
    <artifactId>docker-java-core</artifactId>
    <version>3.4.2</version>
</dependency>
<dependency>
    <groupId>com.github.docker-java</groupId>
    <artifactId>docker-java-transport-httpclient5</artifactId>
    <version>3.4.2</version>
</dependency>
```

### 13.2 application.properties 新增

```properties
# FTP 配置
filesystem.ftp.host=${FTP_HOST:localhost}
filesystem.ftp.port=${FTP_PORT:21}
filesystem.ftp.username=${FTP_USER:agent}
filesystem.ftp.password=${FTP_PASSWORD:}
filesystem.ftp.pool.max-total=20
filesystem.ftp.pool.max-idle=5
filesystem.ftp.pool.min-idle=2
filesystem.ftp.pool.max-wait-ms=5000

# 文件操作配置
filesystem.backup.max-versions=5
filesystem.auto-mode.size-threshold=10240
filesystem.auto-mode.preview-rows=100
filesystem.upload.max-size=52428800
filesystem.read.max-size=1048576

# 沙盒配置
filesystem.sandbox.docker-image=python:3.12-slim
filesystem.sandbox.timeout-seconds=30
filesystem.sandbox.memory-mb=256

# 搜索配置
filesystem.search.index-ttl-minutes=30
```

---

## 14. API 接口文档

> **对应顶层要求 #5**：严格与 Agent 解耦，重点在完成 Tool（Java）开发和对应的接口文档设计。

### 14.1 独立文件管理 API（/api/files）

| 方法 | 路径 | Headers | 请求体 | 响应 |
|------|------|---------|--------|------|
| `POST` | `/api/files/upload` | `X-User-Id` | `multipart/form-data { file, directory? }` | `FileRecord` |
| `GET` | `/api/files` | `X-User-Id` | `?directory=xxx` | `{ files: FileRecord[], totalSize }` |
| `GET` | `/api/files/{id}` | `X-User-Id` | — | `FileRecord` |
| `DELETE` | `/api/files/{id}` | `X-User-Id` | — | `{ success: true }` |
| `GET` | `/api/files/{id}/download` | `X-User-Id` | — | binary stream |

### 14.2 Skill-文件绑定 API（/api/files）

| 方法 | 路径 | Headers | 请求体 | 响应 |
|------|------|---------|--------|------|
| `POST` | `/api/files/bind` | `X-User-Id` | `{ skillId, fileId, role }` | `SkillFileBinding` |
| `DELETE` | `/api/files/bind/{id}` | `X-User-Id` | — | `{ success: true }` |
| `GET` | `/api/files/skill-bindings` | `X-User-Id` | `?skillId=xxx` | `[SkillFileBinding]` |

### 14.3 Agent Tool 执行 API（POST /api/skills/execute）

```
POST /api/skills/execute
Content-Type: application/json
Header: X-User-Id: {userId}

{
  "skillId": 100,
  "parameters": {
    "action": "read",
    "filePath": "spreadsheets/sales.xlsx",
    "mode": "range",
    "range": {
      "sheet": "Sheet1",
      "columns": ["产品", "金额"],
      "startRow": 0,
      "endRow": 100
    }
  }
}
```

### 14.4 响应格式

所有 Agent Tool 响应统一为：

```json
{
  "success": true,
  "action": "read",
  "data": { ... },
  "error": null,
  "meta": {
    "filePath": "...",
    "fileSize": 204800,
    "truncated": false,
    "durationMs": 123
  }
}
```

错误响应：

```json
{
  "success": false,
  "action": "read",
  "data": null,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "文件不存在: spreadsheets/nonexistent.xlsx"
  }
}
```

### 14.5 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `FILE_NOT_FOUND` | 404 | 文件不存在 |
| `ACCESS_DENIED` | 403 | 无权访问该文件 |
| `INVALID_PATH` | 400 | 路径非法（如包含 ..） |
| `UNSUPPORTED_TYPE` | 400 | 不支持的文件类型 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |
| `SANDBOX_TIMEOUT` | 500 | 沙盒执行超时 |
| `SANDBOX_ERROR` | 500 | 沙盒执行异常 |
| `BACKUP_FAILED` | 500 | 备份失败 |
| `WRITE_FAILED` | 500 | 写入失败 |

---

## 15. 数据库变更

### 15.1 DDL

```sql
-- 文件上传记录表
CREATE TABLE IF NOT EXISTS file_uploads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL COMMENT '用户ID',
    original_name VARCHAR(512) NOT NULL COMMENT '原始文件名',
    ftp_path VARCHAR(1024) NOT NULL COMMENT 'FTP存储路径',
    file_size BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
    mime_type VARCHAR(255) COMMENT 'MIME类型',
    indexed_at DATETIME COMMENT '最后索引时间',
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
    UNIQUE INDEX idx_user_ftp_path (user_id, ftp_path)
) COMMENT='用户文件上传记录';

-- Skill-文件绑定表
CREATE TABLE IF NOT EXISTS skill_file_bindings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_id BIGINT NOT NULL COMMENT 'Skill ID',
    file_id BIGINT NOT NULL COMMENT '文件ID',
    role VARCHAR(32) NOT NULL DEFAULT 'reference' COMMENT '文件角色: template/knowledge_base/reference/script',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_skill_id (skill_id),
    INDEX idx_file_id (file_id),
    UNIQUE INDEX idx_skill_file (skill_id, file_id)
) COMMENT='Skill与文件的绑定关系';
```

### 15.2 如 `file_uploads` 表已存在

```sql
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS ftp_path VARCHAR(1024);
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255);
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS indexed_at DATETIME;
ALTER TABLE file_uploads ADD INDEX IF NOT EXISTS idx_user_ftp_path (user_id, ftp_path);
```

---

## 16. 可扩展接口

### 16.1 SearchProvider

```java
public interface SearchProvider {
    String getName();
    
    /** 搜索文件内容 */
    List<SearchResult> search(String userId, String query, int topK);
    
    /** 索引文件内容 */
    void index(String userId, String filePath, String content);
    
    /** 移除索引 */
    void remove(String userId, String filePath);
    
    /** 是否可用 */
    default boolean isAvailable() { return true; }
}
```

默认实现：`InvertedIndexProvider`（字级倒排索引，内存）。可扩展为 Elasticsearch Provider、向量检索 Provider。

### 16.2 DocumentParser

```java
public interface DocumentParser {
    /** 是否支持该文件类型 */
    boolean supports(String extension, String mimeType);
    
    /** 获取文档结构（outline 模式） */
    DocumentOutline getOutline(String filePath, FileObject fileObject);
    
    /** 分片读取（range 模式） */
    DocumentContent readRange(String filePath, FileObject fileObject, 
                              Map<String, Object> rangeParams);
    
    /** 写入文件 */
    WriteResult write(String filePath, FileObject fileObject, 
                      String content, WriteMode mode);
}
```

### 16.3 扩展点总结

| 扩展点 | 接口 | 默认实现 | 可替换为 |
|--------|------|----------|----------|
| 搜索引擎 | `SearchProvider` | `InvertedIndexProvider` | Elasticsearch, Milvus |
| 文件解析 | `DocumentParser` | 按类型 8 个实现 | Tika 全量解析 |
| 存储后端 | VFS `FileSystemManager` | FTP | S3, HDFS, 本地 |
| 沙盒引擎 | Docker | `python:3.12-slim` | 多语言容器、gVisor |
| 备份策略 | `BackupService` | 本地 `.backup` | 远程备份, Git |

---

## 附录 A: Agent Core 改动清单（最小化）

### 唯一必改项：`skill-generator.ts` 加一个枚举值

```typescript
// 位置: backend/agent-core/src/tools/skill-generator.ts
// 约第 200 行附近

const targetType = z.enum([
  "api",
  "ssh", 
  "template",
  "filesystem"  // ← 新增这一行
]);
```

### 确认不改的文件

| 文件 | 原因 |
|------|------|
| `java-skills.ts` | `loadGatewayExtendedTools` 自动从 Gateway 拉取所有 Skill，包括 kind="filesystem" |
| `openclaw-executor.ts` | 统一执行入口，不感知 skill 类型 |
| `agent.ts` | 不涉及 |
| 其它所有 Agent Core 文件 | 不涉及 |

---

## 附录 B: 关键流程伪代码

### 分片读取（ReadHandler）

```java
public ReadResult read(ReadRequest req) {
    // 1. 安全校验
    pathValidator.validate(req.userId, req.filePath);
    
    // 2. 获取文件
    FileObject file = vfsProvider.resolve(req.userId, req.filePath);
    if (!file.exists()) throw new FileNotFoundException(req.filePath);
    
    // 3. 选择解析器
    DocumentParser parser = parserRegistry.getParser(req.filePath);
    
    // 4. 模式分发
    switch (req.mode) {
        case "outline":
            return ReadResult.outline(parser.getOutline(req.filePath, file));
        
        case "range":
            return ReadResult.range(
                parser.readRange(req.filePath, file, req.range)
            );
        
        case "auto":
        default:
            if (file.getSize() < autoThreshold) {
                return ReadResult.full(parser.readRange(req.filePath, file, fullRange));
            }
            return ReadResult.outline(
                parser.getOutline(req.filePath, file),
                "文件较大, 请使用 mode=range 指定读取范围"
            );
    }
}
```

### 倒排索引搜索（InvertedIndexProvider）

```java
public List<SearchResult> search(String userId, String query, int topK) {
    char[] chars = query.toCharArray();
    Set<Character> stopWords = Set.of('的', '了', '在', '是', '我', '有', '和', '就', '不', '人');
    
    Map<String, Integer> docScores = new HashMap<>();
    
    for (char c : chars) {
        if (stopWords.contains(c)) continue;
        Map<String, List<Integer>> docPositions = index.get(c);
        if (docPositions != null) {
            for (String doc : docPositions.keySet()) {
                docScores.merge(doc, 1, Integer::sum);
            }
        }
    }
    
    return docScores.entrySet().stream()
        .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
        .limit(topK)
        .map(e -> buildResult(e.getKey(), e.getValue()))
        .toList();
}
```

---

> **文档结束** — 此方案覆盖全部 8 项顶层要求，按 Phase 1→4 渐进式交付，Phase 1 MVP 即可验证全链路架构。
