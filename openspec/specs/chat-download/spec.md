# Chat Download

## Purpose

Provide users the ability to download individual chat messages in Markdown (.md) and PDF (.pdf) formats directly from the chat interface, using locally vendored JavaScript libraries without external CDN dependencies.

## Requirements

### Requirement: 下载按钮展示
聊天界面 MUST 在每条 assistant 消息的 actions 区域展示一个下载按钮，与重新生成、复制、点赞、踩、分享按钮在同一灰色操作栏内。

#### Scenario: 存在 assistant 消息时显示下载按钮
- **WHEN** 聊天列表中包含至少一条 assistant 消息
- **THEN** 每条 assistant 消息的 actions 区域显示一个下载按钮（下载图标）
- **并且** 按钮位于分享按钮之后

#### Scenario: 无 assistant 消息时隐藏
- **WHEN** 聊天列表中仅有用户消息或欢迎语
- **THEN** 下载按钮不显示

### Requirement: 格式选择
点击下载按钮 MUST 弹出格式选择，支持 Markdown（.md）和 PDF（.pdf）两种格式。

#### Scenario: 弹出格式选择
- **WHEN** 用户点击下载按钮
- **THEN** 显示下拉菜单，包含 "Markdown (.md)" 和 "PDF (.pdf)" 两个选项

#### Scenario: 选择 Markdown 格式
- **WHEN** 用户选择 "Markdown (.md)"
- **THEN** 系统将当前单条消息导出为 .md 文件
- **并且** 触发浏览器下载

#### Scenario: 选择 PDF 格式
- **WHEN** 用户选择 "PDF (.pdf)"
- **THEN** 系统将当前单条消息渲染并导出为 .pdf 文件
- **并且** 触发浏览器下载（离屏渲染，用户无感知）

### Requirement: Markdown 导出内容
导出的 Markdown 文件 MUST 包含单条消息的完整对话内容，格式清晰可读。

#### Scenario: Markdown 文件内容结构
- **WHEN** 用户导出 Markdown
- **THEN** 文件包含标题 "BXDC.bot 对话记录"
- **并且** 消息以角色标识（用户 / BXDC.bot）和时间为开头
- **并且** 包含导出时间戳

#### Scenario: 空消息保护
- **WHEN** 当前消息无内容时触发下载
- **THEN** 不生成文件，静默返回

### Requirement: PDF 导出内容
导出的 PDF 文件 MUST 包含单条消息内容，中文渲染正确，排版清晰。

#### Scenario: PDF 文件内容结构
- **WHEN** 用户导出 PDF
- **THEN** PDF 文件包含标题和消息内容
- **并且** 用户消息与 assistant 消息通过颜色和 border-left 视觉区分
- **并且** 中文字体渲染正确（使用系统字体）

#### Scenario: PDF 生成不阻塞 UI
- **WHEN** PDF 生成过程中
- **THEN** 界面不卡顿
- **并且** 生成完成后自动触发下载

### Requirement: 无外部依赖
下载功能 MUST 不依赖外部 CDN 或 npm 下载专用库，使用项目本地 vendor JS 文件。

#### Scenario: 本地 vendor 加载
- **WHEN** 用户首次点击 PDF 下载
- **THEN** 系统动态加载本地 `/vendor/jspdf.umd.min.js` 和 `/vendor/html2canvas.min.js`
- **并且** 加载后缓存，后续下载不再重复加载
