package com.lobsterai.skillgateway.orchestration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

/**
 * 任务分发服务：将用户指令经 HTTP 分发给 Agent Core。
 */
@Service
public class TaskDispatcherService {

    private final WebClient webClient;

    public TaskDispatcherService(
            WebClient.Builder webClientBuilder,
            @Value("${agent.core.url:http://localhost:3000}") String agentCoreUrl
    ) {
        this.webClient = webClientBuilder.baseUrl(agentCoreUrl).build();
    }

    public Flux<String> dispatchTask(String instruction, Object context, Object history) {
        return webClient.post()
                .uri("/agent/run")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new TaskRequest(instruction, context, history))
                .retrieve()
                .bodyToFlux(String.class);
    }

    public static class TaskRequest {
        public String instruction;
        public Object context;
        public Object history;

        public TaskRequest(String instruction, Object context, Object history) {
            this.instruction = instruction;
            this.context = context;
            this.history = history;
        }
    }
}
