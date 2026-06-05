package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.dto.OcrResponse;
import com.lobsterai.skillgateway.exception.OcrException;
import com.lobsterai.skillgateway.util.DdsUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

/**
 * 图片 OCR 服务：直接调用项目内工具类 {@link DdsUtil#getOcrText(InputStream)} 完成识别。
 *
 * <h3>当前状态</h3>
 * <ul>
 *   <li>{@code DdsUtil} 已在 {@code com.lobsterai.skillgateway.util} 包下创建，当前为占位实现（返回固定提示文字）</li>
 *   <li>真实 OCR 接入时只需修改 {@code DdsUtil.getOcrText} 方法体，本类无需改动</li>
 * </ul>
 */
@Service
public class FileOcrService {

    /** DdsUtil 工具类调用超时（秒），目前为预留配置，{@code DdsUtil.getOcrText} 是同步阻塞调用。 */
    private final long timeoutSeconds;

    public FileOcrService(
            @Value("${app.file.ocr.timeout-seconds:10}") long timeoutSeconds
    ) {
        this.timeoutSeconds = timeoutSeconds;
    }

    /**
     * 对上传的图片做 OCR 识别。
     *
     * @param file 前端上传的 multipart 文件
     * @return 识别结果（含文字 + 置信度）
     * @throws OcrException 识别失败（文件为空 / 读取失败 / DdsUtil 抛错）
     */
    public OcrResponse recognize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new OcrException("uploaded file is empty");
        }
        try (InputStream in = file.getInputStream()) {
            // 直接调用 DdsUtil（当前为占位实现，返回固定提示）
            String text = DdsUtil.getOcrText(in);
            return new OcrResponse(text, null);
        } catch (OcrException e) {
            throw e;
        } catch (Exception e) {
            throw new OcrException(
                    "OCR failed for file [" + file.getOriginalFilename() + "]: " + e.getMessage(),
                    e
            );
        }
    }

    public long getTimeoutSeconds() {
        return timeoutSeconds;
    }
}
