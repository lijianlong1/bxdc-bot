package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.audit.ContentTypeNormalizingInterceptor;
import com.lobsterai.skillgateway.audit.GatewayHttpClientAuditInterceptor;
import com.lobsterai.skillgateway.audit.HttpClientAuditContext;
import com.lobsterai.skillgateway.audit.HttpClientAuditMode;
import com.lobsterai.skillgateway.http.OutboundUrlNormalizer;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Array;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * API 代理服务：封装 {@link RestTemplate}，供 Skill 对外 HTTP 与内部 HTTP 调用共用。
 */
@Service
public class ApiProxyService {

    private final RestTemplate gatewayRestTemplate;
    private final ObjectMapper objectMapper;
    private final GatewayHttpClientAuditInterceptor auditInterceptor;
    private final ContentTypeNormalizingInterceptor contentTypeInterceptor;

    public ApiProxyService(
            RestTemplate gatewayRestTemplate,
            ObjectMapper objectMapper,
            GatewayHttpClientAuditInterceptor auditInterceptor,
            ContentTypeNormalizingInterceptor contentTypeInterceptor
    ) {
        this.gatewayRestTemplate = gatewayRestTemplate;
        this.objectMapper = objectMapper;
        this.auditInterceptor = auditInterceptor;
        this.contentTypeInterceptor = contentTypeInterceptor;
    }

    public Object callApi(String url, String method, Map<String, ?> headers, Object body) {
        return callApi(url, method, headers, body, HttpClientAuditMode.NONE);
    }

    public Object callApi(
            String url,
            String method,
            Map<String, ?> headers,
            Object body,
            HttpClientAuditMode mode
    ) {
            HttpClientAuditContext.set(mode);
        try {
            String outboundUrl = OutboundUrlNormalizer.normalizeForOutboundHttp(url);
            HttpHeaders httpHeaders = new HttpHeaders();
            applyOutboundHeaders(httpHeaders, headers);
            Object normalizedBody = normalizeBodyForContentType(body, httpHeaders);
            HttpEntity<Object> entity = new HttpEntity<>(normalizedBody, httpHeaders);
            ResponseEntity<String> response = gatewayRestTemplate.exchange(
                    outboundUrl,
                    HttpMethod.valueOf(method.toUpperCase()),
                    entity,
                    String.class
            );
            return parseResponseBody(response);
        } finally {
            HttpClientAuditContext.clear();
        }
    }

    public Object callApi(String url, String method, Map<String, ?> headers, Object body, int timeoutSeconds) {
        return callApi(url, method, headers, body, HttpClientAuditMode.NONE, timeoutSeconds);
    }

    public Object callApi(
            String url,
            String method,
            Map<String, ?> headers,
            Object body,
            HttpClientAuditMode mode,
            int timeoutSeconds
    ) {
        HttpClientAuditContext.set(mode);
        try {
            String outboundUrl = OutboundUrlNormalizer.normalizeForOutboundHttp(url);
            HttpHeaders httpHeaders = new HttpHeaders();
            applyOutboundHeaders(httpHeaders, headers);
            Object normalizedBody = normalizeBodyForContentType(body, httpHeaders);
            HttpEntity<Object> entity = new HttpEntity<>(normalizedBody, httpHeaders);

            HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory();
            factory.setConnectTimeout(timeoutSeconds * 1000);
            factory.setReadTimeout(timeoutSeconds * 1000);
            BufferingClientHttpRequestFactory bufferingFactory = new BufferingClientHttpRequestFactory(factory);
            RestTemplate timedTemplate = new RestTemplate(bufferingFactory);
            timedTemplate.setInterceptors(Arrays.asList(contentTypeInterceptor, auditInterceptor));

            ResponseEntity<String> response = timedTemplate.exchange(
                    outboundUrl,
                    HttpMethod.valueOf(method.toUpperCase()),
                    entity,
                    String.class
            );
            return parseResponseBody(response);
        } finally {
            HttpClientAuditContext.clear();
        }
    }

