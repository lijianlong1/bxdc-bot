package com.lobsterai.skillgateway.config;

import com.lobsterai.skillgateway.mapper.AsyncTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 启动恢复：JVM 启动后扫描"卡住超过 N 分钟"的 SINGLE_CALLED 任务，标为 FAILED。
 *
 * 为什么需要：
 * - SINGLE_CALL 任务是"长 HTTP readTimeout 等结果"，进程在等待过程中被 kill，恢复后会卡在 SINGLE_CALLED 状态
 * - PERIODIC 任务能通过 next poll 自动恢复，但 SINGLE_CALL 没有"下一次轮询"
 * - 因此启动时主动检查并清理
 *
 * 阈值：写死 30 分钟（STUCK_SINGLE_CALL_MINUTES 常量，**不加配置**，用户硬约束）
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class StartupRecoveryRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupRecoveryRunner.class);

    /** 卡住超过 30 分钟的 SINGLE_CALLED 任务视为"已卡死"，标 FAILED。 */
    private static final int STUCK_SINGLE_CALL_MINUTES = 30;

    private final AsyncTaskMapper asyncTaskMapper;

    public StartupRecoveryRunner(AsyncTaskMapper asyncTaskMapper) {
        this.asyncTaskMapper = asyncTaskMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int affected = asyncTaskMapper.recoverStuckSingleCallTasks(STUCK_SINGLE_CALL_MINUTES);
            if (affected > 0) {
                log.warn("[StartupRecovery] Marked {} tasks as FAILED (stuck in SINGLE_CALLED > {} minutes)",
                        affected, STUCK_SINGLE_CALL_MINUTES);
            } else {
                log.info("[StartupRecovery] No stuck SINGLE_CALLED tasks found (threshold: {} minutes)",
                        STUCK_SINGLE_CALL_MINUTES);
            }
        } catch (Exception e) {
            // 启动恢复失败不阻塞应用启动
            log.error("[StartupRecovery] Failed to recover stuck SINGLE_CALLED tasks: {}", e.getMessage(), e);
        }
    }
}
