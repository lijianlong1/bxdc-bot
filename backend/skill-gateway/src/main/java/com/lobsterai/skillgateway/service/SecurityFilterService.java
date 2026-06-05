package com.lobsterai.skillgateway.service;

import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * 安全过滤服务。
 * <p>
 * 提供对命令的安全性检查，防止高危操作。
 * </p>
 */
@Service
public class SecurityFilterService {

    private static final Pattern DANGEROUS_COMMANDS = Pattern.compile("rm\\s+-rf|mkfs|dd\\s+if=|shutdown|reboot");

    /**
     * 检查命令是否安全。
     *
     * @param command 待检查的命令
     * @return 如果命令安全则返回 true，否则返回 false
     */
    public boolean isCommandSafe(String command) {
        return !DANGEROUS_COMMANDS.matcher(command).find();
    }
}
