package com.lobsterai.skillgateway.dto;

/**
 * OCR 识别响应。
 *
 * <p>前端在 {@code frontend/src/utils/imageOcr.ts} 中按此结构解析：
 * 拿到 {@code text} 拼接到大模型消息。</p>
 *
 * @param text        识别出的全部文字（多行以 \n 分隔）
 * @param confidence  整体置信度（0-100）。DdsUtil 暂不返回，先给 null
 */
public class OcrResponse {

    private final String text;
    private final Double confidence;

    public OcrResponse(String text, Double confidence) {
        this.text = text == null ? "" : text;
        this.confidence = confidence;
    }

    public String getText() {
        return text;
    }

    public Double getConfidence() {
        return confidence;
    }
}
