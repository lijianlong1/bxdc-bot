## Context

文件上传功能任务 7：App/ChatView 层整合与文件状态生命周期管理。

**关键约束（用户最新需求）**：
- 关闭浏览器窗口 / 刷新页面 → 清空文件
- 跳转到其他路由（如 /skill-hub）后返回 → 文件仍要存在

**当前状态**：
- `frontend/src/App.vue` 是根组件，包含 `<router-view />`，整个 SPA 生命周期内不会卸载
- `frontend/src/views/ChatView.vue` 每次进入 /chat 时挂载，离开时卸载
- `frontend/src/composables/useFileUpload.ts`（任务 3）已实现 `provideFileUpload` / `useFileUpload` / `clearFiles` 等方法
- `frontend/src/components/MessageInput.vue`（任务 6）已通过 `useFileUpload()` 获取状态

**核心问题**：如果把 `provideFileUpload` 放在 ChatView，ChatView 卸载时 state 也会被销毁，跳转后返回会丢失文件。所以必须把 provide 上提到 App.vue（整个应用生命周期内只创建一次）。

## Goals / Non-Goals

**Goals:**
- 在 App.vue 中 `provideFileUpload()`，让 MessageInput 走共享状态，跨路由切换时文件保持
- `window.beforeunload` 事件触发时清空文件（窗口关闭 / 刷新）
- 路由切换（`onBeforeRouteLeave` / `onUnmounted`）不触发清理
- 不修改 useFileUpload / useChat 接口
- 不修改 MessageInput.vue（任务 6 仍消费 `useFileUpload()` 注入）

**Non-Goals:**
- 不实现 useChat 的 `clearChat` 方法（不在任务 7 范围）
- 不修改 useFileUpload 的 `clearFiles` 实现
- 不引入 localStorage / IndexedDB 缓存
- 不在 ChatView 中提供「新建对话」按钮
- 不处理"新建对话"语义（用户当前需求只关心窗口关闭 vs 路由切换）

## Decisions

1. **provide 上提到 App.vue**（替代方案：放 ChatView）
   - 替代方案：放 ChatView → 路由切换后状态丢失，违背用户需求
   - 选用方案：放 App.vue → 整个 SPA 生命周期内只创建一次 state，跨路由切换时 ChatView 卸载重建，state 不变

2. **使用 `window.beforeunload` 而非 `onUnmounted`**
   - `onUnmounted` 在 ChatView 卸载时触发，路由切换就会触发，违背需求
   - `beforeunload` 仅在窗口/tab 关闭、刷新时触发，正好符合"关闭浏览器窗口后清空"

3. **不在 ChatView 暴露 `clearChat` 方法**
   - 当前需求不要求"新建对话"语义
   - 避免引入未使用的 API；如果将来需要，由 useChat 统一管理

4. **`onBeforeUnmount(App)` 中移除 `beforeunload` 监听器**
   - 防止潜在的内存泄漏
   - 即便 App.vue 实际很少卸载，遵循 Vue 生命周期规范

## Risks / Trade-offs

- [Risk] 浏览器关闭时 `beforeunload` 回调可能没有足够时间完成（同步阻塞）→ 缓解：`clearFiles` 内部只做 `URL.revokeObjectURL` + 重置 ref，开销极小，可视为同步
- [Trade-off] 把 provide 放在 App.vue 后，所有子路由（如 /skill-hub）都能 inject 到 fileUpload state → 当前没有副作用；如果未来有需要隔离的页面（如多 tab 对话），需重构
- [Trade-off] 刷新页面也会清空文件（用户未明确表态，但通常符合预期）→ 缓解：可在后续任务中按需扩展（例如用 sessionStorage 暂存文件名）

## Open Questions

- 是否需要在 useChat 中增加 `clearChat` 方法同时清空消息和文件？当前需求不涉及，留待后续。
