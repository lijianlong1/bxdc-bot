package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.audit.HttpClientAuditMode;
import com.lobsterai.skillgateway.entity.AsyncTask;
import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.entity.Skill;
import com.lobsterai.skillgateway.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class SkillExecutionService {

    private static final Logger log = LoggerFactory.getLogger(SkillExecutionService.class);

    private final SkillService skillService;
    private final ApiProxyService apiProxyService;
    private final SSHExecutorService sshExecutorService;
    private final SecurityFilterService securityFilterService;
    private final ServerLedgerService serverLedgerService;
    private final LinuxScriptExecutionService linuxScriptExecutionService;
    private final GatewayOutboundAuditService gatewayOutboundAuditService;
    private final PendingConfirmationStore confirmationStore;
    private final AsyncTaskPollingService asyncTaskPollingService;
    private final AsyncTaskPollingScheduler asyncTaskPollingScheduler;
    private final ObjectMapper objectMapper;

    public SkillExecutionService(
            SkillService skillService,
            ApiProxyService apiProxyService,
            SSHExecutorService sshExecutorService,
            SecurityFilterService securityFilterService,
            ServerLedgerService serverLedgerService,
            LinuxScriptExecutionService linuxScriptExecutionService,
            GatewayOutboundAuditService gatewayOutboundAuditService,
            PendingConfirmationStore confirmationStore,
            AsyncTaskPollingService asyncTaskPollingService,
            AsyncTaskPollingScheduler asyncTaskPollingScheduler,
            ObjectMapper objectMapper
    ) {
        this.skillService = skillService;
        this.apiProxyService = apiProxyService;
        this.sshExecutorService = sshExecutorService;
        this.securityFilterService = securityFilterService;
        this.serverLedgerService = serverLedgerService;
        this.linuxScriptExecutionService = linuxScriptExecutionService;
        this.gatewayOutboundAuditService = gatewayOutboundAuditService;
        this.confirmationStore = confirmationStore;
        this.asyncTaskPollingService = asyncTaskPollingService;
        this.asyncTaskPollingScheduler = asyncTaskPollingScheduler;
        this.objectMapper = objectMapper;
    }

    public Object execute(ExecuteRequest request) throws Exception {
        Skill skill = skillService.getSkillByIdForUser(request.skillId, request.userId)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found or disabled: " + request.skillId));

        if (!skill.isEnabled()) {
            throw new IllegalArgumentException("Skill is disabled: " + request.skillId);
        }

        Map<String, Object> config = parseConfiguration(skill.getConfiguration());

        if (skill.isRequiresConfirmation() && !request.isConfirmed()) {
            String requestId = confirmationStore.put(
                    skill.getId(),
                    skill.getName(),
                    request.parameters,
                    request.userId
            );
            Map<String, Object> confirmResponse = new LinkedHashMap<>();
            confirmResponse.put("status", "CONFIRMATION_REQUIRED");
            confirmResponse.put("requestId", requestId);
            confirmResponse.put("skillName", skill.getName());
            confirmResponse.put("skillId", skill.getId());
            confirmResponse.put("parameters", request.parameters);
            confirmResponse.put("expiresInSeconds", 300);
            return confirmResponse;
        }

        Object effectiveParameters = request.parameters;
        if (request.isConfirmed() && request.requestId != null) {
            PendingConfirmationStore.PendingConfirmation conf =
                    confirmationStore.getIfValid(request.requestId, request.userId);
            if (conf == null) {
                Map<String, Object> error = new LinkedHashMap<>();
                error.put("error", "Confirmation request not found or expired");
                return error;
            }
            if (request.adjustedParams != null) {
                effectiveParameters = mergeParameters(conf.parameters, request.adjustedParams);
            }
            confirmationStore.remove(request.requestId);
        }

        effectiveParameters = mergeDefaults(effectiveParameters, config);

        @SuppressWarnings("unchecked")
        Map<String, Object> asyncPollConfig = (Map<String, Object>) config.get("asyncPoll");
        if (asyncPollConfig != null) {
            return executeApiSkillAsync(skill, config, effectiveParameters, request.userId, request.getSessionId());
        }

        String kind = (String) config.getOrDefault("kind", "api");
        switch (kind) {
            case "api":
                return executeApiSkill(config, effectiveParameters);
            case "ssh":
                return executeSshSkill(skill, config, effectiveParameters, request.userId);
            case "template":
                return executeTemplateSkill(config, effectiveParameters);
            default:
                throw new IllegalArgumentException("Unsupported skill kind: " + kind);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeDefaults(Object parameters, Map<String, Object> config) {
        Map<String, Object> paramContract = (Map<String, Object>) config.get("parameterContract");
        if (paramContract == null) {
            return asMap(parameters);
        }
        Map<String, Object> properties = (Map<String, Object>) paramContract.get("properties");
        if (properties == null) {
            return asMap(parameters);
        }

        Map<String, Object> merged = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            Map<String, Object> propDef = (Map<String, Object>) entry.getValue();
            if (propDef != null) {
                if (propDef.containsKey("default")) {
                    merged.put(entry.getKey(), propDef.get("default"));
                } else if (propDef.containsKey("const")) {
                    merged.put(entry.getKey(), propDef.get("const"));
                }
            }
        }

        Map<String, Object> inputMap = asMap(parameters);
        merged.putAll(inputMap);
        return merged;
    }

    @SuppressWarnings("unchecked")
    private Object executeApiSkill(Map<String, Object> config, Object parameters) throws Exception {
        String endpoint = (String) config.get("endpoint");
        if (endpoint == null || StringUtils.isBlank(endpoint)) {
            throw new IllegalArgumentException("API skill missing endpoint");
        }

        String method = (String) config.getOrDefault("method", "GET");
        Map<String, Object> requestHeaders = new LinkedHashMap<>();
        Map<String, Object> configHeaders = (Map<String, Object>) config.get("headers");
        if (configHeaders != null) {
            requestHeaders.putAll(configHeaders);
        }

        String binding = (String) config.getOrDefault("parameterBinding", "query");
        Map<String, Object> paramMap = asMap(parameters);
        Map<String, Object> queryParams = new LinkedHashMap<>();
        Object body = config.get("body");
        boolean useJsonBody = false;
        boolean useFormBody = false;

        String upperMethod = method.toUpperCase();
        if ("jsonBody".equals(binding) && isBodyMethod(upperMethod)) {
            useJsonBody = true;
        } else if ("formBody".equals(binding) && isBodyMethod(upperMethod)) {
            useFormBody = true;
        }

        if (useJsonBody || useFormBody) {
            Map<String, Object> bodyMap = new LinkedHashMap<>();
            Map<String, Object> inputQuery = (Map<String, Object>) paramMap.get("query");
            Map<String, Object> inputHeaders = (Map<String, Object>) paramMap.get("headers");
            Map<String, Object> inputBody = (Map<String, Object>) paramMap.get("body");

            for (Map.Entry<String, Object> entry : paramMap.entrySet()) {
                String key = entry.getKey();
                if ("query".equals(key) || "headers".equals(key) || "body".equals(key)) {
                    continue;
                }
                bodyMap.put(key, entry.getValue());
            }
            if (inputBody != null) {
                bodyMap.putAll(inputBody);
            }
            if (useFormBody) {
                for (Object value : bodyMap.values()) {
                    if (value instanceof Map || value instanceof List) {
                        throw new IllegalArgumentException("formBody requires flat scalar parameters");
                    }
                }
                if (!requestHeaders.containsKey("Content-Type")) {
                    requestHeaders.put("Content-Type", MediaType.APPLICATION_FORM_URLENCODED_VALUE);
                }
                body = encodeFormBody(bodyMap);
            } else {
                if (!requestHeaders.containsKey("Content-Type")) {
                    requestHeaders.put("Content-Type", MediaType.APPLICATION_JSON_VALUE);
                }
                body = bodyMap;
            }
            if (queryParams != null && inputQuery != null) {
                queryParams.putAll(inputQuery);
            }
            if (inputHeaders != null) {
                requestHeaders.putAll(inputHeaders);
            }
        } else {
            for (Map.Entry<String, Object> entry : paramMap.entrySet()) {
                String key = entry.getKey();
                if ("query".equals(key)) {
                    Map<String, Object> q = (Map<String, Object>) entry.getValue();
                    if (q != null) queryParams.putAll(q);
                } else if ("headers".equals(key)) {
                    Map<String, Object> h = (Map<String, Object>) entry.getValue();
                    if (h != null) requestHeaders.putAll(h);
                } else if ("body".equals(key)) {
                    body = entry.getValue();
                } else {
                    queryParams.put(key, entry.getValue());
                }
            }
        }

        String fullUrl = buildUrlWithQuery(endpoint, queryParams);
        return apiProxyService.callApi(fullUrl, upperMethod, requestHeaders, body, HttpClientAuditMode.SKILL_OUTBOUND);
    }

    @SuppressWarnings("unchecked")
    private Object executeSshSkill(Skill skill, Map<String, Object> config, Object parameters, String userId) throws IOException {
        String command = (String) config.get("command");
        if (command == null || StringUtils.isBlank(command)) {
            throw new IllegalArgumentException("SSH skill missing command");
        }
        if (!securityFilterService.isCommandSafe(command)) {
            gatewayOutboundAuditService.recordSsh(
                    userId, "unknown", 22, command,
                    false, "Command blocked by security policy",
                    "skill.execute", null, skill.getId()
            );
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", "Command blocked by security policy");
            return error;
        }

        Map<String, Object> paramMap = asMap(parameters);
        String hostOrName = (String) paramMap.getOrDefault("host",
                paramMap.getOrDefault("name", paramMap.getOrDefault("serverName", null)));

        // Support legacy two-step flow: server_lookup returns {id, name}, LLM passes id
        if (hostOrName == null || StringUtils.isBlank(hostOrName)) {
            Object idObj = paramMap.get("id");
            if (idObj instanceof Number) {
                if (userId == null || StringUtils.isBlank(userId)) {
                    throw new IllegalArgumentException("SSH skill requires X-User-Id header");
                }
                Optional<ServerLedger> ledgerOpt = serverLedgerService.getServerLedgerByUserIdAndId(userId, ((Number) idObj).longValue());
                if (ledgerOpt.isPresent()) {
                    hostOrName = ledgerOpt.get().getName();
                }
            }
        }

        if (hostOrName == null || StringUtils.isBlank(hostOrName)) {
            throw new IllegalArgumentException("SSH skill requires host or server name parameter");
        }
        if (userId == null || StringUtils.isBlank(userId)) {
            throw new IllegalArgumentException("SSH skill requires X-User-Id header");
        }

        Optional<ServerLedger> ledgerOpt = serverLedgerService.getServerLedgerByName(userId, hostOrName.trim());
        if (ledgerOpt.isEmpty()) {
            gatewayOutboundAuditService.recordSsh(
                    userId, hostOrName.trim(), 22, command,
                    false, "Server not found in user ledger: " + hostOrName,
                    "skill.execute", null, skill.getId()
            );
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", "Server not found in user ledger: " + hostOrName);
            return error;
        }

        ServerLedger ledger = ledgerOpt.get();
        int port = ledger.getPort() != null && ledger.getPort() > 0 ? ledger.getPort() : 22;
        String host = ledger.getHost() != null && !StringUtils.isBlank(ledger.getHost())
                ? ledger.getHost().trim() : hostOrName.trim();

        try {
            String output = linuxScriptExecutionService.executeFromLedger(ledger, command);
            gatewayOutboundAuditService.recordSsh(
                    userId, host, port, command,
                    true, null, "skill.execute", output, ledger.getId()
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("result", output);
            return result;
        } catch (IllegalArgumentException e) {
            gatewayOutboundAuditService.recordSsh(
                    userId, host, port, command,
                    false, e.getMessage(), "skill.execute", null, ledger.getId()
            );
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", e.getMessage());
            return error;
        } catch (IOException e) {
            gatewayOutboundAuditService.recordSsh(
                    userId, host, port, command,
                    false, e.getMessage(), "skill.execute", null, ledger.getId()
            );
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", "SSH execution failed: " + e.getMessage());
            return error;
        }
    }

    private Object executeTemplateSkill(Map<String, Object> config, Object parameters) {
        String prompt = (String) config.get("prompt");
        if (prompt == null || StringUtils.isBlank(prompt)) {
            throw new IllegalArgumentException("Template skill missing prompt");
        }

        String rendered = renderTemplate(prompt, asMap(parameters));

        java.util.List<String> unfilled = findUnfilledPlaceholders(rendered);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", "template");
        result.put("rendered", rendered);
        if (!unfilled.isEmpty()) {
            result.put("warning", "Unfilled placeholders: " + String.join(", ", unfilled)
                + ". Ask the user to provide these values and call again.");
        }
        result.put("instruction",
            "Use the rendered content above as your system prompt to generate a response. "
            + "Do NOT call this tool again for the same request.");
        return result;
    }

    private String renderTemplate(String template, Map<String, Object> params) {
        String result = template;
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            result = result.replace("{{" + entry.getKey() + "}}", String.valueOf(entry.getValue()));
        }
        return result;
    }

    private java.util.List<String> findUnfilledPlaceholders(String rendered) {
        java.util.List<String> unfilled = new java.util.ArrayList<>();
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\{\\{([^{}]+)\\}\\}");
        java.util.regex.Matcher m = p.matcher(rendered);
        while (m.find()) {
            unfilled.add(m.group(1));
        }
        return unfilled;
    }

    private Map<String, Object> parseConfiguration(String configuration) {
        if (configuration == null || StringUtils.isBlank(configuration)) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(configuration, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object parameters) {
        if (parameters instanceof Map) {
            return new LinkedHashMap<>((Map<String, Object>) parameters);
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeParameters(Object original, Object adjusted) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (original instanceof Map) {
            result.putAll((Map<String, Object>) original);
        }
        if (adjusted instanceof Map) {
            result.putAll((Map<String, Object>) adjusted);
        }
        return result;
    }

    private boolean isBodyMethod(String method) {
        return "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method);
    }

    private String buildUrlWithQuery(String endpoint, Map<String, Object> queryParams) {
        if (queryParams.isEmpty()) {
            return endpoint;
        }
        StringBuilder sb = new StringBuilder(endpoint);
        boolean first = !endpoint.contains("?");
        for (Map.Entry<String, Object> entry : queryParams.entrySet()) {
            if (entry.getValue() == null) continue;
            sb.append(first ? "?" : "&");
            first = false;
            sb.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
            sb.append("=");
            sb.append(URLEncoder.encode(String.valueOf(entry.getValue()), StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    private MultiValueMap<String, String> encodeFormBody(Map<String, Object> bodyMap) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        for (Map.Entry<String, Object> entry : bodyMap.entrySet()) {
            if (entry.getValue() == null) continue;
            form.add(entry.getKey(), String.valueOf(entry.getValue()));
        }
        return form;
    }

    @SuppressWarnings("unchecked")
    private Object executeApiSkillAsync(Skill skill, Map<String, Object> config, Object parameters, String userId, String sessionId) throws Exception {
        // Step 1: Execute initial API request
        Object initialResponse = executeApiSkill(config, parameters);
        String initialResponseStr = initialResponse instanceof String
                ? (String) initialResponse
                : objectMapper.writeValueAsString(initialResponse);

        Map<String, Object> asyncPoll = (Map<String, Object>) config.get("asyncPoll");

        // Step 2: Extract external task ID
        String idJsonPath = (String) asyncPoll.get("idJsonPath");
        String externalTaskId = asyncTaskPollingService.extractTaskId(initialResponseStr, idJsonPath);
        if (externalTaskId == null || StringUtils.isBlank(externalTaskId)) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("status", "FAILED");
            error.put("error", "Failed to extract task id from initial response");
            error.put("idJsonPath", idJsonPath);
            error.put("initialResponse", initialResponseStr.substring(0, Math.min(500, initialResponseStr.length())));
            return error;
        }

        // Step 3: Build poll endpoint
        String pollEndpoint = ((String) asyncPoll.get("pollEndpoint")).replace("{id}", externalTaskId);

        // Step 4: Create async task
        AsyncTask task = new AsyncTask();
        task.setSkillId(skill.getId());
        task.setUserId(userId);
        task.setSessionId(sessionId);
        task.setExternalTaskId(externalTaskId);
        task.setPollEndpoint(pollEndpoint);
        task.setPollMethod(asyncPoll.get("pollMethod") instanceof String ? (String) asyncPoll.get("pollMethod") : "GET");
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
        task.setPollIntervalSeconds(pollIntervalSeconds);
        task.setMaxWaitSeconds(maxWaitSeconds);
        task.setCompletionJsonPath((String) asyncPoll.get("completionJsonPath"));
        task.setCompletionValue((String) asyncPoll.get("completionValue"));
        task.setResultJsonPath((String) asyncPoll.get("resultJsonPath"));
        if (asyncPoll.get("failedValues") != null) {
            task.setFailedValues(objectMapper.writeValueAsString(asyncPoll.get("failedValues")));
        }
        if (asyncPoll.get("pollHeaders") != null) {
            task.setPollHeaders(objectMapper.writeValueAsString(asyncPoll.get("pollHeaders")));
        }
        task.setInitialResponse(initialResponseStr);

        asyncTaskPollingService.createTask(task);
        log.info("Created async task {} for skill {} (external={})", task.getId(), skill.getId(), externalTaskId);

        // Step 5: Register future and wait
        java.util.concurrent.CompletableFuture<String> future = asyncTaskPollingScheduler.registerFuture(task.getId());

        try {
            String result = future.get(maxWaitSeconds + 30, java.util.concurrent.TimeUnit.SECONDS);
            return result.startsWith("{") ? objectMapper.readValue(result, Object.class) : result;
        } catch (java.util.concurrent.TimeoutException e) {
            asyncTaskPollingService.updatePollResult(task.getId(), "TIMEOUT", null, "Task timed out after " + maxWaitSeconds + " seconds");
            Map<String, Object> timeout = new LinkedHashMap<>();
            timeout.put("status", "TIMEOUT");
            timeout.put("errorMessage", "Task timed out after " + maxWaitSeconds + " seconds");
            return timeout;
        }
    }

    public static class ExecuteRequest {
        public Long skillId;
        public Object parameters;
        public boolean confirmed;
        public String requestId;
        public String userId;
        public Object adjustedParams;
        public String sessionId;

        public boolean isConfirmed() {
            return confirmed;
        }

        public String getSessionId() {
            return sessionId;
        }
    }
}
