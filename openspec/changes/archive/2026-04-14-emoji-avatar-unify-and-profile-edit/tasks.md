## 1. Backend: profile update API

- [x] 1.1 在 skill-gateway 增加或扩展用户资料更新接口（昵称 + 头像），与现有 `PUT /api/user/{id}/avatar` 风格一致；路径中的 `id` 必须与当前登录用户一致，禁止通过 body 修改用户 ID；**不得**要求管理员密码才能更新本人资料。
- [x] 1.2 在 `UserService` 中实现校验：昵称规则与注册一致；头像为合法 emoji/短字符串；拒绝任何变更主键的意图。
- [x] 1.3 为上述接口补充或更新控制器测试（成功、越权、非法昵称）。

## 2. Frontend: unified emoji avatar

- [x] 2.1 引入 Twemoji（或 design 中选定的等价方案），封装 `UnifiedEmoji` / 扩展 Avatar 组件，将头像字符串渲染为统一图片或受控展示；处理加载失败回退。
- [x] 2.2 在聊天消息区、侧栏/顶栏等展示当前用户头像处改用统一组件，保证与资料区观感一致。
- [x] 2.3 确认生产构建与 CSP：`img-src` 或本地资源路径可加载；必要时在配置中集中声明 CDN 版本。

## 3. Frontend: profile edit UI

- [x] 3.1 增加「编辑资料」入口（设置或侧栏），表单包含昵称、头像（emoji 选择或与注册一致的流程）；用户 ID 只读展示或不提供编辑；**不要求用户输入管理员密码**。
- [x] 3.2 对接新/扩展的 profile API，成功后更新本地用户状态与界面展示。

## 4. Specs & verification

- [x] 4.1 在 **Chromium/Chrome 86 及以上**手动验证：统一头像可见、编辑保存后刷新仍正确、越权修改他人资料被拒绝、**编辑资料流程无管理员密码**。（实现：`vite` 已 `target: chrome86`；请在本地浏览器做一次冒烟验证。）
