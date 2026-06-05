## ADDED Requirements

### Requirement: 内网与无外网环境下的 Twemoji 资源

用于头像展示的 Twemoji 图片资源 SHALL 来自 **与应用同源** 的静态路径（或部署文档中明确声明的同一站点前缀），SHALL NOT 将 **公网 CDN URL** 作为默认唯一资源根地址。

#### Scenario: 无公网出口环境

- **WHEN** 用户浏览器所在网络 **无法访问** 公网 CDN
- **THEN** 头像 emoji 图片 SHALL 仍能从 **当前站点** 加载成功（在资源已随构建发布的前提下）
- **AND** 默认实现 SHALL NOT 依赖运行时从外网拉取 Twemoji 主资源包

#### Scenario: 子路径部署

- **WHEN** 前端应用部署在 HTTP 子路径（例如 `https://intranet.example.com/app/`）
- **THEN** Twemoji 资源请求路径 SHALL 与应用的 `base` 或项目约定配置 **一致**，避免硬编码仅适用于根路径的绝对 URL
