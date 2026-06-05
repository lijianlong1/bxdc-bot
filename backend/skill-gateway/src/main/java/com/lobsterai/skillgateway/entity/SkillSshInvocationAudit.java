package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * Dedicated audit for SSH / linux-script style skill invocations (dual-written with legacy {@code gateway_outbound_audit_logs} SSH rows during transition).
 */
@TableName("skill_ssh_invocation_audit_logs")
public class SkillSshInvocationAudit {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("correlation_id")
    private String correlationId;

    @TableField("user_id")
    private String userId;

    @TableField("skill_id")
    private Long skillId;

    @TableField("recorded_at")
    private Instant recordedAt;

    @TableField("skill_context")
    private String skillContext;

    /** Raw agent request body JSON (sanitized: no private key/password plaintext). */
    @TableField("agent_request_json")
    private String agentRequestJson;

    @TableField("resolved_host")
    private String resolvedHost;

    @TableField("resolved_port")
    private Integer resolvedPort;

    @TableField("executed_command")
    private String executedCommand;

    @TableField("server_ledger_id")
    private Long serverLedgerId;

    @TableField("status")
    private String status;

    @TableField("error_message")
    private String errorMessage;

    @TableField("result_body")
    private String resultBody;

    @TableField("result_truncated")
    private boolean resultTruncated;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Long getSkillId() {
        return skillId;
    }

    public void setSkillId(Long skillId) {
        this.skillId = skillId;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getSkillContext() {
        return skillContext;
    }

    public void setSkillContext(String skillContext) {
        this.skillContext = skillContext;
    }

    public String getAgentRequestJson() {
        return agentRequestJson;
    }

    public void setAgentRequestJson(String agentRequestJson) {
        this.agentRequestJson = agentRequestJson;
    }

    public String getResolvedHost() {
        return resolvedHost;
    }

    public void setResolvedHost(String resolvedHost) {
        this.resolvedHost = resolvedHost;
    }

    public Integer getResolvedPort() {
        return resolvedPort;
    }

    public void setResolvedPort(Integer resolvedPort) {
        this.resolvedPort = resolvedPort;
    }

    public String getExecutedCommand() {
        return executedCommand;
    }

    public void setExecutedCommand(String executedCommand) {
        this.executedCommand = executedCommand;
    }

    public Long getServerLedgerId() {
        return serverLedgerId;
    }

    public void setServerLedgerId(Long serverLedgerId) {
        this.serverLedgerId = serverLedgerId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getResultBody() {
        return resultBody;
    }

    public void setResultBody(String resultBody) {
        this.resultBody = resultBody;
    }

    public boolean isResultTruncated() {
        return resultTruncated;
    }

    public void setResultTruncated(boolean resultTruncated) {
        this.resultTruncated = resultTruncated;
    }
}
