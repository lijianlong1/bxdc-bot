## 1. 按钮与输入集成

- [ ] 1.1 在 `<script setup>` 中引入 `useFileUpload`、`UploadIcon`、`FILE_INPUT_ACCEPT`、`FILE_TYPE_ICONS`、`FILE_TYPE_LABELS`
- [ ] 1.2 创建隐藏的 `<input type="file" multiple :accept="FILE_INPUT_ACCEPT">`
- [ ] 1.3 创建上传按钮 `t-button variant="text"` 绑定 click 事件触发 input.click()
- [ ] 1.4 input change 事件调用 `addFiles(files)` 并清空 input.value

## 2. 文件列表展示

- [ ] 2.1 在 TChatSender 上方添加 `<div class="file-list">` 容器
- [ ] 2.2 仅在 `Object.values(uploadedFiles).flat().length > 0` 时渲染
- [ ] 2.3 遍历 5 个 FileType 分组：word/excel/ppt/txt 一组（"文档"），image 一组（"图片"）
- [ ] 2.4 每个文件渲染图标 / 缩略图 / 文件名 / 大小 / 删除按钮
- [ ] 2.5 大小格式化：bytes → "X.XX MiB" 或 "X.XX KB"
- [ ] 2.6 删除按钮调用 `removeFile(info.id)`

## 3. 解析状态显示

- [ ] 3.1 status === 'parsing' 时显示 loading 图标
- [ ] 3.2 status === 'failed' 时显示错误信息
- [ ] 3.3 status === 'parsed' 时显示 ✓ 标识

## 4. 自动触发解析

- [ ] 4.1 在 addFiles 调用完成后，对每个新增文件调用 `parseFileContent(info)`
- [ ] 4.2 使用 `Promise.all` 并行触发（图片可并发请求 OCR）

## 5. 样式与响应式

- [ ] 5.1 添加 `.file-list`、`.file-list-group`、`.file-list-item` 等 scoped CSS
- [ ] 5.2 移动端 `@media (max-width: 768px)` 调整 padding/缩略图/字体
- [ ] 5.3 文件名溢出用 ellipsis
- [ ] 5.4 缩略图 48-64px 方形，圆角 4px

## 6. 验证

- [ ] 6.1 运行 `npx vue-tsc --noEmit` 确认编译通过
- [ ] 6.2 浏览器打开页面手动点击上传按钮选择 .docx 和 .png 验证