    /**
     * {@link SkillController.ApiRequest#getHeaders()} may use string values or JSON arrays (single or multi),
     * matching OpenAPI / exported configs; each becomes one or more {@code HttpHeaders#add} calls.
     */
    static void applyOutboundHeaders(HttpHeaders target, Map<String, ?> headers) {
        if (headers == null || target == null) {
            return;
        }
        for (Map.Entry<String, ?> e : headers.entrySet()) {
            if (e.getKey() == null) {
                continue;
            }
            String name = e.getKey();
            addHeaderValue(target, name, e.getValue());
        }
    }

    private static void addHeaderValue(HttpHeaders target, String name, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof String) {
            target.add(name, (String) value);
        } else if (value instanceof Collection) {
            @SuppressWarnings("unchecked")
            Collection<Object> c = (Collection<Object>) value;
            for (Object o : c) {
                if (o != null) {
                    target.add(name, o.toString());
                }
            }
        } else if (value.getClass().isArray()) {
            int n = Array.getLength(value);
            for (int i = 0; i < n; i++) {
                Object o = Array.get(value, i);
                if (o != null) {
                    target.add(name, o.toString());
                }
            }
        } else {
            target.add(name, value.toString());
        }
    }

    /**
     * Prevents RestTemplate from wrapping a JSON string body as a JSON string value
     * when Content-Type is application/json (double-quote escaping bug).
     * Also recursively parses object/array values that arrive as JSON strings
     * (e.g. {@code "data":"{\"app\":\"...\"}"} → {@code "data":{...}}).
     */
    private Object normalizeBodyForContentType(Object body, HttpHeaders httpHeaders) {
        MediaType contentType = httpHeaders.getContentType();
        boolean isJsonType = contentType != null && MediaType.APPLICATION_JSON.includes(contentType);
        boolean isFormType = contentType != null && MediaType.APPLICATION_FORM_URLENCODED.includes(contentType);

        // When Content-Type is form-urlencoded but body is a Map, encode it as form-urlencoded string
        if (isFormType && body instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) body;
            return encodeMapToFormUrlEncoded(map);
        }

        return deepNormalize(body, isJsonType);
    }

    /** Encode a flat Map to application/x-www-form-urlencoded string. */
    private String encodeMapToFormUrlEncoded(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (entry.getValue() == null) continue;
            if (!first) sb.append('&');
            try {
                sb.append(java.net.URLEncoder.encode(entry.getKey(), "UTF-8"));
                sb.append('=');
                sb.append(java.net.URLEncoder.encode(String.valueOf(entry.getValue()), "UTF-8"));
            } catch (java.io.UnsupportedEncodingException e) {
                // UTF-8 is always supported
            }
            first = false;
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Object deepNormalize(Object node, boolean isJsonType) {
        if (node instanceof String) {
            String s = ((String) node).trim();
            if (s.isEmpty()) return node;
            if (isJsonType && (s.startsWith("{") || s.startsWith("["))) {
                try {
                    return objectMapper.readValue(s, Object.class);
                } catch (Exception ignored) {
                }
            }
            return node;
        }
        if (node instanceof Map) {
            Map<String, Object> map = (Map<String, Object>) node;
            for (Map.Entry<String, Object> e : map.entrySet()) {
                e.setValue(deepNormalize(e.getValue(), isJsonType));
            }
            return map;
        }
        if (node instanceof List) {
            List<Object> list = (List<Object>) node;
            for (int i = 0; i < list.size(); i++) {
                list.set(i, deepNormalize(list.get(i), isJsonType));
            }
            return list;
        }
        return node;
    }

    private Object parseResponseBody(ResponseEntity<String> response) {
        String responseBody = response.getBody();
        if (responseBody == null) {
            return null;
        }
        MediaType contentType = response.getHeaders().getContentType();
        if (contentType != null && (
                MediaType.APPLICATION_JSON.includes(contentType)
                        || contentType.getSubtype().toLowerCase().contains("json")
        )) {
            try {
                return objectMapper.readValue(responseBody, Object.class);
            } catch (Exception ignored) {
            }
        }
        return responseBody;
    }
}
