package com.lobsterai.skillgateway.controller;

/**
 * Linux 脚本执行请求：使用台账主键 {@code id}，与 {@link com.lobsterai.skillgateway.entity.ServerLedger} 对应。
 */
public class LinuxScriptRequest {
    private Long id;
    private String command;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }
}
