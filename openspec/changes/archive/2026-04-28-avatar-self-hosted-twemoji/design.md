## Context

- 现状：`TWEMOJI_ASSETS_BASE` 指向 `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/`。
- 约束：内网部署无公网 DNS/出站；即使能解析 CDN，安全策略也可能禁止 `img-src` 外域。

## Goals / Non-Goals

**Goals:**

- 头像渲染使用的 Twemoji **图片 URL** 默认同源（或与应用 `base` 一致），构建后可离线验证。
- 版本与仓库内 `twemoji` 依赖/产品约定 **一致、可锁定**（与现有 `14.0.2` 对齐除非有升级变更）。
- 失败时仍符合既有「占位 / PNG 回退 / 不崩页」行为。

**Non-Goals:**

- 不强制引入服务端动态切图；仍以**静态文件**为主。
- 不在本变更中替换 Twemoji 为其他 emoji 渲染引擎（除非评估后极小改动）。

## Decisions

1. **资源落位**  
   - 将 `assets/svg`（及头像路径需要的 `72x72` PNG 备选）放入 **`frontend/public/twemoji/`**（或 `public/twemoji-assets/`，命名在实现中统一），构建后映射为 **`/twemoji/...`**。  
   - **理由**：Vite 对 `public` 原样拷贝，路径稳定；与 `emoji-display-unification` 中「不依赖未声明的第三方浮动 URL」一致。

2. **基路径配置**  
   - 使用 **`import.meta.env.BASE_URL`** 拼接 Twemoji 根路径，支持子路径部署；可选 **`VITE_TWEMOJI_ASSETS_BASE`** 覆盖（末尾无斜杠或统一规范化在实现中处理）。  
   - **理由**：与 Vite 惯例一致；内网反向代理挂载在子路径时无需改代码。

3. **资源获取方式**  
   - 构建脚本或文档步骤：从 **Twemoji 官方发布包**（与版本号一致）解压 `assets` 到 `public`，或采用经许可的 npm 辅助包（若存在且版本锁定）。  
   - **理由**：许可证与可追溯性；避免从未知镜像随机拉取。

4. **CSP**  
   - 同源后 `img-src` 可收紧；文档注明若仍允许 `data:` 占位则保留现有 `neutralAvatarPlaceholderDataUri`。

## Risks / Trade-offs

- **[Risk] 仓库体积** → 随构建仅保留 **`frontend/src/constants/twemojiCoveredEmoji.ts` 列出的 emoji** 对应的 `svg` 与 `72x72` 文件；`npm run vendor:twemoji` 拉取全量后会自动执行 `prune-twemoji-assets.mjs`。用户/内置 Skill/扩展 Skill 派生/消息 UI 与 **AI 生成头像**（`agent-core` 提示词白名单）须与此集合一致，避免缺图。
- **[Risk] 遗漏 emoji 文件** → 保持 `@error` 链式回退（PNG → 占位）不变；`twemojiAvatar` 对 `toCodePoint` 与磁盘文件名不一致的末尾 `-fe0f` 做归一。

## Migration Plan

- 新构建：带上 `public` 下 Twemoji 资源即可。  
- 已有环境：重新构建并部署前端静态资源；无需改后端。

## Open Questions

- 是否将 Twemoji 全量 `svg`（体积较大）与仅「用户可选 emoji 子集」二选一：建议在实现任务中采用**全量官方 assets 与现网 CDN 行为一致**，避免缺图。
