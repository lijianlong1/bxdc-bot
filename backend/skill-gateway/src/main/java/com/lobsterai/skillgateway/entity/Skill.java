package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

import com.lobsterai.skillgateway.util.StringUtils;

@TableName("skills")
public class Skill {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("name")
    private String name;

    @TableField("description")
    private String description;

    @TableField("type")
    private String type; // SSH, API, COMPUTE

    @TableField("configuration")
    private String configuration; // JSON string for configuration

    @TableField("execution_mode")
    private String executionMode = "CONFIG";

    @TableField("enabled")
    private boolean enabled = true;

    @TableField("requires_confirmation")
    private boolean requiresConfirmation = false;

    @TableField("visibility")
    private SkillVisibility visibility = SkillVisibility.PRIVATE;

    /** 展示用 emoji（与 User.avatar 一致为短字符串）；可选 */
    @TableField("avatar")
    private String avatar;

    /** 创建者用户 ID；平台种子/Built-in 对应行使用字面量 {@code public} */
    @TableField("created_by")
    private String createdBy;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    public Skill() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
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

    public String getExecutionMode() {
        return (executionMode == null || StringUtils.isBlank(executionMode)) ? "CONFIG" : executionMode;
    }

    public void setExecutionMode(String executionMode) {
        this.executionMode = executionMode;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isRequiresConfirmation() {
        return requiresConfirmation;
    }

    public void setRequiresConfirmation(boolean requiresConfirmation) {
        this.requiresConfirmation = requiresConfirmation;
    }

    public SkillVisibility getVisibility() {
        return visibility != null ? visibility : SkillVisibility.PUBLIC;
    }

    public void setVisibility(SkillVisibility visibility) {
        this.visibility = visibility;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
