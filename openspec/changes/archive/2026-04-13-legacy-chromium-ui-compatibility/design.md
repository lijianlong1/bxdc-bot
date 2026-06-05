## Context

前端栈：`Vite 7 + Vue 3 + Tailwind CSS v4（@tailwindcss/vite）+ TDesign Vue Next`。默认工具链面向较新浏览器；**Chromium 86** 缺少或不完整支持部分现代 CSS（例如部分颜色空间、`inset`/`dvh` 组合、或构建阶段未下修的语法），导致按钮、间距、主布局异常。

## Goals / Non-Goals

**Goals:**

- 将 **Chromium 86** 定为**目标最低**等级（同版本 WebView/Chrome 一致对待），核心路径可完成注册、登录、聊天主界面操作。
- 通过 **browserslist + Vite 构建目标 + CSS 输出策略** 减少「语法过新」导致的解析失败。
- 对仍依赖手写 utility 的界面（自建 `Button`/`Card`、Tailwind class）做 **针对性降级**（回退 hex/srgb、避免仅新内核可用的缩写）。

**Non-Goals:**

- 不支持 IE11 或低于 Chromium 80 的引擎（除非另行立项）。
- 不要求与 Chromium 86 像素级一致于最新 Chrome（允许轻微视觉差）。
- 不强制引入体积很大的 polyfill 包，除非验证确有必要。

## Decisions

1. **Browserslist 单点真理**  
   在仓库 `frontend/` 添加 `.browserslistrc`（或 `package.json` 的 `browserslist` 字段），内容包含 **`Chrome >= 86`**（可选并列 `Android >= 86` 若需 WebView）。供 PostCSS Autoprefixer、可选的 Lightning CSS / esbuild 目标引用。

2. **Vite `build.target`**  
   将 `build.target` 设为 `chrome86` 或 `es2019` 等低于默认的集合，避免输出的 **原生可选链等**在未走 legacy 的旧设备上断裂（当前 Vue 编译通常已处理语法；主要风险在依赖包未转译——若出现再开子任务加 `optimizeDeps`/`build.commonjsOptions`）。

3. **Tailwind v4 与颜色**  
   Tailwind 4 可能生成 **oklch** 等颜色；Chromium 86 **不支持** oklch。决策路径（实现时二选一或组合）：

   - **A.** 在主题或配置中强制 **hex/`rgb`** 作为组件 token；  
   - **B.** 使用 PostCSS/LightningCSS `targets` 将 oklch **转译为** sRGB（若工具链支持）；  
   - **C.** 对受影响 utility 增加 **`@supports` 后备** 或局部覆盖。

   优先试 B/A，避免全站手写覆写。

4. **布局关键字**  
   对已知问题区域：将 **`inset-0`** 等改为 **`top/left/right/bottom: 0`**（若测出 86 下异常）；将 **`min-h-dvh`** 改为 **`min-height: 100vh`** 或带 `@supports (height: 100dvh)` 的分支。

5. **Legacy 插件**  
   **默认不启用** `@vitejs/plugin-legacy`，除非在真机/模拟器上确认仍缺 ES 特性；启用会显著增包，作为备选决策记入 tasks。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| TDesign 内部样式含新语法 | 升级/锁定版本或覆盖 CSS 变量为 hex |
| 仅能在真机验证 | 文档写明 Chrome 86 验证步骤；可选 Playwright 固定浏览器版本 |
| Autoprefixer 与 Tailwind v4 管线重复 | 明确单一事实来源，避免互相覆盖 |

## Migration Plan

1. 合并后本地 `npm run build`，在 Chromium 86（或开发者工具 UA + 旧内核镜像）做烟雾测试。  
2. 若有回归，回滚浏览器目标与主题补丁即可，不涉及后端。

## Open Questions

1. 实际失败场景主要来自 **颜色** 还是 **flex/grid**——实现第一轮后以用户反馈为准。  
2. 是否在 README 标注「最低 Chrome 86」——建议与 spec 同步。
