package com.lobsterai.skillgateway.config;

import com.lobsterai.skillgateway.audit.ContentTypeNormalizingInterceptor;
import com.lobsterai.skillgateway.audit.GatewayHttpClientAuditInterceptor;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@Configuration
public class SkillGatewayHttpClientConfig {

    @Bean
    public RestTemplate gatewayRestTemplate(
            GatewayHttpClientAuditInterceptor auditInterceptor,
            ContentTypeNormalizingInterceptor contentTypeInterceptor
    ) {
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(50);
        connectionManager.setDefaultMaxPerRoute(20);
        org.apache.http.client.HttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .build();
        ClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(httpClient);
        BufferingClientHttpRequestFactory buffering = new BufferingClientHttpRequestFactory(factory);
        RestTemplate restTemplate = new RestTemplate(buffering);
        restTemplate.setInterceptors(Arrays.asList(contentTypeInterceptor, auditInterceptor));
        return restTemplate;
    }
}
