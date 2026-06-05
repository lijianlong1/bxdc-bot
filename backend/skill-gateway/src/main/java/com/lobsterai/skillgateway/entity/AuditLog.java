package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 审计日志实体。
 * <p>
 * 映射到数据库中的 audit_logs 表，存储 Skill 执行的详细记录。
 * </p>
 */
@TableName("audit_logs")
public class AuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 调用 Skill 的 Agent ID。
     */
    @TableField("agent_id")
    private String agentId;

    /**
     * 调用的 Skill 名称 (如 SSH, API)。
     */
    @TableField("skill_name")
    private String skillName;

    /**
     * 执行的具体命令或 URL。
     */
    @TableField("command_or_url")
    private String commandOrUrl;
    
    /**
     * 执行参数 (如主机名、HTTP 方法)。
     */
    @TableField("params")
    private String params;
    
    /**
     * 执行结果状态 (SUCCESS, FAILURE)。
     */
    @TableField("status")
    private String status;

    /**
     * 记录生成的时间戳。
     */
    @TableField("timestamp")
    private LocalDateTime timestamp;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getCommandOrUrl() { return commandOrUrl; }
    public void setCommandOrUrl(String commandOrUrl) { this.commandOrUrl = commandOrUrl; }
    public String getParams() { return params; }
    public void setParams(String params) { this.params = params; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
