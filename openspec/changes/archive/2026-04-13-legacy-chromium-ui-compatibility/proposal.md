## Why

部分用户仍在使用 **Chromium 86**（及同代内核）的内嵌浏览器或旧版 Chrome；当前前端构建默认面向较新引擎，样式（尤其 Tailwind v4 / 现代色彩空间）与部分布局在旧内核上出现 **按钮错位、间距失真、颜色/渐变不生效** 等问题。需要明确「最低内核基线」并在构建与设计层做兼容，避免核心页面不可用。

## What Changes

- 声明 **Chromium 86（约 2020–2021）** 为产品级**最低可支持**基线（在可接受范围内；更旧版本不保证）。
- **构建配置**：通过 `browserslist`、Vite `build`/`css` 目标、必要时 **legacy / polyfill** 策略，使打包后的 CSS/JS 不依赖仅新内核才支持的语法。
- **样式策略**：规避或降级 **oklch/lab、仅新内核的 `inset`/`dvh`、flex `gap` 边缘 bug** 等导致的布局断裂；对关键界面（登录、注册、聊天主框架、主要按钮）提供可验证的降级表现。
- **验证**：在文档或 CI 中可选手动/自动化对照 Chromium 86 场景（或等价引擎版本）。

## Capabilities

### New Capabilities

- `legacy-chromium-compatibility`：定义 Chromium 86 级内核下页面可用性、样式与构建约束。

### Modified Capabilities

- `frontend-vue-app`：补充「最低 Chromium 版本 / 兼容模式」相关的要求（与上述 capability 一致，不重复细则）。

## Impact

- **frontend**：`vite.config`、`postcss/browserslist`、可选 `package.json` 脚本；全局或局部 CSS 修正（按钮、布局、Chat 容器）。
- **依赖**：通常不升主版本；可能增加 `browserslist` 配置与 `@vitejs/plugin-legacy`（若启用，会增大 bundle，见 design 取舍）。
- **后端**：无；仅静态资源与构建链路变化。
