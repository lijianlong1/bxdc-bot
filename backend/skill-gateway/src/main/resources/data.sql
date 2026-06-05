-- skill-gateway: schema is created by Hibernate (ddl-auto=update), then this script runs (defer-datasource-initialization).
--
-- Persisted `skills` rows are user-created extended skills (type=EXTENSION) and any legacy primitive rows.
-- Platform "built-in" capabilities (API / Compute / SSH / skill generator) are exposed in the frontend as virtual
-- entries (BUILTIN), not as rows here.
--
-- Do NOT run UPDATE on visibility/created_by at the top of this file: on first boot those columns may not exist yet
-- when this script is parsed, or Hibernate may not have applied ddl-auto.

-- 系统 Built-in Skill（独立表 system_skills；与扩展 skills 表分离）
INSERT IGNORE INTO system_skills (tool_name, description, kind, configuration, enabled, schema_version)
VALUES
  ('api_caller',
   'Calls an external API via the Java gateway (url, method, headers, body).',
   'API_PROXY',
   NULL,
   TRUE,
   1),
  ('compute',
   'Math and date operations via Skill Gateway (operation, operands).',
   'COMPUTE',
   NULL,
   TRUE,
   1),
  ('ssh_executor',
   'Executes a shell command on a remote server via SSH (host, port, username, command, privateKey or password).',
   'SSH_EXECUTOR',
   NULL,
   TRUE,
   1);

-- Legacy cleanup: API skills whose configuration is incompatible with the structured editor
DELETE FROM skills WHERE name IN ('获取时间', '获取笑话列表', 'API时间验证技能', '查询当日新闻');
