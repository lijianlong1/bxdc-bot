## Why

在排查参数缺失或变形时，运维需要端到端追踪 Skill 执行链路：当前 gateway 侧记录不完整或由对象拼接还原，无法证明实际从 gateway 发出的是什么（HTTP 与 SSH），也难以与 agent-core 的**原始**调用负载对齐。需要在数据库中建立统一、保真的审计轨迹，既覆盖对外工具流量，也覆盖会回调 agent-core 的 Skill。

## What Changes

- **对外请求审计（API + SSH）**：将 skill-gateway 发出的每一次对外请求持久化到**同一张**关系表中。每行记录实际操作**用户**、**时间戳**、目标**地址或主机**（URL 或 SSH 端点），以及**高保真出站内容**：HTTP 为实际链路上送出的表示（或对 headers + body 按发送侧的字节级捕获）；SSH 为**实际执行**的完整命令字符串，而非由字段拼回的摘要。行数据必须关联或内嵌 **agent-core 原始入站请求**（gateway 从 agent-core 收到的 inbound payload），以便对比「到了 gateway 的是什么」与「gateway 发出的是什么」。
- **agent-core Skill 调用审计**：对执行路径中会调用 **agent-core** 的 Skill，经 skill-gateway 落库：**用户**、**时间**、**Skill 名称**、**传入 Skill 的参数**、**Skill 结果**（成功负载或结构化错误），供支持与回归分析。
- **不以「美化拼接」为真相来源**：存储内容在可行范围内必须是真实报文/流的副本；任何脱敏（secrets）必须在 design/spec 中显式约定，且不得在缺乏单独策略的情况下静默用占位符替换字节——默认按发送/接收原样存储，除非合规另有要求。

## Capabilities

### New Capabilities

- `gateway-outbound-request-audit`：skill-gateway **对外** API 与 SSH 动作的统一库表持久化，含用户、时间、目标、完整出站捕获，并与 **agent-core 原始请求**关联，用于参数丢失类问题排障。
- `gateway-agent-core-skill-audit`：经 skill-gateway 将**调用 agent-core** 的 Skill  invocation 持久化到数据库，含用户、时间戳、Skill 标识、入参及调用结果/response body。

### Modified Capabilities

- **无** — 既有 OpenSpec capability 的**行为契约**不变；本变更新增审计面。实现上可重构或扩展现有 `audit_logs` / Aspect，但不改变无关 spec 要求。

## Impact

- **后端**：`backend/skill-gateway` — 新增或扩展 JPA 实体、migration/schema、Repository、Service、Filter/Interceptor 或 HTTP client 包装、SSH 执行挂钩；若需 agent-core 额外 POST 关联负载则可能有 internal endpoint。可能与 `backend/agent-core` 协调，在 gateway 入站侧传递或标注**原始**请求信封（headers/body）。
- **数据库**：新表或表结构变更；按时间/用户/Skill/correlation id 建索引；大负载的体量与保留策略。
- **运维**：存储增长、PII/secrets 处理、支持侧查询模式。
- **API**：若现有 Skill 调用路径上尚无关联数据，可能新增或扩展仅内部的 correlation 接收能力。
