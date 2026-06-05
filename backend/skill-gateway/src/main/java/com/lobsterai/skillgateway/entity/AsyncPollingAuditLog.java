package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("async_polling_audit_logs")
public class AsyncPollingAuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("async_task_id")
    private Long asyncTaskId;

    @TableField("skill_id")
    private Long skillId;

    @TableField("user_id")
    private String userId;

    @TableField("session_id")
    private String sessionId;

    @TableField("phase")
    private String phase;

    @TableField("recorded_at")
    private LocalDateTime recordedAt;

    @TableField("duration_ms")
    private Integer durationMs;

    @TableField("http_method")
    private String httpMethod;

    @TableField("http_url")
    private String httpUrl;

    @TableField("http_status_code")
    private Integer httpStatusCode;

    @TableField("request_headers_json")
    private String requestHeadersJson;

    @TableField("request_body")
    private String requestBody;

    @TableField("response_body")
    private String responseBody;

    @TableField("response_truncated")
    private Boolean responseTruncated;

    @TableField("completion_evaluated")
    private Boolean completionEvaluated;

    @TableField("completion_expected_value")
    private String completionExpectedValue;

    @TableField("completion_actual_value")
    private String completionActualValue;

    @TableField("completion_matched")
    private Boolean completionMatched;

    @TableField("failed_evaluated")
    private Boolean failedEvaluated;

    @TableField("failed_matched")
    private Boolean failedMatched;

    @TableField("expired_evaluated")
    private Boolean expiredEvaluated;

    @TableField("expired")
    private Boolean expired;

    @TableField("status")
    private String status;

    @TableField("error_message")
    private String errorMessage;

    @TableField("error_stack")
    private String errorStack;

    @TableField("extra_json")
    private String extraJson;

    public AsyncPollingAuditLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAsyncTaskId() { return asyncTaskId; }
    public void setAsyncTaskId(Long asyncTaskId) { this.asyncTaskId = asyncTaskId; }

    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }

    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }

    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }

    public String getHttpUrl() { return httpUrl; }
    public void setHttpUrl(String httpUrl) { this.httpUrl = httpUrl; }

    public Integer getHttpStatusCode() { return httpStatusCode; }
    public void setHttpStatusCode(Integer httpStatusCode) { this.httpStatusCode = httpStatusCode; }

    public String getRequestHeadersJson() { return requestHeadersJson; }
    public void setRequestHeadersJson(String requestHeadersJson) { this.requestHeadersJson = requestHeadersJson; }

    public String getRequestBody() { return requestBody; }
    public void setRequestBody(String requestBody) { this.requestBody = requestBody; }

    public String getResponseBody() { return responseBody; }
    public void setResponseBody(String responseBody) { this.responseBody = responseBody; }

    public Boolean getResponseTruncated() { return responseTruncated; }
    public void setResponseTruncated(Boolean responseTruncated) { this.responseTruncated = responseTruncated; }

    public Boolean getCompletionEvaluated() { return completionEvaluated; }
    public void setCompletionEvaluated(Boolean completionEvaluated) { this.completionEvaluated = completionEvaluated; }

    public String getCompletionExpectedValue() { return completionExpectedValue; }
    public void setCompletionExpectedValue(String completionExpectedValue) { this.completionExpectedValue = completionExpectedValue; }

    public String getCompletionActualValue() { return completionActualValue; }
    public void setCompletionActualValue(String completionActualValue) { this.completionActualValue = completionActualValue; }

    public Boolean getCompletionMatched() { return completionMatched; }
    public void setCompletionMatched(Boolean completionMatched) { this.completionMatched = completionMatched; }

    public Boolean getFailedEvaluated() { return failedEvaluated; }
    public void setFailedEvaluated(Boolean failedEvaluated) { this.failedEvaluated = failedEvaluated; }

    public Boolean getFailedMatched() { return failedMatched; }
    public void setFailedMatched(Boolean failedMatched) { this.failedMatched = failedMatched; }

    public Boolean getExpiredEvaluated() { return expiredEvaluated; }
    public void setExpiredEvaluated(Boolean expiredEvaluated) { this.expiredEvaluated = expiredEvaluated; }

    public Boolean getExpired() { return expired; }
    public void setExpired(Boolean expired) { this.expired = expired; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getErrorStack() { return errorStack; }
    public void setErrorStack(String errorStack) { this.errorStack = errorStack; }

    public String getExtraJson() { return extraJson; }
    public void setExtraJson(String extraJson) { this.extraJson = extraJson; }
}
