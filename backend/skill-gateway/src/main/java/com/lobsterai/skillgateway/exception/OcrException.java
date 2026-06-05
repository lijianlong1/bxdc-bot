package com.lobsterai.skillgateway.exception;

/**
 * OCR 处理失败统一异常。
 *
 * <p>由 {@code FileOcrService.recognize} 抛出，
 * 由 {@code FileOcrController} 的 {@code @ExceptionHandler} 捕获并返回 HTTP 500。</p>
 */
public class OcrException extends RuntimeException {

    public OcrException(String message) {
        super(message);
    }

    public OcrException(String message, Throwable cause) {
        super(message, cause);
    }
}
