package com.lobsterai.skillgateway.audit;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class ContentTypeNormalizingInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        ClientHttpResponse response = execution.execute(request, body);
        return new ContentTypeNormalizedResponse(response);
    }

    private static class ContentTypeNormalizedResponse implements ClientHttpResponse {

        private final ClientHttpResponse delegate;
        private final HttpHeaders normalizedHeaders;

        ContentTypeNormalizedResponse(ClientHttpResponse delegate) {
            this.delegate = delegate;
            this.normalizedHeaders = normalizeContentType(delegate.getHeaders());
        }

        @Override
        public HttpHeaders getHeaders() {
            return normalizedHeaders;
        }

        @Override
        public java.io.InputStream getBody() throws IOException {
            return delegate.getBody();
        }

        @Override
        public org.springframework.http.HttpStatus getStatusCode() throws IOException {
            return delegate.getStatusCode();
        }

        @Override
        public int getRawStatusCode() throws IOException {
            return delegate.getRawStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return delegate.getStatusText();
        }

        @Override
        public void close() {
            delegate.close();
        }
    }

    static HttpHeaders normalizeContentType(HttpHeaders headers) {
        List<String> contentTypeValues = headers.get(HttpHeaders.CONTENT_TYPE);
        if (contentTypeValues == null || contentTypeValues.isEmpty()) {
            return headers;
        }

        boolean anyMalformed = false;
        for (String value : contentTypeValues) {
            if (isMalformedContentType(value)) {
                anyMalformed = true;
                break;
            }
        }
        if (!anyMalformed) {
            return headers;
        }

        HttpHeaders fixed = new HttpHeaders();
        fixed.putAll(headers);
        List<String> fixedValues = contentTypeValues.stream()
                .map(ContentTypeNormalizingInterceptor::fixContentTypeComma)
                .collect(Collectors.toList());
        fixed.put(HttpHeaders.CONTENT_TYPE, fixedValues);
        return fixed;
    }

    private static boolean isMalformedContentType(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.contains(",charset=") || lower.contains(", charset=");
    }

    private static String fixContentTypeComma(String value) {
        return value.replace(",charset=", ";charset=")
                .replace(", charset=", ";charset=");
    }
}
