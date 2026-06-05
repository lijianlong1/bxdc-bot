package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.dto.OcrResponse;
import com.lobsterai.skillgateway.exception.OcrException;
import com.lobsterai.skillgateway.service.FileOcrService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

/**
 * 文件 OCR 端点。
 *
 * <p>前端在 {@code frontend/src/utils/imageOcr.ts} 中通过
 * {@code POST /api/file/ocr-image}（multipart/form-data, field=file）调用，
 * 返回 {@link OcrResponse}。</p>
 *
 * <p>任务编号：file-upload-tasks 任务 9。</p>
 */
@RestController
@RequestMapping("/api/file")
public class FileOcrController {

    private static final Logger log = LoggerFactory.getLogger(FileOcrController.class);

    private final FileOcrService fileOcrService;

    public FileOcrController(FileOcrService fileOcrService) {
        this.fileOcrService = fileOcrService;
    }

    @PostMapping(value = "/ocr-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<OcrResponse> ocrImage(@RequestParam("file") MultipartFile file) {
        log.info("[ocr-image] received file: name={}, size={} bytes",
                file.getOriginalFilename(), file.getSize());
        OcrResponse resp = fileOcrService.recognize(file);
        log.info("[ocr-image] recognized text length={} chars", resp.getText().length());
        return ResponseEntity.ok(resp);
    }

    @ExceptionHandler(OcrException.class)
    public ResponseEntity<Map<String, Object>> handleOcrException(OcrException e) {
        log.error("[ocr-image] OCR failed: {}", e.getMessage(), e);
        Map<String, Object> body = new HashMap<>();
        body.put("error", "ocr_failed");
        body.put("message", e.getMessage());
        return ResponseEntity.status(500).body(body);
    }
}
