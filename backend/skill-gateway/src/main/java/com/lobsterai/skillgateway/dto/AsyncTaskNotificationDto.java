package com.lobsterai.skillgateway.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.lobsterai.skillgateway.entity.AsyncTask;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 异步任务通知 DTO。
 * 用于通知中心列表展示，合并了 AsyncTask + skill.name + 进度统计。
 *
 * 时间字段一律按 UTC 序列化（pattern 末尾带 'Z' + timezone="UTC"），
 * 由前端 utils/datetime.ts 的 parseBackendTimeAsUtc 反序列化为本地时间显示。
 */
public class AsyncTaskNotificationDto {

    private Long id;
    private Long skillId;
    private String skillName;
    private String externalTaskId;
    private String sessionId;

    private String status;
    private String pollStrategy; // 'PERIODIC' | 'SINGLE_CALL' | null
    private Integer retryCount;
    private Long elapsedSeconds;
    private Integer pollResponseCount;

    private String errorMessage;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime startedAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime completedAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime notifiedAt;

    private boolean unread;
    private String previewResult;

    public static AsyncTaskNotificationDto from(AsyncTask t, String skillName, int pollResponseCount,
                                                Long elapsedSeconds, String previewResult) {
        AsyncTaskNotificationDto d = new AsyncTaskNotificationDto();
        d.id = t.getId();
        d.skillId = t.getSkillId();
        d.skillName = skillName;
        d.externalTaskId = t.getExternalTaskId();
        d.sessionId = t.getSessionId();
        d.status = t.getStatus();
        d.pollStrategy = t.getPollStrategy();
        d.retryCount = t.getPollRetryCount() == null ? 0 : t.getPollRetryCount();
        d.elapsedSeconds = elapsedSeconds;
        d.pollResponseCount = pollResponseCount;
        d.errorMessage = t.getErrorMessage();
        d.startedAt = t.getStartedAt();
        d.completedAt = t.getCompletedAt();
        d.createdAt = t.getCreatedAt();
        d.notifiedAt = t.getNotifiedAt();
        d.unread = t.getNotifiedAt() == null
                && Arrays.asList("COMPLETED", "FAILED", "TIMEOUT").contains(t.getStatus());
        d.previewResult = previewResult;
        return d;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getExternalTaskId() { return externalTaskId; }
    public void setExternalTaskId(String externalTaskId) { this.externalTaskId = externalTaskId; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPollStrategy() { return pollStrategy; }
    public void setPollStrategy(String pollStrategy) { this.pollStrategy = pollStrategy; }
    public Integer getRetryCount() { return retryCount; }
    public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }
    public Long getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(Long elapsedSeconds) { this.elapsedSeconds = elapsedSeconds; }
    public Integer getPollResponseCount() { return pollResponseCount; }
    public void setPollResponseCount(Integer pollResponseCount) { this.pollResponseCount = pollResponseCount; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getNotifiedAt() { return notifiedAt; }
    public void setNotifiedAt(LocalDateTime notifiedAt) { this.notifiedAt = notifiedAt; }
    public boolean isUnread() { return unread; }
    public void setUnread(boolean unread) { this.unread = unread; }
    public String getPreviewResult() { return previewResult; }
    public void setPreviewResult(String previewResult) { this.previewResult = previewResult; }
}
