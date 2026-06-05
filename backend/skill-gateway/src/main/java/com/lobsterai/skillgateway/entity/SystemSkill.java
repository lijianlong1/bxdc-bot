package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 平台系统级 Built-in Skill（与 {@code skills} 扩展表分离）。
 */
@TableName("system_skills")
public class SystemSkill {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 与 agent 工具名一致，如 api_caller、compute、ssh_executor */
    @TableField("tool_name")
    private String toolName;

    @TableField("description")
    private String description;

    /**
     * 执行分类：API_PROXY、COMPUTE、SSH_EXECUTOR（与 {@link com.lobsterai.skillgateway.service.SystemSkillService} 对齐）。
     */
    @TableField("kind")
    private String kind;

    /** 可选 JSON，预留扩展 */
    @TableField("configuration")
    private String configuration;

    @TableField("enabled")
    private boolean enabled = true;

    @TableField("schema_version")
    private int schemaVersion = 1;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    public SystemSkill() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getToolName() {
        return toolName;
    }

    public void setToolName(String toolName) {
        this.toolName = toolName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getConfiguration() {
        return configuration;
    }

    public void setConfiguration(String configuration) {
        this.configuration = configuration;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(int schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
