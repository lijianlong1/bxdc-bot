# 文件上传功能 - 任务拆解文档

## 概述

在聊天框增加文件上传按钮，支持文档（Word/Excel/PPT/TXT/MD）和图片（PNG/JPEG/WebP）上传。上传文件解析文字内容拼接到大模型 message，文件名称传给 `/memory/add`。文件合规审计和解密功能在 Java skill-gateway 中暴露接口（后续扩展），OCR 识别和文件内容读取在 agent-core 中实现，后续可扩展至 Java 端。

### 当前架构分析

```
┌─────────────────┐     SSE(/agent/run)     ┌──────────────────┐     HTTP     ┌───────────────────┐
│   Frontend       │ ◄────────────────────── │   agent-core     │ ◄────────── │  skill-gateway    │
│  (Vue 3 + TDesign)│                         │  (NestJS/TS)    │             │  (Spring Boot)    │
│                  │ ──────────────────────► │                  │             │                   │
│  MessageInput.vue│  POST /agent/run        │  agent.controller│             │  SecurityFilter   │
│  useChat.ts      │                         │  memory.service  │             │  Audit Service    │
│  MessageList.vue │  POST /memory/add       │                  │             │                   │
└─────────────────┘                         └──────────────────┘             └───────────────────┘
```

- 用户消息 → `MessageInput.vue` → `useChat.sendMessage()` → `POST /agent/run` → SSE 流式返回
- 对话完成后 → `/memory/add` 存储记忆
- 文件合规/解密 → Java skill-gateway（仅暴露接口）
- 文件内容解析 → 前端优先（新格式 .docx/.xlsx/.pptx），旧格式回退 agent-core
- 图片 OCR 识别 → agent-core 处理，后续可扩展至 Java 端

### 核心约束

| 文件类型 | 格式 | 数量上限 | 单文件上限 | 总大小上限 | 备注 |
|---------|------|---------|-----------|-----------|------|
| Word | .doc/.docx | 3 | 5MB | 15MB | 文字提取 |
| Excel | .xls/.xlsx | 2 | 1MB | 2MB | 文字提取 |
| PPT | .ppt/.pptx | 3 | 10MB | 30MB | 仅识别文字 |
| TXT/MD | .txt/.md | 不限 | 0.3MB | - | 纯文本 |
| 图片 | .png/.jpeg/.webp | 10 | - | - | 仅文字识别 |

---

## 任务拆解

### 任务 1：类型定义与常量配置

**目标**：定义文件上传相关的 TypeScript 类型、常量、校验规则，为后续所有任务提供类型基础。

**涉及文件**：
- 新建 `frontend/src/types/fileUpload.ts`

**具体工作**：
- [ ] 1.1 定义 `FileType` 联合类型：`'word' | 'excel' | 'ppt' | 'txt' | 'image'`
- [ ] 1.2 定义 `UploadFileInfo` 接口：id、file、fileName、fileType、size、status、parsedText 等字段
- [ ] 1.3 定义 `FileUploadConfig` 和各类型限额常量（MAX_COUNT、MAX_SIZE_PER_FILE、MAX_TOTAL_SIZE、ACCEPTED_EXTENSIONS）
- [ ] 1.4 定义 `FileValidationResult` 接口：valid、errors[]、warnings[]
- [ ] 1.5 定义 `FileComplianceResult` 接口：passed、message、sensitiveWords[]
- [ ] 1.6 定义 `FileDecryptResult` 接口：success、content、errorMessage
- [ ] 1.7 定义 OCR 相关类型：`OcrResponse`（text、confidence）、`ImageParsedStatus` 状态枚举

**影响分析**：
- 最小化修改，纯新增文件，不修改已有代码
- 为后续所有任务提供类型基础

---

### 任务 2：文件校验工具

**目标**：实现前端文件格式、大小、数量校验逻辑。

**涉及文件**：
- 新建 `frontend/src/utils/fileValidator.ts`

