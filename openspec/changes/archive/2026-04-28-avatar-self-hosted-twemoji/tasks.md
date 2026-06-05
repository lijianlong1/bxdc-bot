## 1. 静态资源与基路径

- [x] 1.1 锁定 Twemoji 版本（与当前产品一致，如 14.0.2），将 `assets/svg` 与头像降级所需的 `72x72` 等目录纳入 `frontend/public/`（或构建拷贝脚本），保证构建后可通过同源路径访问
- [x] 1.2 修改 `frontend/src/utils/twemojiAvatar.ts`：默认 `TWEMOJI_ASSETS_BASE` 指向同源相对根（结合 `import.meta.env.BASE_URL`），可选支持 `VITE_TWEMOJI_ASSETS_BASE` 覆盖
- [x] 1.3 自检 `UserAvatar` 等调用链：SVG → PNG → 占位 回退仍可用

## 2. 构建与文档

- [x] 2.1 在 `frontend` README 或 `docs/` 部署文档中说明：内网部署需随构建带上 Twemoji 静态资源；可选记录从官方发布包同步资源的步骤
- [x] 2.2 若存在 CSP / `img-src` 文档，更新为以同源为主、外网 CDN 非必需

## 3. 验证

- [x] 3.1 本地用「禁用外网」或 hosts 屏蔽 CDN 的方式 smoke：头像与资料页 emoji 正常
- [x] 3.2 运行前端测试套件；必要时补充对 `avatarDisplayUrl` 基路径的单元测试

## 4. 规范合并

- [x] 4.1 实现完成后将本 change 中 `specs/emoji-display-unification/spec.md` 的 ADDED 内容合并入 `openspec/specs/emoji-display-unification/spec.md`（archive 流程）
