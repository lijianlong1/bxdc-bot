## ADDED Requirements

### Requirement: 与旧版 Chromium 兼容策略对齐

基于 Vue 3 的 SPA SHALL 遵守 `legacy-chromium-compatibility` 中关于 **Chromium 86 基线**、**核心路径可用**与 **构建目标** 的要求；实现 MAY 落在全局样式、Vite 配置与组件层，但 MUST 可在代码库或 README 中追溯到配置与手工/自动化验证说明。

#### Scenario: 与兼容 spec 一致

- **WHEN** 审查者对照 `legacy-chromium-compatibility` 规范检查本仓库前端
- **THEN** `frontend-vue-app` 的职责范围（SPA、TDesign、路由）与上述浏览器基线要求 **不冲突**
- **AND** 发布说明或开发者文档中 **可注明** 最低 Chromium/内核版本
