package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.AsyncTask;
import com.lobsterai.skillgateway.entity.User;
import com.lobsterai.skillgateway.orchestration.AgentStreamConsumer;
import com.lobsterai.skillgateway.service.AsyncPollingAuditService;
import com.lobsterai.skillgateway.service.AsyncTaskPollingService;
import com.lobsterai.skillgateway.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    private final AgentStreamConsumer agentStreamConsumer;
    private final UserService userService;
    private final AsyncTaskPollingService asyncTaskPollingService;
    private final AsyncPollingAuditService asyncPollingAuditService;
    // In-memory storage for task instructions. In production, use a database or cache.
    private final Map<String, TaskContext> taskContexts = new ConcurrentHashMap<>();
    // Store active subscriptions to cancel them if needed
    private final Map<String, Disposable> activeSubscriptions = new ConcurrentHashMap<>();

    public TaskController(AgentStreamConsumer agentStreamConsumer, UserService userService,
                          AsyncTaskPollingService asyncTaskPollingService,
                          AsyncPollingAuditService asyncPollingAuditService) {
        this.agentStreamConsumer = agentStreamConsumer;
        this.userService = userService;
        this.asyncTaskPollingService = asyncTaskPollingService;
        this.asyncPollingAuditService = asyncPollingAuditService;
    }

    @PostMapping
    public ResponseEntity<CreateTaskResponse> createTask(@RequestBody CreateTaskRequest request) {
        // 如果请求中提供了 sessionId，则使用它；否则生成新的 UUID
        String taskId = (request.getSessionId() != null && !request.getSessionId().isEmpty()) 
            ? request.getSessionId() 
            : UUID.randomUUID().toString();
        taskContexts.put(taskId, new TaskContext(request.getContent(), request.getUserId(), request.getHistory()));
        return ResponseEntity.ok(new CreateTaskResponse(taskId));
    }

    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamTaskEvents(@PathVariable String id) {
        TaskContext context = taskContexts.get(id);
        if (context == null) {
            SseEmitter emitter = new SseEmitter(0L); 
            try {
                emitter.send(SseEmitter.event().name("error").data("Task not found"));
                emitter.complete();
            } catch (IOException e) {
                // ignore
            }
            return emitter;
        }

        SseEmitter emitter = new SseEmitter(0L); // No timeout
        
        // Heartbeat: every 30s push polling_status (or empty comment) for keepalive + frontend display
        ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor();
        ScheduledFuture<?> heartbeat = heartbeatExecutor.scheduleAtFixedRate(() -> {
            try {
                java.util.List<AsyncTask> tasks = asyncTaskPollingService.findActiveBySessionId(id);
                if (!tasks.isEmpty()) {
                    java.util.List<Map<String, Object>> taskList = new java.util.ArrayList<>();
                    for (AsyncTask t : tasks) {
                        Map<String, Object> info = new LinkedHashMap<>();
                        info.put("asyncTaskId", t.getId());
                        info.put("externalTaskId", t.getExternalTaskId());
                        info.put("status", t.getStatus());
                        info.put("retryCount", t.getPollRetryCount() != null ? t.getPollRetryCount() : 0);
                        long elapsed = 0;
                        if (t.getStartedAt() != null) {
                            elapsed = ChronoUnit.SECONDS.between(t.getStartedAt(), LocalDateTime.now());
                        }
                        info.put("elapsedSeconds", elapsed);
                        info.put("pollResponses", asyncPollingAuditService.getNetworkResponses(t.getId(), 500));
                        taskList.add(info);
                    }
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("type", "polling_status");
                    body.put("tasks", taskList);
                    emitter.send(SseEmitter.event().name("polling_status").data(body));
                } else {
                    emitter.send(SseEmitter.event().comment(""));
                }
            } catch (IOException ignored) {
                // emitter already closed
            }
        }, 30, 30, TimeUnit.SECONDS);
        
        Map<String, Object> executionContext = new HashMap<>();
        if (context.getUserId() != null) {
            executionContext.put("userId", context.getUserId());
            User u = userService.getUser(context.getUserId());
            if (u != null) {
                userService.userLlmOverridesFromDb(u).forEach(executionContext::put);
            }
        }
        executionContext.put("sessionId", id);

        Disposable subscription = agentStreamConsumer.executeAndStream(context.getContent(), executionContext, context.getHistory())
            .subscribe(
                data -> {
                    try {
                        emitter.send(SseEmitter.event().data(data));
                    } catch (IOException e) {
                        emitter.completeWithError(e);
                    }
                },
                error -> {
                    try {
                        emitter.send(SseEmitter.event().name("error").data(error.getMessage()));
                        emitter.completeWithError(error);
                    } catch (IOException e) {
                        // ignore
                    }
                    heartbeat.cancel(true);
                    heartbeatExecutor.shutdown();
                    activeSubscriptions.remove(id);
                },
                () -> {
                    try {
                        emitter.send(SseEmitter.event().name("complete").data(""));
                    } catch (IOException e) {
                        // ignore
                    }
                    heartbeat.cancel(true);
                    heartbeatExecutor.shutdown();
                    emitter.complete();
                    activeSubscriptions.remove(id);
                }
            );

        activeSubscriptions.put(id, subscription);
        
        emitter.onCompletion(() -> {
            heartbeat.cancel(true);
            heartbeatExecutor.shutdown();
            Disposable s = activeSubscriptions.remove(id);
            if (s != null && !s.isDisposed()) {
                s.dispose();
            }
        });
        
        emitter.onTimeout(() -> {
            heartbeat.cancel(true);
            heartbeatExecutor.shutdown();
            emitter.complete();
            Disposable s = activeSubscriptions.remove(id);
            if (s != null && !s.isDisposed()) {
                s.dispose();
            }
        });

        return emitter;
    }

    public static class CreateTaskRequest {
        private String content;
        private String userId;
        private java.util.List<Map<String, Object>> history;
        private String sessionId;

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public java.util.List<Map<String, Object>> getHistory() {
            return history;
        }

        public void setHistory(java.util.List<Map<String, Object>> history) {
            this.history = history;
        }

        public String getSessionId() {
            return sessionId;
        }

        public void setSessionId(String sessionId) {
            this.sessionId = sessionId;
        }
    }

    public static class CreateTaskResponse {
        private String id;

        public CreateTaskResponse(String id) {
            this.id = id;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }

    private static class TaskContext {
        private final String content;
        private final String userId;
        private final java.util.List<Map<String, Object>> history;

        public TaskContext(String content, String userId, java.util.List<Map<String, Object>> history) {
            this.content = content;
            this.userId = userId;
            this.history = history;
        }

        public String getContent() {
            return content;
        }

        public String getUserId() {
            return userId;
        }

        public java.util.List<Map<String, Object>> getHistory() {
            return history;
        }
    }
}