**具体工作**：
- [ ] 2.1 实现 `getFileTypeFromName(fileName: string)` 函数，根据扩展名映射到 `FileType`
- [ ] 2.2 实现 `validateFileExtension(file: File)` 校验格式是否在允许列表中
- [ ] 2.3 实现 `validateFileSize(file: File, fileType: FileType)` 校验单文件大小
- [ ] 2.4 实现 `validateTotalSize(files: File[], fileType: FileType)` 校验同类型总大小
- [ ] 2.5 实现 `validateFileCount(files: File[], fileType: FileType)` 校验同类型数量
- [ ] 2.6 实现组合校验函数 `validateFile(file: File, existingFiles: UploadFileInfo[]): FileValidationResult`
- [ ] 2.7 判断是否加密文件的辅助函数 `isEncryptedFile(file: File)`（通过魔数检测）

**影响分析**：
- 纯新增工具文件，不修改已有代码
- 可独立进行单元测试

---

### 任务 3：useFileUpload Composable

**目标**：创建文件上传的状态管理 composable，管理上传文件列表、校验、解析生命周期。

**涉及文件**：
- 新建 `frontend/src/composables/useFileUpload.ts`

**具体工作**：
- [ ] 3.1 声明响应式状态：`uploadedFiles`（按 `FileType` 分组）、`isUploading`、`uploadError`
- [ ] 3.2 实现 `addFiles(files: File[])` 方法：遍历文件 → 校验 → 确认格式 → 加入列表
- [ ] 3.3 实现 `removeFile(fileId: string)` 方法：从列表中移除单个文件
- [ ] 3.4 实现 `clearFiles()` 方法：清空所有已上传文件
- [ ] 3.5 实现 `getAllParsedText()` 方法：汇总所有已解析文件的文字内容
- [ ] 3.6 实现 `getFileNamesForMemory()` 方法：获取所有文件名清单（用于 /memory/add）
- [ ] 3.7 实现 `parseFileContent(file: UploadFileInfo)` 方法：根据类型调用对应的解析器
- [ ] 3.8 提供 `provide/inject` 模式（与 useChat 一致）

**影响分析**：
- 纯新增 composable，不修改已有代码
- 用 provide/inject 注入到 ChatView 层级

---

### 任务 4：文档内容解析器（前端版）

**目标**：在前端实现 Office 文档的文字内容提取，优先处理新格式（.docx/.xlsx/.pptx），旧格式回退 agent-core。

**涉及文件**：
- 新建 `frontend/src/utils/docxParser.ts`
- 新建 `frontend/src/utils/xlsxParser.ts`
- 新建 `frontend/src/utils/pptxParser.ts`
- 新建 `frontend/src/utils/fileParser.ts`（统一入口）

**具体工作**：
- [ ] 4.1 安装依赖：`mammoth`（docx 解析）、`xlsx`（SheetJS，xlsx 解析）
- [ ] 4.2 实现 `parseDocx(file: File): Promise<string>` 使用 mammoth 提取纯文本
- [ ] 4.3 实现 `parseXlsx(file: File): Promise<string>` 使用 xlsx 库读取所有 sheet 的文本内容
- [ ] 4.4 实现 `parsePptx(file: File): Promise<string>` 解析 pptx zip 内 slides 的文本
  - pptx 本质是 zip，可解压读取 `ppt/slides/slide*.xml` 中的 `<a:t>` 标签
  - 方案：使用 `JSZip` + XML 解析，或引入轻量 pptx 解析库
- [ ] 4.5 实现 `parseTxt(file: File): Promise<string>` 使用 FileReader 直接读取
- [ ] 4.6 实现统一入口 `parseDocument(file: File, fileType: FileType): Promise<string>`
  - 新格式（.docx/.xlsx/.pptx）走前端解析
  - 旧格式（.doc/.xls/.ppt）回退调用 agent-core 接口
- [ ] 4.7 处理大文件分片读取（如 TXT > 100KB 分段）

**影响分析**：
- 纯新增工具文件
- 新增依赖：`mammoth`（~150KB gzip）、`xlsx`（~300KB gzip）
- 旧格式回退不影响已有功能

---

### 任务 5：图片 OCR 解析器（前端 → skill-gateway）

**目标**：前端将图片上传到 skill-gateway 的 OCR 端点（**不再经 agent-core**），拿到识别文字。OCR 引擎在 skill-gateway 端用 Java 调用公司内部的 `DdsUtil.getOcrText(InputStream)` 实现。

**涉及文件**：
- 修改 `frontend/src/utils/imageOcr.ts`（路径不变，目标后端换掉）

