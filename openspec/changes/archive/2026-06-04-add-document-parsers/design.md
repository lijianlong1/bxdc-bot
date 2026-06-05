# Design: 文档内容解析器（任务 4）

## Context

文件上传功能共 12 个任务。任务 1 已交付类型与常量契约（`frontend/src/types/fileUpload.ts`）。本 change 仅落地**任务 4**——实现前端侧 Office 文档 / 纯文本文件的文字提取。

解析发生在用户上传文件后、点击发送消息前，属于会话发起的关键路径。解析失败或耗时过长会直接影响用户等待体验。

前端项目规则要求「依赖库尽量使用已有的」，即优先复用 `frontend/package.json` 中已有依赖，避免引入冗余第三方库。

## Goals / Non-Goals

**Goals:**
- 实现 .docx（mammoth）、.xlsx（SheetJS）、.txt/.md（FileReader）的前端纯文本提取
- 提供统一入口 `parseDocument()`，调用方只需传 `File` + `FileType`，不感知底层解析差异
- 对不支持前端解析的格式（.ppt/.pptx/.doc/.xls），优雅回退 agent-core `/features/file/parse-document` 端点

**Non-Goals:**
- 不解析旧格式（.doc/.xls/.ppt）——前端 JS 库对二进制旧格式支持极有限，交由 agent-core
- 不解析 .pptx——需 JSZip + XML 解析链（至少 2 个新依赖），违反尽量使用已有依赖原则；回退 agent-core
- 不包含 OCR（图片文字识别）——见任务 5
- 不包含校验逻辑——见任务 2

## Decisions

### 决策 1：.docx 解析库选择：mammoth

- **选择**: `mammoth`（npm 包名 `mammoth`，~150KB gzip）
- **替代方案**:
  - `docx-preview`：面向渲染（转 HTML），不提取纯文本
  - `officegen`：生成 docx，非解析
  - 手写 OOXML 解析：复杂度高，不可行
- **理由**: mammoth 是 docx→text 的事实标准，接口简单（`extractRawText({ arrayBuffer })`），无额外依赖链，体积可接受

### 决策 2：.xlsx 解析库选择：SheetJS

- **选择**: `xlsx`（npm 包名 `xlsx`，社区版 SheetJS，~300KB gzip）
- **替代方案**:
  - `exceljs`：功能全但体积更大（~500KB+），且侧重读写双向操作
  - 手写 ZIP + XML 解析：同 docx，复杂度不可行
- **理由**: SheetJS 是 Excel 解析的事实标准，`XLSX.read()` + `XLSX.utils.sheet_to_csv()` 链简洁，社区成熟度高

### 决策 3：.txt/.md 解析：零依赖 FileReader

- **选择**: 浏览器原生 `FileReader.readAsText()`
- **理由**: .txt 和 .md 本质是纯文本，无需任何解析库
- **分段读取**: 对 > 100KB 的文件使用 `File.slice()` 分片读取，避免 UI 线程长时间阻塞。每段读取后 `await` 释放事件循环

### 决策 4：.pptx 不前端解析，回退 agent-core

- **选择**: 前端不解析 .pptx
- **理由**:
  1. .pptx 本质是 ZIP 压缩包，需先解压再解析 `ppt/slides/slide*.xml` 中的 `<a:t>` 文本标签
  2. 解压需 JSZip（新依赖），XML 解析需 DOMParser 或 xml2js（新依赖）。引入至少 2 个新依赖
  3. 项目规则「依赖库尽量使用已有的」——当前 package.json 无任何 ZIP/XML 库
  4. agent-core 已在任务 9 规划了 `/features/file/parse-document` 端点，.pptx 作为其输入类型之一合理
- **回退行为**: `parseDocument()` 检测到 ppt 类型时，直接 POST 文件到 agent-core

### 决策 5：统一入口 fileParser.ts 的路由逻辑

```
parseDocument(file, fileType, signal?)
│
├── fileType === 'word' && ext === '.docx'  →  docxParser.parseDocx(file)
├── fileType === 'word' && ext === '.doc'   →  agentFallback(file)     // 旧格式
├── fileType === 'excel' && ext === '.xlsx' →  xlsxParser.parseXlsx(file)
├── fileType === 'excel' && ext === '.xls'  →  agentFallback(file)     // 旧格式
├── fileType === 'ppt'                       →  agentFallback(file)     // 整体回退
├── fileType === 'txt'                       →  txtParser.parseTxt(file, signal?)
└── else                                     →  agentFallback(file)
```

- **AbortSignal**: `parseDocument` 接受可选的 `AbortSignal`，用户取消上传时可中断 FileReader
- **agentFallback**: 用 `FormData` 包装文件，POST 到 `/features/file/parse-document`（任务 9 端点），超时 30s

### 决策 6：按需动态 import 解析库

- **选择**: 各 parser 文件顶层 `import mammoth from 'mammoth'` 和 `import * as XLSX from 'xlsx'`，让 Vite 自动 code-split
- **支持**: `fileParser.ts` 中使用动态 `import()` 延迟加载各 parser，确保首屏不加载 mammoth/xlsx CHUNK
- **理由**: mammoth + xlsx 合计 ~450KB gzip，不应为首屏加载项。仅在上传文件时才触发 chunk 下载

## Risks / Trade-offs

- [mammoth + xlsx 首次加载延迟] → 第一次上传 docx/xlsx 时需下载 ~450KB 解析 chunk，在网络慢的环境下可能 1-2 秒。接受——下一次上传命中浏览器缓存，且比回退 agent-core（网络往返 + 大文件上传 + 服务端解析）更快
- [SheetJS 社区版限制] → 社区版不支持 .xlsb 和部分高级特性，但需求仅要求 .xlsx 基础文字提取，不受限
- [大文件 FileReader 阻塞] → TXT 分片读取策略（100KB/片 + await）已在决策 3 覆盖
- [mammoth 对复杂排版的支持] → mammoth 提取纯文本时会丢失表格/列表结构，但文字内容完整。对后续 LLM 理解足够
- [agent-core 兜底端点未实现] → 本任务实现 `agentFallback()` 调用链路，但端点本身由任务 9 交付。在任务 9 完成前，回退路径会返回 404/502，前端需展示友好错误提示

## Migration Plan

- 纯新增 4 个工具文件 + 2 个 npm 依赖，无迁移成本
- 任务 3（useFileUpload composable）将在后续 change 中 import `parseDocument()`

## Open Questions

- agent-core `/features/file/parse-document` 端点的请求/响应契约尚未确定（任务 9）；本任务暂时假定 `FormData(file)` → `{ text: string }` 的简单契约
