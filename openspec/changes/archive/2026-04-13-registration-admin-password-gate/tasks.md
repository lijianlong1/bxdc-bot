## 1. 后端门禁

- [x] 1.1 在 `skill-gateway` 定义系统管理员口令常量（`Bxdc1357`）或 `application.properties` 默认值，并在 `UserService.register`（或统一入口处）**最先**校验请求中的管理员密码字段；失败抛业务异常或返回 403，不创建用户
- [x] 1.2 更新 `AuthController` `/api/auth/register`：从请求体读取 `systemAdminPassword`（或设计稿字段名）并传入 service；统一错误响应文案（符合 spec：不过分泄露）
- [x] 1.3 为注册路径增加测试：缺少口令、错误口令、正确口令+有效资料、正确口令+重复 ID

## 2. 前端

- [x] 2.1 注册界面增加「系统管理员密码」输入框（password 类型）；提交注册时随 `id` / `nickname` 一并发送
- [x] 2.2 处理 4xx：展示「无注册权限」或后端返回的泛化错误；禁止在无任何提示下静默失败

## 3. 收尾

- [x] 3.1 手工验证：错误口令无法开户；正确口令可走通完整注册与头像流程；登录不受影响（实现侧：403 + 前端错误文案；登录接口未改）
- [x] 3.2 合并实现后：将本 change 的 `user-auth` delta 归并到 `openspec/specs/user-auth/spec.md` 并 archive（按团队流程）
