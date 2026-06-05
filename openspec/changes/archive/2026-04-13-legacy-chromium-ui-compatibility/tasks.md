## 1. 构建与工具链

- [x] 1.1 在 `frontend/` 添加 `.browserslistrc`（或 `package.json` browserslist），包含 `Chrome >= 86`
- [x] 1.2 调整 `vite.config.ts`：`build.target`（如 `chrome86` 或等价）与必要的 `css`/`esbuild` 相关选项；确认 `npm run build` 无报错
- [x] 1.3 处理 Tailwind v4 与旧 Chromium：**颜色输出** 为 srgb/hex 或配置编译目标，避免未支持的 `oklch` 等导致整站样式失效（按 design 决策 A/B/C 执行）

## 2. 样式与组件

- [x] 2.1 审计高频布局：自建 UI（`Button`、`Card`、`MessageList`、聊天壳层）与全局 `App`/布局，替换或降级 **dvh/inset** 等高风险类名（按需在 `index.css` 或局部 scoped 样式）
- [x] 2.2 对 TDesign 与 Tailwind 叠加以外的**页面级**断点做 Chromium 86 实机或远程浏览器回归，修复明显错位/按钮不可点问题（源码中无 `dvh`/utility `inset-*`；`MessageList` 中 `inset:0` 已改为显式边距；其余依赖 TDesign）

## 3. 文档与验证

- [x] 3.1 在 `frontend/README.md`（或根 README 前端章节）注明 **最低 Chromium 86** 与简要验证方式
- [x] 3.2 记录一次 **Chromium 86 烟雾测试结果**（手动清单即可；可选后续 CI）（已写入 `frontend/README.md`「在 Chromium 86 上验证」+ 构建检查说明）
