## Why

前端头像统一使用 Twemoji 将 emoji 转为图片时，`twemojiAvatar.ts` 将资源根地址写死为 **公网 CDN**（`cdn.jsdelivr.net`）。项目若部署在**纯内网**、无外网出口或策略禁止访问外部域名时，浏览器无法下载图片，头像区域会大面积失败或长期走降级路径，与「统一展示」目标冲突。

## What Changes

- 将 Twemoji 静态资源（与当前锁定版本一致或明确可复现的版本）**随前端产物一并提供**（例如放入 `public/` 或构建时拷贝），通过 **同源相对路径** 访问，**不依赖**运行时访问外网 CDN。
- 保留可配置能力：部署方可通过环境变量或构建时配置指定资源基路径（例如子路径部署 `/app/`），便于网关与静态资源前缀对齐。
- 文档中说明内网/离线构建与发布步骤；**非 BREAKING**：默认行为从「外网 CDN」改为「同源静态资源」，对外网可达环境无功能回退风险。

## Capabilities

### New Capabilities

（无；行为归属既有 emoji 展示能力。）

### Modified Capabilities

- `emoji-display-unification`：补充「内网/无外网环境下 SHALL 不依赖外网 URL 拉取 Twemoji 资源」的规范性要求与场景。

## Impact

- **前端**：`frontend/src/utils/twemojiAvatar.ts`、构建与 `public`（或等价）资源布局；可选 `vite.config`、`frontend` 环境变量示例。
- **文档**：部署说明（`docs/` 中单机/内网相关文档可交叉引用）。
- **运维**：Twemoji 仅随仓库保留 **产品白名单 emoji** 对应的 `svg`/`72x72` 文件（见 `frontend/src/constants/twemojiCoveredEmoji.ts` 与 `scripts/prune-twemoji-assets.mjs`），体积远小于全量包；`vendor:twemoji` 拉取官方包后会自动裁剪。