**具体工作**：
- [ ] 5.1 `ocrImageRemote(file: File): Promise<string>` 改为 `POST` 到 skill-gateway `/api/file/ocr-image`（前端 baseURL 配置指向 `http://localhost:18080` 即可）
- [ ] 5.2 Request body：`multipart/form-data`，字段名 `file`
- [ ] 5.3 Response 格式约定：`{ text: string, confidence?: number }`，与原 agent-core 端点保持一致
- [ ] 5.4 保留 loading 状态、超时（10s）、错误反馈
- [ ] 5.5 缩略图 `URL.createObjectURL` 不变
- [ ] 5.6 注释明确：OCR 在 skill-gateway Java 端通过 `DdsUtil` 实现，前端只负责转发

**影响分析**：
- 前端只改 1 个 endpoint URL
- 网络路径：frontend → skill-gateway:18080 直连（不再绕 agent-core:3000）
- 前端不引入任何 OCR 库依赖

---

### 任务 6：MessageInput.vue 文件上传按钮

**目标**：在聊天输入框区域增加文件上传触发按钮和已选文件列表展示。

**涉及文件**：
- 修改 `frontend/src/components/MessageInput.vue`

**具体工作**：
- [ ] 6.1 在输入框左侧添加文件上传图标按钮（使用 TDesign Upload 或自定义 `<input type="file">`）
- [ ] 6.2 配置 `accept` 属性限制可选文件类型
  ```typescript
  const ACCEPT = '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp'
  ```
- [ ] 6.3 支持多文件选择（`multiple`）
- [ ] 6.4 在输入框区域上方显示已选文件列表（文件名 + 类型图标 + 大小 + 删除按钮）
- [ ] 6.5 文件列表按类型分组展示（文档 / 图片）
- [ ] 6.6 文件上传后自动触发解析，解析中显示 loading 状态
- [ ] 6.7 校验失败时弹出错误提示（使用 TDesign Message 组件）
- [ ] 6.8 适配移动端响应式布局

**影响分析**：
- 修改 `MessageInput.vue`，增加上传按钮 + 文件预览区
- 引入 `useFileUpload` composable
- 不影响已有消息发送逻辑

---

### 任务 7：ChatView.vue 集成

**目标**：在 ChatView 中 provide 文件上传状态，协调文件清理生命周期。

**涉及文件**：
- 修改 `frontend/src/views/ChatView.vue`

**具体工作**：
- [ ] 7.1 调用 `provideFileUpload()` 注入文件上传状态
- [ ] 7.2 「新建对话」时调用 `clearFiles()` 清空已上传文件
- [ ] 7.3 页面卸载时（`onUnmounted`）调用 `clearFiles()`
- [ ] 7.4 路由切换离开聊天页时清理文件

**影响分析**：
- 在 ChatView.vue 中新增 provide 调用
- 与现有的 provideChat() 模式一致
- 不影响已有逻辑

---

### 任务 8：useChat.ts 消息发送集成

**目标**：修改消息发送逻辑，将已解析的文件内容拼接到用户 message 中。

**涉及文件**：
- 修改 `frontend/src/composables/useChat.ts`

**具体工作**：
- [ ] 8.1 `sendMessage` 方法增加可选的 `attachedFiles: UploadFileInfo[]` 参数
- [ ] 8.2 组装发送给大模型的消息内容：
  ```
  [用户消息文本]

  [上传文件内容]
  --- 文件：xxx.docx ---
  <文件解析文字内容>
  --- 文件：xxx.xlsx ---
  <文件解析文字内容>
  ```
- [ ] 8.3 `/memory/add` 调用时仅传文件名清单（不传文件内容）：
  ```typescript
  await addMemory(userId, `本次对话涉及文件：${fileNames.join('、')}`, 'system')
  ```
- [ ] 8.4 `sendMessage` 调用完成后清除文件状态

**影响分析**：
- 修改 `useChat.ts` 的 `sendMessage` 方法签名和内容组装逻辑
- 修改量小，仅增加文件内容拼接步骤
- 不影响已有纯文本消息发送

---

### 任务 9：skill-gateway 图片 OCR 端点（Java + DdsUtil）

