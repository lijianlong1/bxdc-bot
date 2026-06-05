# frontend-vue-app

## Purpose

定义基于 Vue 3 的前端应用结构及 TDesign 集成（与 frontend-app 互补）。

## Requirements

### Requirement: Vue 3 应用结构

系统 MUST 提供一个通过 Vite 服务的基于 Vue 3 的单页应用 (SPA)。

#### Scenario: 应用程序初始化

- **当** 开发者运行 `npm run dev` 时
- **那么** 应用程序在 `localhost:5173` 启动
- **并且** 根组件渲染无错误

### Requirement: TDesign 集成

应用程序 MUST 使用 TDesign Vue Next 进行样式设计和基础组件。

#### Scenario: TDesign 主题

- **当** 应用程序加载时
- **那么** 应用 TDesign 全局主题样式
- **并且** TDesign 组件（例如 `t-button`）正确渲染

### Requirement: 路由

应用程序 MUST 使用 Vue Router 支持客户端路由。

#### Scenario: 默认路由

- **当** 用户访问根 URL `/` 时
- **那么** 渲染聊天界面组件

### Requirement: 与旧版 Chromium 兼容策略对齐

基于 Vue 3 的 SPA SHALL 遵守 `legacy-chromium-compatibility` 中关于 **Chromium 86 基线**、**核心路径可用**与 **构建目标** 的要求；实现 MAY 落在全局样式、Vite 配置与组件层，但 MUST 可在代码库或 README 中追溯到配置与手工/自动化验证说明。

#### Scenario: 与兼容 spec 一致

- **WHEN** 审查者对照 `legacy-chromium-compatibility` 规范检查本仓库前端
- **THEN** `frontend-vue-app` 的职责范围（SPA、TDesign、路由）与上述浏览器基线要求 **不冲突**
- **AND** 发布说明或开发者文档中 **可注明** 最低 Chromium/内核版本
