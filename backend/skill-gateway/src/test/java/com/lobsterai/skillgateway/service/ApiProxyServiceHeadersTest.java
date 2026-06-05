package com.lobsterai.skillgateway.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.util.List;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiProxyServiceHeadersTest {

    @Test
    void applyOutboundHeaders_acceptsStringValues() {
        HttpHeaders h = new HttpHeaders();
        ApiProxyService.applyOutboundHeaders(h, new HashMap<String, Object>() {{
            put("Origin", "http://a.example");
            put("X-Api-Key", "k");
        }});
        assertEquals("http://a.example", h.getFirst("Origin"));
        assertEquals("k", h.getFirst("X-Api-Key"));
    }

    @Test
    void applyOutboundHeaders_acceptsJsonArraySingleElement() {
        HttpHeaders h = new HttpHeaders();
        ApiProxyService.applyOutboundHeaders(h, Collections.singletonMap("Origin", Arrays.asList("http://brdp.cs.iicbc")));
        assertEquals("http://brdp.cs.iicbc", h.getFirst("Origin"));
    }

    @Test
    void applyOutboundHeaders_acceptsJsonArrayMultiple() {
        HttpHeaders h = new HttpHeaders();
        ApiProxyService.applyOutboundHeaders(h, Collections.singletonMap("Accept", Arrays.asList("application/json", "application/*+json")));
        List<String> vals = h.getOrEmpty("Accept");
        assertTrue(vals.contains("application/json"));
        assertTrue(vals.contains("application/*+json"));
    }
}
