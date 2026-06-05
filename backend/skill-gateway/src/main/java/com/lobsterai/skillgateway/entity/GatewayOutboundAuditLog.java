package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

@TableName("gateway_outbound_audit_logs")
public class GatewayOutboundAuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("correlation_id")
    private String correlationId;

    @TableField("user_id")
    private String userId;

    @TableField("recorded_at")
    private Instant recordedAt;

    /** HTTP or SSH */
    @TableField("outbound_kind")
    private String outboundKind;

    @TableField("status")
    private String status;

    @TableField("error_message")
    private String errorMessage;

    @TableField("destination")
    private String destination;

    @TableField("http_method")
    private String httpMethod;

    @TableField("origin_incomplete")
    private boolean originIncomplete;

    @TableField("origin_headers_json")
    private String originHeadersJson;

    @TableField("origin_body")
    private byte[] originBody;

    @TableField("origin_truncated")
    private boolean originTruncated;

    @TableField("origin_sha256")
    private String originSha256;

    @TableField("outbound_headers_json")
    private String outboundHeadersJson;

    @TableField("outbound_body")
    private byte[] outboundBody;

    @TableField("outbound_truncated")
    private boolean outboundTruncated;

    @TableField("outbound_sha256")
    private String outboundSha256;

    @TableField("ssh_command")
    private String sshCommand;

    @TableField("skill_context")
    private String skillContext;

    /** {@code skills.id} when {@code X-Skill-Id} present (extension skill). */
    @TableField("skill_id")
    private Long skillId;

    /**
     * Sanitized JSON of agent's proxy intent ({@code ApiRequest} body) for {@code POST /api/skills/api}.
     */
    @TableField("proxy_request_json")
    private String proxyRequestJson;

    @TableField("outbound_response_status")
    private Integer outboundResponseStatus;

    @TableField("outbound_response_headers_json")
    private String outboundResponseHeadersJson;

    @TableField("outbound_response_body")
    private byte[] outboundResponseBody;

    @TableField("outbound_response_truncated")
    private boolean outboundResponseTruncated;

    @TableField("outbound_response_sha256")
    private String outboundResponseSha256;

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

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getOutboundKind() {
        return outboundKind;
    }

    public void setOutboundKind(String outboundKind) {
        this.outboundKind = outboundKind;
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

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public String getHttpMethod() {
        return httpMethod;
    }

    public void setHttpMethod(String httpMethod) {
        this.httpMethod = httpMethod;
    }

    public boolean isOriginIncomplete() {
        return originIncomplete;
    }

    public void setOriginIncomplete(boolean originIncomplete) {
        this.originIncomplete = originIncomplete;
    }

    public String getOriginHeadersJson() {
        return originHeadersJson;
    }

    public void setOriginHeadersJson(String originHeadersJson) {
        this.originHeadersJson = originHeadersJson;
    }

    public byte[] getOriginBody() {
        return originBody;
    }

    public void setOriginBody(byte[] originBody) {
        this.originBody = originBody;
    }

    public boolean isOriginTruncated() {
        return originTruncated;
    }

    public void setOriginTruncated(boolean originTruncated) {
        this.originTruncated = originTruncated;
    }

    public String getOriginSha256() {
        return originSha256;
    }

    public void setOriginSha256(String originSha256) {
        this.originSha256 = originSha256;
    }

    public String getOutboundHeadersJson() {
        return outboundHeadersJson;
    }

    public void setOutboundHeadersJson(String outboundHeadersJson) {
        this.outboundHeadersJson = outboundHeadersJson;
    }

    public byte[] getOutboundBody() {
        return outboundBody;
    }

    public void setOutboundBody(byte[] outboundBody) {
        this.outboundBody = outboundBody;
    }

    public boolean isOutboundTruncated() {
        return outboundTruncated;
    }

    public void setOutboundTruncated(boolean outboundTruncated) {
        this.outboundTruncated = outboundTruncated;
    }

    public String getOutboundSha256() {
        return outboundSha256;
    }

    public void setOutboundSha256(String outboundSha256) {
        this.outboundSha256 = outboundSha256;
    }

    public String getSshCommand() {
        return sshCommand;
    }

    public void setSshCommand(String sshCommand) {
        this.sshCommand = sshCommand;
    }

    public String getSkillContext() {
        return skillContext;
    }

    public void setSkillContext(String skillContext) {
        this.skillContext = skillContext;
    }

    public Long getSkillId() {
        return skillId;
    }

    public void setSkillId(Long skillId) {
        this.skillId = skillId;
    }

    public String getProxyRequestJson() {
        return proxyRequestJson;
    }

    public void setProxyRequestJson(String proxyRequestJson) {
        this.proxyRequestJson = proxyRequestJson;
    }

    public Integer getOutboundResponseStatus() {
        return outboundResponseStatus;
    }

    public void setOutboundResponseStatus(Integer outboundResponseStatus) {
        this.outboundResponseStatus = outboundResponseStatus;
    }

    public String getOutboundResponseHeadersJson() {
        return outboundResponseHeadersJson;
    }

    public void setOutboundResponseHeadersJson(String outboundResponseHeadersJson) {
        this.outboundResponseHeadersJson = outboundResponseHeadersJson;
    }

    public byte[] getOutboundResponseBody() {
        return outboundResponseBody;
    }

    public void setOutboundResponseBody(byte[] outboundResponseBody) {
        this.outboundResponseBody = outboundResponseBody;
    }

    public boolean isOutboundResponseTruncated() {
        return outboundResponseTruncated;
    }

    public void setOutboundResponseTruncated(boolean outboundResponseTruncated) {
        this.outboundResponseTruncated = outboundResponseTruncated;
    }

    public String getOutboundResponseSha256() {
        return outboundResponseSha256;
    }

    public void setOutboundResponseSha256(String outboundResponseSha256) {
        this.outboundResponseSha256 = outboundResponseSha256;
    }
}
