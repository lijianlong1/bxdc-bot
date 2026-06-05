## Context

- **SkillGateway** 当前 `SkillService.canWriteSkill` 对 `PUBLIC` 在 `userId` 非空时直接返回 `true`，导致任意用户可改他人公开 Skill。
- **Agent Core** 中 `loadGatewayExtendedTools` 注册的 `DynamicTool` 使用字符串 `input` 执行；`requiresConfirmation` 仅从网关加载但未在执行前校验。`JavaSshTool` 另有基于危险命令模式的确认逻辑，与 Skill 元数据无关。
- **skill-visibility** 规格中「公共 Skill 写策略」仍为二选一占位，需收紧为创建者唯一写。

## Goals / Non-Goals

**Goals:**

- 网关侧：`PUT`/`DELETE` 对 `PUBLIC` Skill：**一般情况**仅当 `X-User-Id` 与 `createdBy` 一致；**例外**：`createdBy` 等于平台作者 `public` 时，仅 **固定管理员用户 ID `890728`**（字符串，与 `X-User-Id` 一致比较）可写；该 ID **写死在代码**中（不做配置文件，后续若要多管理员再演进）。
- Agent 侧：扩展 Skill 执行前若 `requiresConfirmation`，首次调用返回 `CONFIRMATION_REQUIRED`；用户确认后再次调用携带确认标志并执行。
- 前端：管理列表与编辑入口与写权限一致（无写权限则不可编辑/删除）。

**Non-Goals:**

- 不改变「列表可见性」规则（仍可见所有 `PUBLIC`）。
- 不引入完整 RBAC；除 **创建者写本人 Skill** 与 **`890728` 写 `createdBy=public` 平台行** 外无其他角色模型。

## Decisions

1. **公共 Skill 写：默认仅创建者**  
   - **Rationale**：与「公开只读、仅作者维护」一致，避免任意用户篡改他人公开 Skill。  
   - **例外**：见下条。

2. **`createdBy = public` 的平台行（`PUBLIC`）**  
   - **Rationale**：库中可能存在 `createdBy` 与 `SkillService.PLATFORM_PUBLIC_AUTHOR`（`"public"`）一致的行，无真实用户与之匹配，需单独维护入口。  
   - **Decision**：在 SkillGateway 中 **硬编码** 管理员用户 ID **`"890728"`**（常量，与 `X-User-Id` 做字符串相等比较）。当且仅当 `userId` 等于该常量且 `createdBy` 为 `public` 时，允许 `PUT`/`DELETE`。  
   - **非目标**：`890728` **不得**凭此身份编辑 `createdBy` 为其他用户（如真实用户 A）的 Skill；那些行仍仅 `createdBy` 本人可写。  
   - **Alternatives**：`application.properties` 白名单 — 本次不采用，避免配置漂移；可后续替换同一常量引用。

3. **确认协议（Agent 扩展 Skill）**  
   - 扩展工具当前为 **单字符串** `input`。采用与 `JavaSshTool` 类似的 **JSON 载荷** 约定：解析 `input` 为 JSON 时读取 `confirmed: true`；非 JSON 或缺省时视为未确认。  
   - 若 `requiresConfirmation && !confirmed`：返回 `JSON.stringify({ status: "CONFIRMATION_REQUIRED", summary, details, instruction })`，不调用网关执行接口。  
   - **Rationale**：最小改动、与现有 SSH 确认形状一致。  
   - **Alternatives**：改为 `DynamicStructuredTool` — 改动面大，可作为后续优化。

4. **OpenClaw 分支**  
   - 同样在入口判断 `requiresConfirmation`，未确认则不进入 planner 链。

## Risks / Trade-offs

- **[Risk]** 模型习惯单次自然语言调用，不理解需带 `confirmed` 的 JSON。  
  **→ Mitigation**：`CONFIRMATION_REQUIRED.instruction` 明确要求再次调用时在输入中附带 JSON `{"confirmed":true,...}` 或产品化文案。

- **[Risk]** 旧客户端依赖「任意用户可改公开 Skill」。  
  **→ Mitigation**：**BREAKING** 行为变更，在 proposal 已说明；协作者需由创建者账号操作或先复制 Skill。

- **[Risk]** `createdBy` 为空的历史行。  
  **→ Mitigation**：写操作拒绝（与找不到一致）；可选数据修复任务填充创建者。

## Migration Plan

1. 部署 SkillGateway 授权变更。  
2. 部署 Agent Core 确认逻辑。  
3. 部署前端按钮禁用。  
4. 回滚：恢复旧 `canWriteSkill` 与工具函数（不推荐长期保留）。

## Resolved decisions

- **管理员编辑 `createdBy=public` 行**：需要；管理员用户 ID 为 **`890728`**，在代码中定义为常量并与 `X-User-Id` 比较（字符串）。
