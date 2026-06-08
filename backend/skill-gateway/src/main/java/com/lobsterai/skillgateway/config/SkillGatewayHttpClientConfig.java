package com.lobsterai.skillgateway.config;

import com.lobsterai.skillgateway.audit.ContentTypeNormalizingInterceptor;
import com.lobsterai.skillgateway.audit.GatewayHttpClientAuditInterceptor;
import org.apache.http.conn.routing.HttpRoutePlanner;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.apache.http.impl.conn.SystemDefaultRoutePlanner;

import java.net.ProxySelector;
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
        // Explicitly disable proxy to avoid SOCKS proxy connection errors
        HttpRoutePlanner noProxyRoutePlanner = new SystemDefaultRoutePlanner(ProxySelector.of(null));
        org.apache.http.client.HttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setRoutePlanner(noProxyRoutePlanner)
                .build();
        ClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(httpClient);
        BufferingClientHttpRequestFactory buffering = new BufferingClientHttpRequestFactory(factory);
        RestTemplate restTemplate = new RestTemplate(buffering);
        restTemplate.setInterceptors(Arrays.asList(contentTypeInterceptor, auditInterceptor));
        return restTemplate;
    }
}
