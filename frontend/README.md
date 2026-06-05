# Fishtank 前端（Vue 3 + Vite + TDesign）

基于 Vue 3、Vite、Tailwind CSS v4 与 TDesign Vue Next 的单页应用。

## 浏览器基线

- **最低目标：Chromium 86**（桌面 Chrome 86、Android System WebView 86 或同内核嵌入式浏览器）。
- 构建已设置 `build.target` / `esbuild.target` 为 `chrome86`，并在 `style.css` 中使用 **sRGB 十六进制** 主题色，避免 Tailwind 默认的 `oklch` 等在旧内核中无效。
- 详见仓库根目录 `frontend/.browserslistrc`。

## 在 Chromium 86 上验证（烟雾测试）

维护者在发布前建议完成：

1. 使用 Chromium 86（或 BrowserStack / 本机旧版 Chrome）打开应用首页。
2. 确认 **登录、注册（若启用）** 页面表单与按钮可点、无整页样式丢失。
3. 进入 **聊天**：发送一条消息，确认输入框、发送按钮与消息列表布局正常。
4. 打开浏览器开发者工具 **Console**，确认无因语法错误导致的脚本白屏。

（最近一次配置级验证：在 `chrome86` 构建目标与 hex `@theme` 调色板下执行 `npm run build` 通过，产出 CSS 中无 `oklch` / `lab`。）

## 开发

```bash
npm install
npm run dev
```

默认开发服务器：<http://localhost:5173>。API 代理见 `vite.config.ts`。

## Twemoji 头像（内网 / 离线）

用户与 Skill 列表等处的 emoji 头像使用 **Twemoji** 转为图片。静态资源位于 `public/twemoji/14.0.2/assets/`（`svg` 与 `72x72` PNG），与 npm 依赖 `twemoji@14.0.2` 一致，**构建后从同源加载**，不依赖外网 CDN。

- 可选环境变量 **`VITE_TWEMOJI_ASSETS_BASE`**：自定义资源根 URL（末尾须带 `/`），用于单独 CDN 或子路径；未设置时使用 `import.meta.env.BASE_URL` + `twemoji/14.0.2/assets/`。
- 若需从官方仓库重新同步资源（升级版本或空目录时）：在项目根执行 `cd frontend && npm run vendor:twemoji`（需能访问 GitHub 一次）。
- 图形许可见 `node_modules/twemoji/LICENSE-GRAPHICS`（CC-BY 4.0）。
