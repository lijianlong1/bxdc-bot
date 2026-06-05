package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * LLM 出站 HTTP 原始审计（由 agent-core 经本网关落库，agent-core 不直连数据库）。
 */
@TableName("llm_http_audit_logs")
public class LlmHttpAuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 业务用户 ID（来自 agent 上报；可为空） */
    @TableField("user_id")
    private String userId;

    @TableField("session_id")
    private String sessionId;

    @TableField("correlation_id")
    private String correlationId;

    @TableField("direction")
    private String direction;

    /** 服务端落库时间（权威） */
    @TableField("recorded_at")
    private Instant recordedAt;

    /** 完整事件 JSON（与 agent 侧 llmOrg 记录结构一致，便于对照） */
    @TableField("payload_json")
    private String payloadJson;

    public LlmHttpAuditLog() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }
}