**目标**：在 skill-gateway 暴露 `POST /api/file/ocr-image` 端点，**纯 Java** 调用项目内工具类 `DdsUtil.getOcrText(InputStream)` 完成图片识别。OCR 能力不放在 agent-core，agent-core 不参与。

**约束**：
- 不能新增 `pom.xml` 外部依赖（AGENTS.md §7.1）
- `DdsUtil` 是项目内的工具类，放在 `com.lobsterai.skillgateway.util` 包下；当前为占位实现（返回固定提示文字），后续替换为真实 OCR 调用

**涉及文件**：

| 文件 | 操作 | 用途 |
|------|------|------|
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/FileOcrController.java` | **新增** | OCR REST 端点 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/FileOcrService.java` | **新增** | 调用 `DdsUtil.getOcrText`，做参数与异常处理 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/util/DdsUtil.java` | **新增** | OCR 工具类（占位实现：返回固定提示；后续替换为真实 OCR）|
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/OcrResponse.java` | **新增** | 响应 DTO |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/exception/OcrException.java` | **新增** | OCR 失败统一异常 |
| `backend/skill-gateway/src/main/resources/application.properties` | **追加** | `app.file.ocr.timeout-seconds` 等配置项 |

**具体工作**：

**A. 后端代码**

- [ ] 9.1 创建 `FileOcrController`
  - 注解 `@RestController @RequestMapping("/api/file")`
  - `@PostMapping(value = "/ocr-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)`
  - 接收 `@RequestParam("file") MultipartFile file`
  - 调用 `fileOcrService.recognize(file)` 返回 `OcrResponse`
  - `@ExceptionHandler(OcrException.class)` 返回 500 + 错误消息
- [ ] 9.2 创建 `DdsUtil`（项目内工具类，占位实现）
  ```java
  package com.lobsterai.skillgateway.util;

  public class DdsUtil {
      private DdsUtil() {}

      public static String getOcrText(InputStream inputStream) {
          // TODO: 替换为真实 OCR 实现
          return "图片识别功能正在开发中，请稍后。。。";
      }
  }
  ```
- [ ] 9.3 创建 `FileOcrService`
  ```java
  @Service
  public class FileOcrService {
      private final long timeoutSeconds;

      public FileOcrService(
          @Value("${app.file.ocr.timeout-seconds:10}") long timeoutSeconds
      ) {
          this.timeoutSeconds = timeoutSeconds;
      }

      public OcrResponse recognize(MultipartFile file) {
          if (file == null || file.isEmpty()) {
              throw new OcrException("uploaded file is empty");
          }
          try (InputStream in = file.getInputStream()) {
              String text = DdsUtil.getOcrText(in);
              return new OcrResponse(text, null);
          } catch (Exception e) {
              throw new OcrException("OCR failed: " + e.getMessage(), e);
          }
      }
  }
  ```
- [ ] 9.4 `OcrResponse` 字段：`text: String`、`confidence: Double`（DdsUtil 暂不返回置信度，先 null 即可）
- [ ] 9.5 `OcrException` extends `RuntimeException`
- [ ] 9.6 `application.properties` 追加：
  ```properties
  # OCR
  app.file.ocr.timeout-seconds=10
  # Spring Multipart
  spring.servlet.multipart.max-file-size=20MB
  spring.servlet.multipart.max-request-size=25MB
  ```

**B. 后续替换为真实 OCR 的步骤（保留 DdsUtil 签名即可，业务代码零改动）**

- [ ] 9.7 把 `DdsUtil.getOcrText` 方法体替换为真实 OCR 实现（HTTP / SDK / 命令行 等）
- [ ] 9.8 如果真实方法签名有变动（如参数变成 `byte[]` / `MultipartFile` / 文件路径），同步修改 `FileOcrService.recognize` 的调用处
- [ ] 9.9 如果需要引入第三方库，按 AGENTS.md §7.1 vendored 到 `backend/skill-gateway/lib/<name>/`，pom.xml 用 `system` 作用域引入

**C. 验证**

- [ ] 9.10 `mvn clean package -Dmaven.test.skip=true` 出 `target/skill-gateway.jar`
- [ ] 9.11 `java -jar target/skill-gateway.jar` 启动后，`curl -F file=@test.png http://localhost:18080/api/file/ocr-image` 返回 `{ "text": "图片识别功能正在开发中，请稍后。。。", "confidence": null }`
- [ ] 9.12 前端上传图片 → 端到端联调：图片出现在对话输入框，点击发送后 LLM 消息里能看到 `图片识别功能正在开发中，请稍后。。。` 文字

**影响分析**：
- `pom.xml` 改动：**0 行**（DdsUtil 是项目内类，无需任何依赖配置）
- 不引入任何 Maven 中心仓库依赖，也不 vendored 任何 jar
- 打包产物体积：不变
- agent-core 完全不参与 OCR：原任务 9 中规划的 `backend/agent-core/src/features/file-processor/` 目录**直接删除**（如已建）
- 前端任务 5 改动：仅 endpoint URL 一行

---

### 任务 10：Java skill-gateway 合规审计接口（骨架）

**目标**：在 Java 项目中暴露文件合规检查和加密文件解密接口骨架，供后续扩展。

**涉及文件**：
- 新建 `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/FileSecurityController.java`
- 新建 `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/FileSecurityService.java`
- 新建 `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/FileSecurityResult.java`

**具体工作**：
- [ ] 10.1 创建 `FileSecurityController`
  - `POST /api/file/compliance-check`：接收文件内容，返回合规审计结果（骨架）
  - `POST /api/file/decrypt`：接收加密文件引用，返回解密状态（骨架）
- [ ] 10.2 创建 `FileSecurityService`
  - `checkCompliance(content: String, fileName: String)`：合规审计骨架
    - 当前返回 `{ passed: true, message: "合规审计功能待实现" }`
    - 后续对接安全部敏感词库
  - `decryptFile(fileRef: String, userId: String, permissions: List<String>)`：解密骨架
    - 当前返回 `{ success: true, content: "" }`
    - 后续对接加密平台接口
- [ ] 10.3 创建 DTO 类 `FileComplianceRequest`、`FileDecryptRequest`
- [ ] 10.4 创建 DTO 类 `FileSecurityResult`（统一返回格式）
- [ ] 10.5 配置 SecurityConfig 放行新接口（或要求认证）

**影响分析**：
- 纯新增 Controller + Service，不影响已有功能
- 接口为骨架实现，返回默认通过（不阻塞正常流程）
- 后续安全部对接时仅需修改 Service 实现

---

### 任务 11：文件刷新/清理机制

**目标**：确保「新建对话」和「页面刷新」后文件状态被清除。

**涉及文件**：
- 修改 `frontend/src/composables/useFileUpload.ts`（已在任务 3 中实现 clearFiles）
- 修改 `frontend/src/views/ChatView.vue`（已在任务 7 中实现）

**具体工作**：
- [ ] 11.1 确认 `clearFiles()` 在 `useFileUpload` 中正确实现
- [ ] 11.2 确认 ChatView `onUnmounted` 钩子调用 `clearFiles()`
- [ ] 11.3 确认新建对话时触发 `clearFiles()`
- [ ] 11.4 确认前端不进行任何文件本地缓存（不存 localStorage/IndexedDB）
- [ ] 11.5 agent-core 处理文件后不落盘（仅内存处理）

**影响分析**：
- 不新增文件，在已有任务中完成
- 确认性任务

---

### 任务 12：前端依赖安装与构建验证

**目标**：安装新增依赖，确保构建通过。

**涉及文件**：
- 修改 `frontend/package.json`（添加依赖）

**具体工作**：
- [ ] 12.1 `npm install mammoth xlsx`（文档解析）
- [ ] 12.2 运行 `npm run build` 确保构建成功
- [ ] 12.3 运行 `npm run test` 确保已有测试全部通过
- [ ] 12.4 检查打包体积增量是否可接受

**影响分析**：
- 修改 `package.json`
- 需验证构建和已有测试

---

## 依赖关系图

```
任务 1 (类型定义)
  ├─► 任务 2 (校验工具)
  │     └─► 任务 3 (useFileUpload)
  │           ├─► 任务 6 (MessageInput 按钮)
  │           │     └─► 任务 7 (ChatView 集成)
  │           │           └─► 任务 11 (刷新清理)
  │           └─► 任务 8 (useChat 集成)
  │
  ├─► 任务 4 (文档解析器)
  │     └─► 任务 9 (agent-core 兜底)
  │
  ├─► 任务 5 (图片 OCR)
  │     └─► 任务 9 (agent-core OCR 主路径，后续 Java 扩展)
  │
  └─► 任务 10 (Java 合规接口)

任务 12 (依赖安装) - 在任务 4 之前完成
```

**推荐执行顺序**：1 → 2 → 3 → {4, 5, 10（并行）} → 6 → 7 → 8 → 11 → 12

---

## 接口汇总

### 新增前端接口调用

| 方法 | 路径 | 用途 | 调用方 |
|------|------|------|--------|
| POST | `/features/file/parse-document` | 旧格式文档解析（兜底） | useFileUpload |
| POST | `/features/file/ocr-image` | 图片 OCR 识别（主路径，后续可切换底层为 Java 实现） | useFileUpload |
| POST | `/api/file/compliance-check` | 文件合规审计（骨架） | useFileUpload（预留） |
| POST | `/api/file/decrypt` | 加密文件解密（骨架） | useFileUpload（预留） |

### 修改已有调用

| 原有调用 | 修改内容 |
|---------|---------|
| `POST /agent/run` | body 中 instruction 拼接文件解析文字 |
| `POST /memory/add` | text 追加本次对话涉及文件名 |

---

## 修改文件清单

| 文件路径 | 操作类型 | 说明 |
|---------|---------|------|
| `frontend/src/types/fileUpload.ts` | **新增** | 文件上传类型定义与常量 |
| `frontend/src/utils/fileValidator.ts` | **新增** | 文件格式/大小/数量校验 |
| `frontend/src/composables/useFileUpload.ts` | **新增** | 文件上传状态管理 |
| `frontend/src/utils/docxParser.ts` | **新增** | DOCX 文字提取 |
| `frontend/src/utils/xlsxParser.ts` | **新增** | XLSX 文字提取 |
| `frontend/src/utils/pptxParser.ts` | **新增** | PPTX 文字提取 |
| `frontend/src/utils/fileParser.ts` | **新增** | 文档解析统一入口 |
| `frontend/src/utils/imageOcr.ts` | **新增** | 图片 OCR（调用 agent-core） |
| `frontend/src/components/MessageInput.vue` | **修改** | 增加上传按钮 + 文件预览 |
| `frontend/src/views/ChatView.vue` | **修改** | provide 文件上传状态 + 清理 |
| `frontend/src/composables/useChat.ts` | **修改** | 消息内容拼接文件文字 |
| `frontend/package.json` | **修改** | 新增 mammoth、xlsx 依赖 |
| `backend/agent-core/src/features/file-processor/file-processor.controller.ts` | **新增** | 文件处理端点 |
| `backend/agent-core/src/features/file-processor/file-processor.service.ts` | **新增** | 文件处理逻辑 |
| `backend/agent-core/src/app.module.ts` | **修改** | 注册 FileProcessor 模块 |
| `backend/skill-gateway/.../controller/FileSecurityController.java` | **新增** | 合规审计接口骨架 |
| `backend/skill-gateway/.../service/FileSecurityService.java` | **新增** | 合规审计服务骨架 |
| `backend/skill-gateway/.../dto/FileSecurityResult.java` | **新增** | DTO 类 |

---

## 风险与注意事项

1. **旧格式文档处理**：.doc/.xls/.ppt 是二进制旧格式，前端 JS 库支持有限，需 agent-core 兜底处理
2. **大文件性能**：Word/PPT 单文件可达 5-10MB，解析时需考虑内存和 UI 阻塞（使用 Web Worker）
3. **依赖体积**：mammoth ~150KB gzip、xlsx ~300KB gzip，注意打包体积
4. **文件不落盘**：agent-core 使用 multer 内存存储，处理完立即释放，确保不留存
5. **合规审计**：当前为骨架实现（默认通过），后续对接安全部可能修改接口签名
6. **加密文件**：当前为骨架实现，后续需对接授权平台和加密平台的具体 API
7. **移动端适配**：文件上传按钮和预览在窄屏设备上需调整布局
8. **OCR 扩展**：当前 OCR 由 agent-core 节点的 tesseract.js 处理，后续可迁移至 Java 端以利用更成熟的 OCR 引擎
