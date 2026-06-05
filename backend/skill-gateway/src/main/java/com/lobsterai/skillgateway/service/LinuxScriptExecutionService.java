package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Linux 脚本执行服务：从台账行解凭据并执行；不再使用环境配置 {@code skill.linux-script.servers}。
 */
@Service
public class LinuxScriptExecutionService {

    private final SSHExecutorService sshExecutorService;
    private final SecurityFilterService securityFilterService;

    public LinuxScriptExecutionService(
            SSHExecutorService sshExecutorService,
            SecurityFilterService securityFilterService
    ) {
        this.sshExecutorService = sshExecutorService;
        this.securityFilterService = securityFilterService;
    }

    /**
     * 使用服务器台账中的连接信息执行远程命令（含安全过滤）。
     * 认证：若配置了 {@code privateKeyPath} 则优先用私钥文件；否则使用 {@code password}。
     */
    public String executeFromLedger(ServerLedger ledger, String command) throws IOException {
        if (command == null || StringUtils.isBlank(command)) {
            throw new IllegalArgumentException("command is required");
        }
        String trimmed = command.trim();
        if (!securityFilterService.isCommandSafe(trimmed)) {
            throw new IllegalArgumentException("Command blocked by security policy");
        }

        validateLedgerConnection(ledger);

        String host = ledger.getHost().trim();
        int port = ledger.getPort() != null && ledger.getPort() > 0 ? ledger.getPort() : 22;
        String user = ledger.getUsername().trim();

        boolean hasKey = ledger.getPrivateKeyPath() != null && !StringUtils.isBlank(ledger.getPrivateKeyPath());
        boolean hasPw = ledger.getPassword() != null && !StringUtils.isBlank(ledger.getPassword());

        if (hasKey) {
            return sshExecutorService.executeCommand(
                    host,
                    port,
                    user,
                    ledger.getPrivateKeyPath().trim(),
                    trimmed
            );
        }
        return sshExecutorService.executeCommandWithPassword(host, port, user, ledger.getPassword(), trimmed);
    }

    /**
     * 校验台账行是否具备执行所需最小字段；异常信息不得包含密码内容。
     */
    public void validateLedgerConnection(ServerLedger ledger) {
        if (ledger.getHost() == null || StringUtils.isBlank(ledger.getHost())) {
            throw new IllegalArgumentException("Server ledger is missing host");
        }
        if (ledger.getUsername() == null || StringUtils.isBlank(ledger.getUsername())) {
            throw new IllegalArgumentException("Server ledger is missing username");
        }
        boolean hasKey = ledger.getPrivateKeyPath() != null && !StringUtils.isBlank(ledger.getPrivateKeyPath());
        boolean hasPw = ledger.getPassword() != null && !StringUtils.isBlank(ledger.getPassword());
        if (!hasKey && !hasPw) {
            throw new IllegalArgumentException(
                    "Server ledger has no authentication: set password or private key path");
        }
    }
}
