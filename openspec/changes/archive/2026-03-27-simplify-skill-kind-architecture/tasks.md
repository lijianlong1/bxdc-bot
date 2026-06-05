## 1. Canonical kind model and compatibility

- [x] 1.1 Define canonical CONFIG skill schema in `backend/skill-gateway` (`kind` only supports `api`/`ssh`, plus preset/profile field semantics).
- [x] 1.2 Implement backward-compatible parsing/mapping for legacy `kind=time` and `kind=monitor` skills during read/execute path.
- [x] 1.3 Add migration write-path logic so edited/newly saved skills persist as canonical `api`/`ssh` kind with preset/profile metadata.

## 2. Generator and execution alignment

- [x] 2.1 Update `JavaSkillGeneratorTool` generation strategy to output canonical `kind=api` or `kind=ssh` for CONFIG-mode skills.
- [x] 2.2 Encode existing “time query” and “server monitor” intents as preset/profile values under canonical kinds.
- [x] 2.3 Update agent-core runtime dispatch logic to resolve behavior from canonical kind + preset/profile and keep legacy behavior compatible.

## 3. Skill Hub and editor UX updates

- [x] 3.1 Update frontend skill list and detail display to show canonical base kind (`api`/`ssh`) and optional preset/profile labels.
- [x] 3.2 Update skill management editor labels/help text to describe “基础类型 + 预配置模板” instead of legacy standalone kinds.
- [x] 3.3 Ensure built-in skill cards and generated-skill previews use the canonical model consistently.

## 4. Verification and rollout

- [x] 4.1 Add/adjust backend tests for canonical kind validation and legacy compatibility mapping.
- [x] 4.2 Add/adjust agent-core tests for generator output and runtime behavior under canonical + legacy configs.
- [x] 4.3 Add/adjust frontend tests (or manual verification checklist) for new kind/preset display and editing flow.
- [x] 4.4 Document migration/rollback steps and compatibility window in project docs.
