## ADDED Requirements

### Requirement: 下载按钮展示
聊天界面 MUST 在每条 assistant 消息的 actions 区域（现有复制按钮旁边）展示一个下载按钮。

#### Scenario: 存在 assistant 消息时显示下载按钮
- **WHEN** 聊天列表中包含至少一条 assistant 消息
- **THEN** 每条 assistant 消息的 actions 区域显示一个下载按钮（图标或文字）
- **并且** 按钮位于现有复制按钮之后

#### Scenario: 无 assistant 消息时隐藏
- **WHEN** 聊天列表中仅有用户消息或欢迎语
- **THEN** 下载按钮不显示（或置灰不可点击）

### Requirement: 格式选择
点击下载按钮 MUST 弹出格式选择，支持 Markdown（.md）和 PDF（.pdf）两种格式。

#### Scenario: 弹出格式选择
- **WHEN** 用户点击下载按钮
- **THEN** 显示下拉菜单或弹出菜单，包含 "Markdown (.md)" 和 "PDF (.pdf)" 两个选项

#### Scenario: 选择 Markdown 格式
- **WHEN** 用户选择 "Markdown (.md)"
- **THEN** 系统将当前会话完整对话导出为 .md 文件
- **并且** 触发浏览器下载

#### Scenario: 选择 PDF 格式
- **WHEN** 用户选择 "PDF (.pdf)"
- **THEN** 系统将当前会话完整对话导出为 .pdf 文件
- **并且** 触发浏览器下载

### Requirement: Markdown 导出内容
导出的 Markdown 文件 MUST 包含完整的对话内容，格式清晰可读。

#### Scenario: Markdown 文件内容结构
- **WHEN** 用户导出 Markdown
- **THEN** 文件包含标题 "BXDC.bot 对话记录"
- **并且** 每条消息以角色标识（**用户** / **BXDC.bot**）开头
- **并且** 消息按时间顺序排列
- **并且** 包含对话生成时间戳

#### Scenario: 空对话保护
- **WHEN** 当前无对话内容时触发下载
- **THEN** 不生成文件，或给出"暂无对话内容"提示

### Requirement: PDF 导出内容
导出的 PDF 文件 MUST 包含与 Markdown 相同的对话内容，排版清晰。

#### Scenario: PDF 文件内容结构
- **WHEN** 用户导出 PDF
- **THEN** PDF 文件包含标题和完整对话
- **并且** 用户消息与 assistant 消息在视觉上有区分
- **并且** 代码块保持等宽字体渲染

#### Scenario: PDF 生成不阻塞 UI
- **WHEN** PDF 生成过程中
- **THEN** 界面不卡顿
- **并且** 生成完成后自动触发下载
