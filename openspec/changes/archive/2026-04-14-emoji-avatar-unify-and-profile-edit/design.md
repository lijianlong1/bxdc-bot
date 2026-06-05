## Context

当前头像以 **字符串形式存储 emoji**（`User.avatar`），依赖系统字体渲染。旧内核或缺字体会导致 **tofu/缺失**。本变更将**统一头像展示**的**正式支持下限**定为 **Chromium / Chrome 内核 86 及以上**：实现所选库、DOM/CSS 与打包目标 SHALL 在该版本下可运行、可测；低于 86 的内核不在本变更承诺范围内（可与 `legacy-chromium-compatibility` 另行说明）。

## Goals / Non-Goals

**Goals:**

- 用户可见的 **头像 emoji**（及注册/编辑选择器中的选项）在目标浏览器中 **一致可辨**。
- 提供 **资料编辑** UI：改昵称、改头像；**用户 ID 只读**。**编辑本人资料不得引入管理员密码字段或「管理员确认」步骤**；鉴权仅依赖当前登录用户身份（如 `X-User-Id` 与路径 `id` 一致），与仅用户本人可改资料的规则一致。
- 服务端继续以 **字符串** 存头像（单 emoji 或短文本），与现网关一致；若未来要 URL 图片可再扩展。

**Non-Goals:**

- 不强制将聊天全文内所有 emoji 转为图片（体量大、性能成本）；可配置仅 **头像/用户名片**。
- 不修改用户 ID 策略与长度。

## Decisions

1. **统一渲染方案（推荐）**  
   使用 **Twemoji**（MIT）：将 emoji 标量转为 `<img>` + CDN 或打包静态 SVG/PNG，避免依赖本地彩色字体。备选：**Noto Color Emoji** 仅作 fallback（旧环境仍可能缺）。  
   实现：小型 Vue 组件 `UnifiedEmoji`（或扩展现有 Avatar），传入 `char`/`size`，内部 `twemoji.parse` 或等价。

2. **依赖与体积**  
   优先 **npm 包 + 本地 assets** 或 **jsDelivr 固定版本**；避免无版本 CDN。注意 **CSP** 若部署有 `img-src` 限制。

3. **API**  
   - 已有 `PUT /api/user/{id}/avatar`。  
   - 新增 **`PUT /api/user/{id}/profile`** 或扩展 body：`{ "nickname": "...", "avatar": "..." }`，**禁止** body 中含 `id` 变更；或单独 `PATCH` nickname。  
   - 鉴权：当前产品以 `X-User-Id` / 会话为主——实现时 MUST 校验 **路径 id 与当前登录用户一致**（防越权）。**不得**将「管理员密码」或等价特权凭证作为更新本人资料的前置条件。

4. **记忆与昵称**  
   昵称变更后是否回写 mem0/记忆：可选异步；**MVP** 可仅更新 DB，不在本 change 强制注入新记忆（可后续 task）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Twemoji 与 Unicode 新版本不同步 | 锁定版本；异常字符回退显示 raw 或占位 |
| 图片头像请求延迟 | `width/height` + `loading=lazy`；小尺寸 |
| 用户误以为自己改了 ID | UI 明确「用户 ID 不可修改」文案 |

## Migration Plan

1. 先合并 API 与前端编辑页，再全站替换头像展示组件。  
2. 回滚：移除 Twemoji 包装，恢复纯文本 avatar 字符串。

## Open Questions

1. 是否对 **助手侧** 非用户头像的 emoji 也统一（例如消息内 emoji）——默认 **否**，按产品再开 change。
