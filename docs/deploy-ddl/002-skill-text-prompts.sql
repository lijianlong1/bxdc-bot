-- ============================================================
-- AI 文本优化提示词配置表
-- 部署日期: 2026-05-14
-- 对应 spec: ai-text-optimize
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_text_prompts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    field_id VARCHAR(64) NOT NULL UNIQUE,
    field_label VARCHAR(128),
    system_prompt TEXT,
    user_prompt_template TEXT,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
