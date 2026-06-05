package com.lobsterai.skillgateway.entity;

/**
 * 数据库 Skill 的可见范围：公共对全平台可见；私人仅创建者可见（列表/详情/Agent 均过滤）。
 */
public enum SkillVisibility {
    PUBLIC,
    PRIVATE
}
