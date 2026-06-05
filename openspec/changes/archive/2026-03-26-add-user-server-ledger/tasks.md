## 1. Backend Data Model And APIs

- [x] 1.1 新增服务器台账 entity、repository，并建立与用户的关联关系
- [x] 1.2 为服务器台账增加 `(user_id, ip)` 唯一约束及基础字段校验
- [x] 1.3 实现当前用户维度的服务器台账 service 与 CRUD controller 接口
- [x] 1.4 调整接口响应，确保列表查询不返回明文密码

## 2. SSH Skill Ledger Resolution

- [x] 2.1 调整 SSH Skill 请求处理逻辑，按当前用户和目标 `ip` 查询服务器台账
- [x] 2.2 将台账中的 `username`、`password` 接入现有 SSH 执行链路
- [x] 2.3 为未登记 IP、越权访问和重复 IP 等场景补充错误处理
- [x] 2.4 保持并验证 SSH 命令安全过滤在台账解析后仍然生效

## 3. Frontend Ledger Management UI

- [x] 3.1 在主界面增加“服务器台账”入口按钮和可打开的管理视图
- [x] 3.2 实现服务器台账列表加载、空状态和错误状态展示
- [x] 3.3 实现新增、编辑、删除服务器台账的表单与交互
- [x] 3.4 对接前端 API 调用，并在操作成功后刷新列表

## 4. Verification

- [x] 4.1 为后端补充服务器台账 CRUD、用户隔离和 SSH 台账解析测试
- [x] 4.2 为前端补充台账列表与维护流程的关键交互验证
- [x] 4.3 手动验证不同用户登录后只能看到自己的服务器台账，且 SSH Skill 能按对应 IP 成功取到登录信息
