package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.audit.HttpClientAuditMode;
import com.lobsterai.skillgateway.controller.SkillController;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Shared execution logic for built-in tools (api proxy, compute, SSH), used by
 * {@link com.lobsterai.skillgateway.controller.SkillController} and {@link com.lobsterai.skillgateway.controller.SystemSkillController}.
 */
@Service
public class BuiltinToolExecutionService {

    private final SSHExecutorService sshExecutorService;
    private final ApiProxyService apiProxyService;
    private final SecurityFilterService securityFilterService;
    private final ServerLedgerService serverLedgerService;
    private final LinuxScriptExecutionService linuxScriptExecutionService;
    private final GatewayOutboundAuditService gatewayOutboundAuditService;

    public BuiltinToolExecutionService(
            SSHExecutorService sshExecutorService,
            ApiProxyService apiProxyService,
            SecurityFilterService securityFilterService,
            ServerLedgerService serverLedgerService,
            LinuxScriptExecutionService linuxScriptExecutionService,
            GatewayOutboundAuditService gatewayOutboundAuditService
    ) {
        this.sshExecutorService = sshExecutorService;
        this.apiProxyService = apiProxyService;
        this.securityFilterService = securityFilterService;
        this.serverLedgerService = serverLedgerService;
        this.linuxScriptExecutionService = linuxScriptExecutionService;
        this.gatewayOutboundAuditService = gatewayOutboundAuditService;
    }

    public Object callExternalApi(SkillController.ApiRequest request) throws Exception {
        Integer timeoutSeconds = request.getTimeoutSeconds();
        if (timeoutSeconds != null && timeoutSeconds > 0) {
            return apiProxyService.callApi(
                    request.getUrl(),
                    request.getMethod(),
                    request.getHeaders(),
                    request.getBody(),
                    HttpClientAuditMode.SKILL_OUTBOUND,
                    timeoutSeconds
            );
        }
        return apiProxyService.callApi(
                request.getUrl(),
                request.getMethod(),
                request.getHeaders(),
                request.getBody(),
                HttpClientAuditMode.SKILL_OUTBOUND
        );
    }

    public Map<String, Object> compute(SkillController.ComputeRequest request) {
        try {
            Object result = executeCompute(request.getOperation(), request.getOperands());
            return Collections.singletonMap("result", result);
        } catch (IllegalArgumentException e) {
            return Collections.singletonMap("error", e.getMessage());
        }
    }

    public ResponseEntity<String> executeSsh(SkillController.SshRequest request, String userId) {
        if (!securityFilterService.isCommandSafe(request.getCommand())) {
            gatewayOutboundAuditService.recordSsh(
                    userId,
                    request.getHost(),
                    request.getPort(),
                    request.getCommand(),
                    false,
                    "Command blocked by security policy",
                    "skill.ssh",
                    null,
                    null
            );
            return ResponseEntity.badRequest().body("Command blocked by security policy");
        }
        if (userId != null && !StringUtils.isBlank(userId)) {
            return serverLedgerService.getServerLedgerByName(userId, request.getHost().trim())
                    .map(ledger -> {
                        int auditPort = ledger.getPort() != null && ledger.getPort() > 0 ? ledger.getPort() : 22;
                        String auditHost = request.getHost().trim();
                        if (ledger.getHost() != null && !StringUtils.isBlank(ledger.getHost())) {
                            auditHost = ledger.getHost().trim();
                        }
                        try {
                            String output = linuxScriptExecutionService.executeFromLedger(ledger, request.getCommand());
                            gatewayOutboundAuditService.recordSsh(
                                    userId,
                                    auditHost,
                                    auditPort,
                                    request.getCommand(),
                                    true,
                                    null,
                                    "skill.ssh",
                                    output,
                                    ledger.getId()
                            );
                            return ResponseEntity.ok(output);
                        } catch (IllegalArgumentException e) {
                            gatewayOutboundAuditService.recordSsh(
                                    userId,
                                    auditHost,
                                    request.getPort(),
                                    request.getCommand(),
                                    false,
                                    e.getMessage(),
                                    "skill.ssh",
                                    null,
                                    ledger.getId()
                            );
                            return ResponseEntity.badRequest().body(e.getMessage());
                        } catch (IOException e) {
                            gatewayOutboundAuditService.recordSsh(
                                    userId,
                                    auditHost,
                                    request.getPort(),
                                    request.getCommand(),
                                    false,
                                    e.getMessage(),
                                    "skill.ssh",
                                    null,
                                    ledger.getId()
                            );
                            return ResponseEntity.internalServerError().body("SSH execution failed: " + e.getMessage());
                        }
                    })
                    .orElseGet(() -> {
                        gatewayOutboundAuditService.recordSsh(
                                userId,
                                request.getHost(),
                                request.getPort(),
                                request.getCommand(),
                                false,
                                "Server not found in user ledger: " + request.getHost(),
                                "skill.ssh",
                                null,
                                null
                        );
                        return ResponseEntity.badRequest().body("Server not found in user ledger: " + request.getHost());
                    });
        }
        if (request.getUsername() == null || request.getPrivateKey() == null) {
            gatewayOutboundAuditService.recordSsh(
                    userId,
                    request.getHost(),
                    request.getPort(),
                    request.getCommand(),
                    false,
                    "Missing username/privateKey for legacy SSH execution",
                    "skill.ssh",
                    null,
                    null
            );
            return ResponseEntity.badRequest().body("Missing username/privateKey for legacy SSH execution");
        }
        try {
            String output = sshExecutorService.executeCommand(
                    request.getHost(),
                    request.getPort(),
                    request.getUsername(),
                    request.getPrivateKey(),
                    request.getCommand()
            );
            gatewayOutboundAuditService.recordSsh(
                    userId,
                    request.getHost(),
                    request.getPort(),
                    request.getCommand(),
                    true,
                    null,
                    "skill.ssh",
                    output,
                    null
            );
            return ResponseEntity.ok(output);
        } catch (IOException e) {
            gatewayOutboundAuditService.recordSsh(
                    userId,
                    request.getHost(),
                    request.getPort(),
                    request.getCommand(),
                    false,
                    e.getMessage(),
                    "skill.ssh",
                    null,
                    null
            );
            return ResponseEntity.internalServerError().body("SSH execution failed: " + e.getMessage());
        }
    }

