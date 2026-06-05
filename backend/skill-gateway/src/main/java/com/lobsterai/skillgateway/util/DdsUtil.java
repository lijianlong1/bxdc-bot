package com.lobsterai.skillgateway.util;

import java.io.InputStream;

/**
 * 图片 OCR 工具类（占位实现）。
 *
 * <p>当前为伪实现：忽略输入流内容，直接返回固定提示文字，
 * 用于打通前端 / agent-core / skill-gateway 的完整调用链路。</p>
 *
 * <p>后续真实 OCR 接入时，只需把 {@link #getOcrText(InputStream)} 方法体替换为真实实现，
 * 业务代码（Controller / Service）无需任何改动。</p>
 *
 * <h3>替换为真实实现的步骤</h3>
 * <ol>
 *   <li>把下方方法体替换为实际 OCR 调用（HTTP / SDK / 命令行 等）</li>
 *   <li>如果方法签名有变动（如参数变成 byte[] / MultipartFile / 文件路径），
 *       同步修改 {@code FileOcrService.recognize} 的调用处</li>
 *   <li>如果需要引入第三方库，按 AGENTS.md §7.1 vendored 到 {@code lib/} 目录</li>
 * </ol>
 */
public class DdsUtil {

    private DdsUtil() {
        // 工具类，禁止实例化
    }

    /**
     * 对输入流中的图片做 OCR 识别，返回识别出的文本。
     *
     * @param inputStream 图片输入流（调用方负责关闭；当前占位实现忽略此参数）
     * @return 识别出的文本（占位实现固定返回提示文字）
     */
    public static String getOcrText(InputStream inputStream) {
        // TODO: 替换为真实 OCR 实现（HTTP / SDK / 命令行 等）
        return "图片识别功能正在开发中，请稍后。。。";
    }
}
