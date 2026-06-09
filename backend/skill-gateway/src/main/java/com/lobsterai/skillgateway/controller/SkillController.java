package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.Skill;
import com.lobsterai.skillgateway.service.AsyncTaskPollingService;
import com.lobsterai.skillgateway.service.BuiltinToolExecutionService;
import com.lobsterai.skillgateway.service.GatewayOutboundAuditService;
import com.lobsterai.skillgateway.service.LinuxScriptExecutionService;
import com.lobsterai.skillgateway.service.ServerLedgerService;
import com.lobsterai.skillgateway.service.SkillService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.lobsterai.skillgateway.config.DedupConfig;
import com.lobsterai.skillgateway.entity.AsyncTask;
import com.lobsterai.skillgateway.entity.AsyncPollingAuditLog;
import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.entity.SkillTextPrompt;
import com.lobsterai.skillgateway.mapper.SkillTextPromptMapper;
import com.lobsterai.skillgateway.service.ApiProxyService;
import com.lobsterai.skillgateway.service.AsyncPollingAuditService;
import com.lobsterai.skillgateway.service.SkillExecutionService;
import com.lobsterai.skillgateway.util.JsonPathUtils;
import com.lobsterai.skillgateway.util.RequestSignatureUtil;
import com.lobsterai.skillgateway.util.StringUtils;

/**
 * Skill 控制器。
 * <p>
 * 暴露 RESTful 接口供 Agent Core 调用，以执行具体的 SSH 命令或 API 请求。
 * 包含安全检查逻辑。
 * 此外，提供 Skill 的统一管理（CRUD）。
 * </p>
 */
@RestController
@RequestMapping("/api/skills")
public class SkillController {

    private final SkillService skillService;
    private final LinuxScriptExecutionService linuxScriptExecutionService;
    private final ServerLedgerService serverLedgerService;
    private final BuiltinToolExecutionService builtinToolExecutionService;
    private final GatewayOutboundAuditService gatewayOutboundAuditService;
    private final AsyncTaskPollingService asyncTaskPollingService;
    private final SkillTextPromptMapper skillTextPromptMapper;
    private final ApiProxyService apiProxyService;
    private final AsyncPollingAuditService pollingAuditService;
    private final ObjectMapper objectMapper;

    private final SkillExecutionService skillExecutionService;

    public SkillController(
            SkillService skillService,
            LinuxScriptExecutionService linuxScriptExecutionService,
            ServerLedgerService serverLedgerService,
            BuiltinToolExecutionService builtinToolExecutionService,
            GatewayOutboundAuditService gatewayOutboundAuditService,
            AsyncTaskPollingService asyncTaskPollingService,
            SkillTextPromptMapper skillTextPromptMapper,
            ApiProxyService apiProxyService,
            AsyncPollingAuditService pollingAuditService,
            ObjectMapper objectMapper,
            SkillExecutionService skillExecutionService
    ) {
        this.skillService = skillService;
        this.linuxScriptExecutionService = linuxScriptExecutionService;
        this.serverLedgerService = serverLedgerService;
        this.builtinToolExecutionService = builtinToolExecutionService;
        this.gatewayOutboundAuditService = gatewayOutboundAuditService;
        this.asyncTaskPollingService = asyncTaskPollingService;
        this.skillTextPromptMapper = skillTextPromptMapper;
        this.apiProxyService = apiProxyService;
        this.pollingAuditService = pollingAuditService;
        this.objectMapper = objectMapper;
        this.skillExecutionService = skillExecutionService;
    }

    // --- Skill Management (CRUD) ---

