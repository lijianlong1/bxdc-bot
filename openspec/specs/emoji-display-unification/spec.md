# emoji-display-unification

## Purpose

定义跨浏览器/跨操作系统下用户头像 emoji 的统一展示策略、可访问性底线与构建基线（Chromium 86+），与原生系统 emoji 字体解耦。

## Requirements

### Requirement: 用户头像 emoji 的跨环境一致展示

在支持的产品浏览器范围内，界面中用于表示 **用户头像**（及资料编辑预览中的头像）的 emoji SHALL **不依赖各操作系统自带彩色 emoji 字体作为唯一手段**；SHALL 通过前端引入的统一渲染机制（例如将标量转为图片或受控字体栈）保证 **可辨识、与所选字符语义一致**。

### Requirement: Chrome 内核 86 及以上为统一头像的正式支持基线

统一头像展示所采用的前端实现（组件、依赖与构建目标）SHALL 在 **Chrome / Chromium 内核 86 及以上**版本中 **功能可用**（渲染、交互、无未捕获异常）。低于 86 的内核不在本要求的承诺范围内。

#### Scenario: Chromium 86+ 上头像正常

- **WHEN** 用户在 **Chromium / Chrome 内核版本 ≥ 86** 的浏览器中查看头像展示区域
- **THEN** 统一头像渲染 **按设计工作**（可见图形或约定回退）
- **AND** 不因本变更引入的脚本或 API 在该版本上 **整页不可用**

#### Scenario: 低版本浏览器仍可见头像

- **WHEN** 用户在 **Chromium 86**（基线代表版本）中查看自己的头像展示区域
- **THEN** 头像区域 **显示与存储的 emoji 对应的可见图形**（图片或等价渲染）
- **AND** 不出现因缺字体导致的整片空白方块占满头像位（允许极端未收录字符回退到占位符）

### Requirement: 渲染实现可维护与可替换

统一 emoji 展示所依赖的库或静态资源 SHALL 版本固定或可锁定；SHALL 在文档或代码中注明替换为其他供应商（如换用自托管 sprite）时的影响面。

#### Scenario: 构建可复现

- **WHEN** 维护者在干净环境执行前端生产构建
- **THEN** 头像 emoji 渲染路径 **不依赖** 未声明的第三方浮动 URL（若使用 CDN，SHALL 在配置中集中管理版本）

### Requirement: 可访问性与回退

当统一渲染失败或网络不可达时，界面 SHALL **回退**到纯文本 emoji 或占位图标，SHALL NOT 因头像组件抛错导致整页崩溃。

#### Scenario: 渲染失败可降级

- **WHEN** 外部图片资源加载失败或解析库对某字符不支持
- **THEN** 用户仍能看到占位或原始字符尝试
- **AND** 聊天主流程 **可继续使用**

### Requirement: 内网与无外网环境下的 Twemoji 资源

用于头像展示的 Twemoji 图片资源 SHALL 来自 **与应用同源** 的静态路径（或部署文档中明确声明的同一站点前缀），SHALL NOT 将 **公网 CDN URL** 作为默认唯一资源根地址。

#### Scenario: 无公网出口环境

- **WHEN** 用户浏览器所在网络 **无法访问** 公网 CDN
- **THEN** 头像 emoji 图片 SHALL 仍能从 **当前站点** 加载成功（在资源已随构建发布的前提下）
- **AND** 默认实现 SHALL NOT 依赖运行时从外网拉取 Twemoji 主资源包

#### Scenario: 子路径部署

- **WHEN** 前端应用部署在 HTTP 子路径（例如 `https://intranet.example.com/app/`）
- **THEN** Twemoji 资源请求路径 SHALL 与应用的 `base` 或项目约定配置 **一致**，避免硬编码仅适用于根路径的绝对 URL