    private Object executeCompute(String operation, List<Object> operands) {
        if (operation == null || StringUtils.isBlank(operation)) {
            throw new IllegalArgumentException("operation is required");
        }
        if (operands == null) {
            throw new IllegalArgumentException("operands is required");
        }
        switch (operation) {
            case "add": {
                requireOperands(operands, 2);
                double a = toDouble(operands.get(0)), b = toDouble(operands.get(1));
                return a + b;
            }
            case "subtract": {
                requireOperands(operands, 2);
                double a = toDouble(operands.get(0)), b = toDouble(operands.get(1));
                return a - b;
            }
            case "multiply": {
                requireOperands(operands, 2);
                double a = toDouble(operands.get(0)), b = toDouble(operands.get(1));
                return a * b;
            }
            case "divide": {
                requireOperands(operands, 2);
                double a = toDouble(operands.get(0)), b = toDouble(operands.get(1));
                if (b == 0) throw new IllegalArgumentException("division by zero");
                return a / b;
            }
            case "factorial": {
                requireOperands(operands, 1);
                int n = toInt(operands.get(0));
                if (n < 0) throw new IllegalArgumentException("factorial requires non-negative integer");
                if (n > 170) throw new IllegalArgumentException("factorial overflow: n must be <= 170");
                return factorial(n).toString();
            }
            case "square": {
                requireOperands(operands, 1);
                double x = toDouble(operands.get(0));
                return x * x;
            }
            case "sqrt": {
                requireOperands(operands, 1);
                double x = toDouble(operands.get(0));
                if (x < 0) throw new IllegalArgumentException("sqrt requires non-negative number");
                return Math.sqrt(x);
            }
            case "timestamp_to_date": {
                requireOperands(operands, 1);
                long ts = toLong(operands.get(0));
                if (ts > 0 && ts < 10000000000000L) {
                    ts = ts * 1000;
                }
                LocalDate date = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate();
                return date.format(DateTimeFormatter.ISO_LOCAL_DATE);
            }
            case "date_diff_days": {
                requireOperands(operands, 2);
                LocalDate start = toLocalDate(operands.get(0));
                LocalDate end = toLocalDate(operands.get(1));
                return ChronoUnit.DAYS.between(start, end);
            }
            default:
                throw new IllegalArgumentException("unknown operation: " + operation);
        }
    }

    private static void requireOperands(List<?> operands, int expected) {
        if (operands.size() != expected) {
            throw new IllegalArgumentException("expected " + expected + " operand(s), got " + operands.size());
        }
    }

    private static double toDouble(Object n) {
        if (n instanceof Number) {
            return ((Number) n).doubleValue();
        }
        if (n instanceof String) {
            String value = (String) n;
            if (!value.trim().isEmpty()) {
                try {
                    return Double.parseDouble(value);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("invalid numeric operand: " + value);
                }
            }
        }
        throw new IllegalArgumentException("numeric operand is required");
    }

    private static int toInt(Object n) {
        return (int) toLong(n);
    }

    private static long toLong(Object n) {
        if (n instanceof Number) {
            return ((Number) n).longValue();
        }
        if (n instanceof String) {
            String value = (String) n;
            if (!value.trim().isEmpty()) {
                try {
                    return Long.parseLong(value);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("invalid numeric operand: " + value);
                }
            }
        }
        throw new IllegalArgumentException("numeric operand is required");
    }

    private static LocalDate toLocalDate(Object value) {
        if (!(value instanceof String)) {
            throw new IllegalArgumentException("date_diff_days requires YYYY-MM-DD date strings");
        }
        String text = (String) value;
        if (text.trim().isEmpty()) {
            throw new IllegalArgumentException("date_diff_days requires YYYY-MM-DD date strings");
        }
        try {
            return LocalDate.parse(text.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid date operand: " + text);
        }
    }

    private static BigInteger factorial(int n) {
        if (n <= 1) return BigInteger.ONE;
        BigInteger r = BigInteger.ONE;
        for (int i = 2; i <= n; i++) {
            r = r.multiply(BigInteger.valueOf(i));
        }
        return r;
    }
}
