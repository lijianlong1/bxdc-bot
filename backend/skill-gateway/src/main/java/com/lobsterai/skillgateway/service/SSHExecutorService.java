package com.lobsterai.skillgateway.service;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.common.IOUtils;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.transport.verification.PromiscuousVerifier;
import net.schmizz.sshj.userauth.keyprovider.KeyProvider;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * SSH 执行服务。
 * <p>
 * 封装 SSHJ 客户端，提供远程命令执行能力。
 * </p>
 */
@Service
public class SSHExecutorService {

    /**
     * 在远程服务器上执行命令（使用私钥认证）。
     *
     * @param host       远程主机地址
     * @param port       SSH 端口
     * @param username   用户名
     * @param privateKey 私钥内容
     * @param command    要执行的 Shell 命令
     * @return 命令的标准输出
     * @throws IOException 如果连接失败或执行出错
     */
    public String executeCommand(String host, int port, String username, String privateKey, String command) throws IOException {
        try (SSHClient ssh = new SSHClient()) {
            ssh.addHostKeyVerifier(new PromiscuousVerifier());
            ssh.connect(host, port);
            
            KeyProvider keys = ssh.loadKeys(privateKey, null, null);
            ssh.authPublickey(username, keys);

            return executeSessionCommand(ssh, command);
        }
    }

    /**
     * 在远程服务器上执行命令（使用密码认证）。
     *
     * @param host     远程主机地址
     * @param port     SSH 端口
     * @param username 用户名
     * @param password 密码
     * @param command  要执行的 Shell 命令
     * @return 命令的标准输出
     * @throws IOException 如果连接失败或执行出错
     */
    public String executeCommandWithPassword(String host, int port, String username, String password, String command) throws IOException {
        try (SSHClient ssh = new SSHClient()) {
            ssh.addHostKeyVerifier(new PromiscuousVerifier());
            ssh.connect(host, port);
            
            ssh.authPassword(username, password);

            return executeSessionCommand(ssh, command);
        }
    }

    private String executeSessionCommand(SSHClient ssh, String command) throws IOException {
        try (Session session = ssh.startSession()) {
            Session.Command cmd = session.exec(command);
            String output = IOUtils.readFully(cmd.getInputStream()).toString();
            cmd.join(5, TimeUnit.SECONDS);
            return output;
        }
    }
}