    @GetMapping
    public List<Skill> getAllSkills(
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        return skillService.listSkillsForUser(userId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Skill> getSkillById(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        return skillService.getSkillByIdForUser(id, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createSkill(
            @RequestBody Skill skill,
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        try {
            return ResponseEntity.ok(skillService.createSkill(skill, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSkill(
            @PathVariable Long id,
            @RequestBody Skill skillDetails,
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        try {
            return ResponseEntity.ok(skillService.updateSkill(id, skillDetails, userId));
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("Skill not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSkill(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        try {
            skillService.deleteSkill(id, userId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/server-lookup")
    public ResponseEntity<?> lookupServer(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestParam(value = "serverName", required = false) String serverName,
            @RequestParam(value = "name", required = false) String name
    ) {
        if (userId == null || StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "X-User-Id header is required for server lookup"));
        }
        String q = (serverName != null && !StringUtils.isBlank(serverName)) ? serverName : name;
        if (q == null || StringUtils.isBlank(q)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "serverName (or legacy name) query parameter is required"));
        }
        List<ServerLedgerService.ServerNameCandidate> candidates = serverLedgerService.findTopServerNameMatches(userId, q, 5);
        List<Map<String, Object>> list = new java.util.ArrayList<>();
        for (ServerLedgerService.ServerNameCandidate c : candidates) {
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("id", c.id());
            row.put("name", c.name());
            list.add(row);
        }
        int n = list.size();
        return ResponseEntity.ok(new HashMap<String, Object>() {{
            put("candidates", list);
            put("count", n);
            put("needsUserConfirmation", n > 1);
        }});
    }

    // --- Unified Skill Execution ---

    @PostMapping("/execute")
    public ResponseEntity<?> executeSkill(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @RequestBody Map<String, Object> body
    ) {
        try {
            SkillExecutionService.ExecuteRequest req = new SkillExecutionService.ExecuteRequest();
            req.skillId = body.get("skillId") instanceof Number ? ((Number) body.get("skillId")).longValue() : null;
            req.parameters = body.get("parameters");
            req.confirmed = Boolean.TRUE.equals(body.get("confirmed"));
            req.requestId = (String) body.get("requestId");
            req.adjustedParams = body.get("adjustedParams");
            req.userId = userId;
            req.sessionId = sessionId;

            Object result = skillExecutionService.execute(req);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Collections.singletonMap("error", "Skill execution failed: " + e.getMessage()));
        }
    }

    // --- Skill Execution ---

    /**
     * 提交异步 API 任务（fire-and-forget）。
     *
     * agent-core 调用此 endpoint 提交 SINGLE_CALL / PERIODIC 任务，立即返回
     * {asyncTaskId, status: PENDING, externalTaskId, pollStrategy, deduped}。
     * 不阻塞 LLM，后台轮询由 AsyncTaskPollingScheduler 接管。
     *
     * 关键设计：
     * - 提交前先按 session 维度去重（RequestSignatureUtil SHA-256 + DedupConfig 60s/3600s 窗口）
     * - SINGLE_CALL：把原始 body 存入 requestBody，scheduler 长 readTimeout 调用
     * - PERIODIC：先同步调第三方拿到 externalTaskId，再入库
     */
    @PostMapping("/api/async")
    public ResponseEntity<?> callApiAsync(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Skill-Id", required = false) Long skillId,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @RequestBody ApiRequest request
    ) {
        try {
            Map<String, Object> asyncPoll = request.getAsyncPoll();
            if (asyncPoll == null) {
                return ResponseEntity.badRequest().body(Collections.singletonMap("error", "asyncPoll is required for async API calls"));
            }

            // 读取 pollStrategy，决定后续流程分支
            String pollStrategy = asyncPoll.get("pollStrategy") instanceof String
                    ? (String) asyncPoll.get("pollStrategy") : "PERIODIC";
            boolean singleCallMode = "SINGLE_CALL".equals(pollStrategy);
            Integer singleCallReadTimeoutSeconds = asyncPoll.get("singleCallReadTimeoutSeconds") instanceof Number
                    ? ((Number) asyncPoll.get("singleCallReadTimeoutSeconds")).intValue() : null;

            // ====== 步骤 1：参数解析（前置，以便去重也能拿到这些字段）======
            String idJsonPath = (String) asyncPoll.get("idJsonPath");
            String pollMethod = asyncPoll.get("pollMethod") instanceof String ? (String) asyncPoll.get("pollMethod") : "GET";
            String pollEndpointTemplate = (String) asyncPoll.get("pollEndpoint");

            if (singleCallMode) {
                // SINGLE_CALL：pollEndpoint 可省略；省略时 fallback 到请求 URL
                if (pollEndpointTemplate == null || pollEndpointTemplate.trim().isEmpty()) {
                    pollEndpointTemplate = request.getUrl();
                }
            } else {
                // PERIODIC：pollEndpoint 必填，且必须含 {id}
                if (pollEndpointTemplate == null || !pollEndpointTemplate.contains("{id}")) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "asyncPoll.pollEndpoint is required and must contain {id} placeholder for PERIODIC mode");
                    err.put("hint", "Use pollStrategy: SINGLE_CALL for long-running one-shot calls without a poll endpoint.");
                    return ResponseEntity.badRequest().body(err);
                }
            }
            int pollIntervalSeconds = asyncPoll.get("pollIntervalSeconds") instanceof Number
                    ? ((Number) asyncPoll.get("pollIntervalSeconds")).intValue()
                    : (asyncPoll.get("pollIntervalMs") instanceof Number
                            ? Math.max(1, ((Number) asyncPoll.get("pollIntervalMs")).intValue() / 1000)
                            : 5);
            int maxWaitSeconds = asyncPoll.get("maxWaitSeconds") instanceof Number
                    ? ((Number) asyncPoll.get("maxWaitSeconds")).intValue()
                    : (asyncPoll.get("maxWaitMs") instanceof Number
                            ? Math.max(1, ((Number) asyncPoll.get("maxWaitMs")).intValue() / 1000)
                            : 600);

            // ====== 步骤 2：计算请求签名 + 按 session 维度去重（在调第三方**之前**）======
            String signature = RequestSignatureUtil.compute(
                    request.getMethod() != null ? request.getMethod() : "GET",
                    request.getUrl(),
                    request.getBody(),
                    idJsonPath,
                    pollMethod,
                    pollEndpointTemplate
            );

            org.slf4j.LoggerFactory.getLogger(SkillController.class).info(
                    "[callApiAsync] dedup-check user={} session={} method={} url={} idJsonPath={} pollMethod={} pollEndpoint={} sig={}",
                    userId, sessionId,
                    request.getMethod(), request.getUrl(),
                    idJsonPath, pollMethod, pollEndpointTemplate, signature);

            int windowSeconds = (sessionId != null && !sessionId.trim().isEmpty())
                    ? DedupConfig.PER_SESSION_WINDOW_SECONDS
                    : DedupConfig.NO_SESSION_WINDOW_SECONDS;
            AsyncTask existing = asyncTaskPollingService.findRecentBySignatureInSession(
                    userId, sessionId, signature, windowSeconds);
            if (existing != null) {
                org.slf4j.LoggerFactory.getLogger(SkillController.class).info(
                        "[callApiAsync] Duplicate request dedup'd: user={}, session={}, sig={}, existing asyncTaskId={}, status={}",
                        userId, sessionId, signature, existing.getId(), existing.getStatus());

                // 写一条 DUPLICATE_REQUEST 审计日志（如果能拿到 task）
                try {
                    if (existing.getId() != null) {
                        AsyncPollingAuditLog dupLog = pollingAuditService.buildBaseLog(existing, "DUPLICATE_REQUEST");
                        pollingAuditService.log(dupLog);
                    }
                } catch (Exception auditEx) {
                    org.slf4j.LoggerFactory.getLogger(SkillController.class).warn(
                            "[callApiAsync] Failed to write DUPLICATE_REQUEST audit log: {}", auditEx.getMessage());
                }

                Map<String, Object> deduped = new HashMap<>();
                deduped.put("asyncTaskId", existing.getId());
                deduped.put("status", existing.getStatus());
                deduped.put("externalTaskId", existing.getExternalTaskId());
                deduped.put("pollStrategy", existing.getPollStrategy());
                deduped.put("deduped", true);
                return ResponseEntity.ok(deduped);
            }

            // ====== 步骤 3：调第三方（PERIODIC 才同步调，SINGLE_CALL 不调——交给 scheduler 长 readTimeout）======
            int timeoutSeconds = request.getTimeoutSeconds() != null ? request.getTimeoutSeconds() : 30;
            String initialResponseStr = null;
            String externalTaskId = null;
            String pollEndpoint = null;

            if (!singleCallMode) {
                // PERIODIC：同步调第三方，拿到 initialResponse + externalTaskId
                Object initialResponse = builtinToolExecutionService.callExternalApi(request);

                initialResponseStr = initialResponse instanceof String
                        ? (String) initialResponse
                        : objectMapper.writeValueAsString(initialResponse);

                externalTaskId = asyncTaskPollingService.extractTaskId(initialResponseStr, idJsonPath);
                if (externalTaskId == null || StringUtils.isBlank(externalTaskId)) {
                    Map<String, Object> errBody = new HashMap<>();
                    errBody.put("error", "Failed to extract task id from initial response");
                    errBody.put("idJsonPath", idJsonPath);
                    errBody.put("initialResponse", initialResponseStr);
                    return ResponseEntity.badRequest().body(errBody);
                }

                pollEndpoint = pollEndpointTemplate.replace("{id}", externalTaskId);
            } else {
                // SINGLE_CALL：pollEndpoint 已在 step 1 fallback 到 request URL
                pollEndpoint = pollEndpointTemplate;
            }

            // ====== 步骤 4：构造 AsyncTask 并入库（包含签名）======
            String effectiveMethod = singleCallMode
                    ? (request.getMethod() != null ? request.getMethod().toUpperCase() : pollMethod.toUpperCase())
                    : pollMethod;

            AsyncTask task = new AsyncTask();
            task.setSkillId(skillId);
            task.setUserId(userId);
            task.setSessionId(sessionId);
            task.setExternalTaskId(externalTaskId); // SINGLE_CALL 时为 null
            task.setPollEndpoint(pollEndpoint);
            task.setPollMethod(effectiveMethod);
            task.setPollIntervalSeconds(pollIntervalSeconds);
            task.setMaxWaitSeconds(maxWaitSeconds);
            task.setCompletionJsonPath((String) asyncPoll.get("completionJsonPath"));
            task.setCompletionValue((String) asyncPoll.get("completionValue"));
            task.setResultJsonPath((String) asyncPoll.get("resultJsonPath"));
            task.setPollStrategy(pollStrategy);
            if (singleCallReadTimeoutSeconds != null && singleCallReadTimeoutSeconds >= 60) {
                task.setSingleCallReadTimeoutSeconds(singleCallReadTimeoutSeconds);
            } else if (singleCallMode) {
                // SINGLE_CALL 兜底：未传或 < 60s 都强制用 600s（10 分钟）
                task.setSingleCallReadTimeoutSeconds(600);
            }

            if (asyncPoll.get("failedValues") != null) {
                task.setFailedValues(objectMapper.writeValueAsString(asyncPoll.get("failedValues")));
            }
            if (asyncPoll.get("pollHeaders") != null) {
                task.setPollHeaders(objectMapper.writeValueAsString(asyncPoll.get("pollHeaders")));
            }
            if (singleCallMode) {
                if (request.getBody() != null) {
                    task.setRequestBody(objectMapper.writeValueAsString(request.getBody()));
                }
                task.setInitialResponse(null);
            } else {
                task.setInitialResponse(initialResponseStr);
                task.setRequestBody(null);
            }
            task.setRequestSignature(signature);

            asyncTaskPollingService.createTask(task);

            Map<String, Object> response = new HashMap<>();
            response.put("asyncTaskId", task.getId());
            response.put("status", "PENDING");
            response.put("externalTaskId", externalTaskId);
            response.put("pollStrategy", pollStrategy);
            response.put("deduped", false);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Collections.singletonMap("error", "Async API call failed: " + e.getMessage()));
        }
    }

    // --- Text Prompts (AI optimization) ---

    @GetMapping("/text-prompts")
    public List<SkillTextPrompt> getAllTextPrompts() {
        return skillTextPromptMapper.selectList(null);
    }

    @GetMapping("/text-prompts/{fieldId}")
    public ResponseEntity<SkillTextPrompt> getTextPrompt(@PathVariable String fieldId) {
        return skillTextPromptMapper.findByFieldId(fieldId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/text-prompts/{fieldId}")
    public ResponseEntity<?> updateTextPrompt(
            @PathVariable String fieldId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody SkillTextPrompt body
    ) {
        return skillTextPromptMapper.findByFieldId(fieldId)
                .map(existing -> {
                    if (body.getSystemPrompt() != null) existing.setSystemPrompt(body.getSystemPrompt());
                    if (body.getUserPromptTemplate() != null) existing.setUserPromptTemplate(body.getUserPromptTemplate());
                    skillTextPromptMapper.updateById(existing);
                    return ResponseEntity.ok(existing);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // --- Enum Source (dynamic dropdown options) ---

    @PostMapping("/enum-source")
    public ResponseEntity<?> fetchEnumSource(@RequestBody Map<String, Object> body) {
        try {
            String url = (String) body.get("url");
            if (url == null || StringUtils.isBlank(url)) {
                return ResponseEntity.badRequest().body(Collections.singletonMap("error", "url is required"));
            }
            String method = body.get("method") instanceof String ? (String) body.get("method") : "GET";
            @SuppressWarnings("unchecked")
            Map<String, Object> headers = body.get("headers") instanceof Map ? (Map<String, Object>) body.get("headers") : null;
            String jsonPath = (String) body.get("jsonPath");
            String valueKey = body.get("valueKey") instanceof String ? (String) body.get("valueKey") : "value";
            String labelKey = body.get("labelKey") instanceof String ? (String) body.get("labelKey") : "label";
            String searchParam = (String) body.get("searchParam");
            String searchQuery = (String) body.get("searchQuery");

            String resolvedUrl = url;
            if (searchQuery != null && !StringUtils.isBlank(searchQuery) && searchParam != null && !StringUtils.isBlank(searchParam)) {
                String separator = resolvedUrl.contains("?") ? "&" : "?";
                resolvedUrl += separator + searchParam + "=" + java.net.URLEncoder.encode(searchQuery, "UTF-8");
            }

            Object response = apiProxyService.callApi(resolvedUrl, method, headers, null);
            String responseStr = response instanceof String ? (String) response : objectMapper.writeValueAsString(response);
            Object parsed = objectMapper.readValue(responseStr, Object.class);

            Object listNode = (jsonPath != null && !StringUtils.isBlank(jsonPath))
                    ? JsonPathUtils.extractValueByPath(parsed, jsonPath)
                    : parsed;

            if (!(listNode instanceof List)) {
                return ResponseEntity.badRequest().body(new HashMap<String, Object>() {{
            put("error", "jsonPath did not resolve to an array");
            put("jsonPath", jsonPath);
            put("responsePreview", responseStr.substring(0, Math.min(500, responseStr.length())));
        }});
            }

            @SuppressWarnings("unchecked")
            List<Object> items = (List<Object>) listNode;
            List<Map<String, String>> options = new java.util.ArrayList<>();
            for (Object item : items) {
                if (!(item instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) item;
                Object labelObj = map.get(labelKey);
                Object valueObj = map.get(valueKey);
                if (valueObj != null) {
                    options.add(new HashMap<String, String>() {{
                        put("label", labelObj != null ? labelObj.toString() : valueObj.toString());
                        put("value", valueObj.toString());
                    }});
                }
            }
            return ResponseEntity.ok(options);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Collections.singletonMap("error", "Enum source fetch failed: " + e.getMessage()));
        }
    }

    // Old linux-script endpoint removed — use POST /api/skills/execute instead

    // Old compute endpoint removed — use POST /api/skills/execute instead

    /**
     * SSH 请求数据传输对象。
     */
    public static class SshRequest {
        private String host;
        private int port = 22;
        private String username;
        private String privateKey;
        private String command;
        // getters/setters omitted for brevity
        public String getHost() { return host; }
        public void setHost(String host) { this.host = host; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPrivateKey() { return privateKey; }
        public void setPrivateKey(String privateKey) { this.privateKey = privateKey; }
        public String getCommand() { return command; }
        public void setCommand(String command) { this.command = command; }
    }

    /**
     * API 调用请求数据传输对象。
     */
    public static class ApiRequest {
        private String url;
        private String method;
        /**
         * Outgoing headers; values are usually strings. Arrays (e.g. {@code "Origin": ["https://a"]})
         * are accepted so OpenAPI-style or UI-exported skills deserialize; see {@code ApiProxyService}.
         */
        private Map<String, Object> headers;
        private Object body;
        private Integer timeoutSeconds;
        private Map<String, Object> asyncPoll;
        // getters/setters
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }
        public Map<String, Object> getHeaders() { return headers; }
        public void setHeaders(Map<String, Object> headers) { this.headers = headers; }
        public Object getBody() { return body; }
        public void setBody(Object body) { this.body = body; }
        public Integer getTimeoutSeconds() { return timeoutSeconds; }
        public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
        public Map<String, Object> getAsyncPoll() { return asyncPoll; }
        public void setAsyncPoll(Map<String, Object> asyncPoll) { this.asyncPoll = asyncPoll; }
    }

    /**
     * 计算请求数据传输对象。
     */
    public static class ComputeRequest {
        private String operation;
        private List<Object> operands;

        public String getOperation() { return operation; }
        public void setOperation(String operation) { this.operation = operation; }
        public List<Object> getOperands() { return operands; }
        public void setOperands(List<Object> operands) { this.operands = operands; }
    }
}
