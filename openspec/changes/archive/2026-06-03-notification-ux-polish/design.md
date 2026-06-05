## 1. 自动 schema 迁移

### 设计目标
- 部署到内网时，DBA 不会手工 ALTER
- 启动时自动检查 + 补列/索引
- 幂等，重复执行安全
- 早于 `@EnableScheduling` 调度器

### 实现
`SchemaMigrationRunner` 实现 `InitializingBean.afterPropertiesSet()`：
- 该钩子在 DataSource 完全就绪、所有 bean 注入完毕后立即触发
- 比 `ApplicationRunner.run()` 更早
- 在 `@EnableScheduling` 调度器启动**之前**完成

### 检查流程
1. `information_schema.TABLES` → 表是否存在
2. `information_schema.COLUMNS` → 列是否存在
3. `information_schema.STATISTICS` → 索引是否存在
4. 缺失则执行对应 `ALTER TABLE`

### 检查项
- `async_tasks.notified_at` 列
- `idx_async_user_unread` 索引

### 失败容忍
迁移失败仅 `log.warn`，**不阻塞应用启动**。即使迁移没跑通，应用也能继续跑（只是定时任务在第一次查询时会再次报错）。

## 2. ThinkingMode 文案改造

### 改名对照

| 原 | 新 | 出现位置 |
|----|----|---------|
| 思考模式 | 调用过程 | `<span class="thinking-title">` 标题 |
| 思考中... | 准备调用... | `currentStepText` 的 `case 'thinking'` |
| 思考中 | 调用准备 | `getNodeLabel('thinking')` |
| 思考 | 调用 | `getNodeLabel` 的 `default` |
| 开始思考 | 开始调用 | `useThinkingMode.ts` addNode 'thinking' title |
| 分析问题... | 准备调用流程... | `useThinkingMode.ts` addNode 'thinking' content |

### 影响范围
只改中文字符串，**不影响 type、status、event 等机器可读字段**。前端事件协议不变。

## 3. 通知铃铛改文字

### 原因
- `<t-icon name="notification" />` 依赖 tdesign 字体包加载
- 在内网低版本浏览器（IE 兼容 / 老版 Chrome）下 tdesign 字体加载失败 → 图标不可见
- 改用纯文字"消息"，零依赖、最稳

### 改动
```vue
<!-- 原 -->
<t-button>
  <template #icon>
    <t-icon name="notification" />
  </template>
</t-button>

<!-- 新 -->
<t-button>消息</t-button>
```

同时删除 `TaskNotificationBell.vue` 中 `.bell-button { font-size: 18px; }` 自定义样式，
让"消息"按钮和顶栏其他 `t-button`（Servers / SkillHub / 大模型设置 / 编辑资料）字号保持完全一致。

`MessageList.vue` 的 banner 头从 `🔔` emoji 改为"消息"文字标签（带边框 + 圆角 + 品牌色），保持视觉一致。

## 4. 通知列表功能增强

### 4.1 交互模式切换

```
[非批量模式 - 默认]
  顶部: ........ 批量管理
  每条: [内容区]  [查看] [删除]
  - 点击内容区 → 弹窗查看详情
  - 点击查看按钮 → 弹窗查看详情
  - 点击删除按钮 → confirm → DELETE

[批量模式]
  顶部: [✓ 全选 N/M]  [批量删除] [取消]
  每条: [☐ 复选框] [内容区]
  - 点击内容区 → 切换勾选
  - 点击复选框 → 切换勾选
```

### 4.2 详情弹窗（t-dialog）

`width="640px"`，不跳转。展示字段：
- 任务 ID、关联 skill 名称、skill_id
- 状态 tag + 未读点
- 外部任务 ID / 会话 ID（mono 字体）
- 重试次数、已耗时
- 开始时间 / 创建时间 / 完成时间
- POLLING / PENDING 状态显示进度条
- FAILED 状态显示错误信息块（红色边框）
- COMPLETED 状态显示结果摘要块（截断 200 字符）

打开弹窗时自动 `acknowledge`（标记已读），关闭弹窗清空状态。

### 4.3 后端 API

```java
@DeleteMapping("/{id}")
public ResponseEntity<?> deleteOne(@PathVariable Long id, @RequestHeader X-User-Id) {
    int affected = service.deleteByIdAndUser(id, userId);
    return ok{ok: affected > 0, affected};
}

@PostMapping("/batch-delete")
public ResponseEntity<?> batchDelete(@RequestBody Map body, @RequestHeader X-User-Id) {
    List<Long> ids = extractLongIds(body.get("ids"));
    int affected = service.deleteByIdsAndUser(userId, ids);
    return ok{ok: true, affected, requested: ids.size()};
}
```

### 4.4 Mapper（防止越权）

```java
@Update("DELETE FROM async_tasks WHERE id = #{taskId} AND user_id = #{userId}")
int deleteByIdAndUser(Long taskId, String userId);

@Update({
    "<script>",
    "DELETE FROM async_tasks WHERE user_id = #{userId} AND id IN ",
    "<foreach item='id' collection='ids' open='(' separator=',' close=')'>",
    "#{id}",
    "</foreach>",
    "</script>"
})
int deleteByIdsAndUser(String userId, List<Long> ids);
```

WHERE 条件强制 `user_id = ?`，**无法越权删除别人的任务**。

## 兼容性

- ✅ 通知 API 端点变更向后兼容（旧的 `GET /my` / `ack` 不变）
- ✅ `notified_at` 自动迁移对老库 100% 安全（缺失才加）
- ✅ ThinkingMode 改名只改中文字符串，**事件协议不变**
- ✅ 铃铛改文字不影响布局
- ✅ 详情弹窗的 `t-dialog` 已经在其他页用过的成熟组件
