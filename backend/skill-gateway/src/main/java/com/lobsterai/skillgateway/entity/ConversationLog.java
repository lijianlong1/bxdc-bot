package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 对话日志表 - 记录完整的对话信息，便于问题排查和日志分析
 */
@TableName("conversation_logs")
public class ConversationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private String userId;

    @TableField("session_id")
    private String sessionId;

    @TableField("trace_id")
    private String traceId;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;

    @TableField("response_duration_seconds")
    private Double responseDurationSeconds;

    @TableField("llm_rounds")
    private Integer llmRounds;

    @TableField("tool_call_rounds")
    private Integer toolCallRounds;

    @TableField("is_exceed_max_round")
    private Integer isExceedMaxRound;

    @TableField("is_success")
    private Integer isSuccess;

    @TableField("status")
    private String status;

    @TableField("finish_reason")
    private String finishReason;

    @TableField("llm_model")
    private String llmModel;

    @TableField("skill_name")
    private String skillName;

    @TableField("tool_name")
    private String toolName;

    @TableField("log_level")
    private String logLevel;

    @TableField("log_message")
    private String logMessage;

    @TableField("error_message")
    private String errorMessage;

    @TableField("error_stack_trace")
    private String errorStackTrace;

    @TableField("request_data")
    private String requestData;

    @TableField("response_data")
    private String responseData;

    @TableField("conversation_content")
    private String conversationContent;

    @TableField("total_tokens")
    private Integer totalTokens;

    @TableField("prompt_tokens")
    private Integer promptTokens;

    @TableField("completion_tokens")
    private Integer completionTokens;

    @TableField("agent_version")
    private String agentVersion;

    @TableField("environment")
    private String environment;

    public ConversationLog() {
    }

    // Getters and Setters
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

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
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

    public Double getResponseDurationSeconds() {
        return responseDurationSeconds;
    }

    public void setResponseDurationSeconds(Double responseDurationSeconds) {
        this.responseDurationSeconds = responseDurationSeconds;
    }

    public Integer getLlmRounds() {
        return llmRounds;
    }

    public void setLlmRounds(Integer llmRounds) {
        this.llmRounds = llmRounds;
    }

    public Integer getToolCallRounds() {
        return toolCallRounds;
    }

    public void setToolCallRounds(Integer toolCallRounds) {
        this.toolCallRounds = toolCallRounds;
    }

    public Integer getIsExceedMaxRound() {
        return isExceedMaxRound;
    }

    public void setIsExceedMaxRound(Integer isExceedMaxRound) {
        this.isExceedMaxRound = isExceedMaxRound;
    }

    public Integer getIsSuccess() {
        return isSuccess;
    }

    public void setIsSuccess(Integer isSuccess) {
        this.isSuccess = isSuccess;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getFinishReason() {
        return finishReason;
    }

    public void setFinishReason(String finishReason) {
        this.finishReason = finishReason;
    }

    public String getLlmModel() {
        return llmModel;
    }

    public void setLlmModel(String llmModel) {
        this.llmModel = llmModel;
    }

    public String getSkillName() {
        return skillName;
    }

    public void setSkillName(String skillName) {
        this.skillName = skillName;
    }

    public String getToolName() {
        return toolName;
    }

    public void setToolName(String toolName) {
        this.toolName = toolName;
    }

    public String getLogLevel() {
        return logLevel;
    }

    public void setLogLevel(String logLevel) {
        this.logLevel = logLevel;
    }

    public String getLogMessage() {
        return logMessage;
    }

    public void setLogMessage(String logMessage) {
        this.logMessage = logMessage;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getErrorStackTrace() {
        return errorStackTrace;
    }

    public void setErrorStackTrace(String errorStackTrace) {
        this.errorStackTrace = errorStackTrace;
    }

    public String getRequestData() {
        return requestData;
    }

    public void setRequestData(String requestData) {
        this.requestData = requestData;
    }

    public String getResponseData() {
        return responseData;
    }

    public void setResponseData(String responseData) {
        this.responseData = responseData;
    }

    public String getConversationContent() {
        return conversationContent;
    }

    public void setConversationContent(String conversationContent) {
        this.conversationContent = conversationContent;
    }

    public Integer getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(Integer totalTokens) {
        this.totalTokens = totalTokens;
    }

    public Integer getPromptTokens() {
        return promptTokens;
    }

    public void setPromptTokens(Integer promptTokens) {
        this.promptTokens = promptTokens;
    }

    public Integer getCompletionTokens() {
        return completionTokens;
    }

    public void setCompletionTokens(Integer completionTokens) {
        this.completionTokens = completionTokens;
    }

    public String getAgentVersion() {
        return agentVersion;
    }

    public void setAgentVersion(String agentVersion) {
        this.agentVersion = agentVersion;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }
}