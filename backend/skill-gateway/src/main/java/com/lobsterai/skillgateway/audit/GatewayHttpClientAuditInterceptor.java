package com.lobsterai.skillgateway.audit;

import com.lobsterai.skillgateway.service.GatewayOutboundAuditService;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class GatewayHttpClientAuditInterceptor implements ClientHttpRequestInterceptor {

    private static final String SKILL_CONTEXT = "skill.external-http";

    private final GatewayOutboundAuditService outboundAuditService;

    public GatewayHttpClientAuditInterceptor(GatewayOutboundAuditService outboundAuditService) {
        this.outboundAuditService = outboundAuditService;
    }

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        if (HttpClientAuditContext.getMode() != HttpClientAuditMode.SKILL_OUTBOUND) {
            return execution.execute(request, body);
        }
        try {
            ClientHttpResponse response = execution.execute(request, body);
            outboundAuditService.recordHttpOutboundSuccess(request, body, response, SKILL_CONTEXT);
            return response;
        } catch (Exception e) {
            outboundAuditService.recordHttpOutboundFailure(request, body, e, SKILL_CONTEXT);
            if (e instanceof IOException) {
                throw (IOException) e;
            }
            throw e;
        }
    }
}
