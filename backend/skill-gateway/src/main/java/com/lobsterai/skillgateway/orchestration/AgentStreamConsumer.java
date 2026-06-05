package com.lobsterai.skillgateway.orchestration;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

/**
 * Agent 流消费者。
 * <p>
 * 负责调用 TaskDispatcherService 并处理返回的 SSE 流。
 * </p>
 */
@Service
public class AgentStreamConsumer {

    private final TaskDispatcherService taskDispatcherService;

    public AgentStreamConsumer(TaskDispatcherService taskDispatcherService) {
        this.taskDispatcherService = taskDispatcherService;
    }

    /**
     * 执行任务并流式处理结果。
     *
     * @param instruction 用户指令
     * @param context     上下文信息
     * @param history     历史对话
     * @return 包含 Agent 执行状态的 Flux 流
     */
    public Flux<String> executeAndStream(String instruction, Object context, Object history) {
        return taskDispatcherService.dispatchTask(instruction, context, history)
                .doOnNext(event -> {
                    // Here we can parse the event and log it, or update DB status
                    System.out.println("Received Agent Event: " + event);
                });
    }
}
