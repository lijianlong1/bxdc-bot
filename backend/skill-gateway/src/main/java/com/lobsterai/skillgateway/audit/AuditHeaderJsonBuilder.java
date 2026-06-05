package com.lobsterai.skillgateway.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;

import java.util.*;

public final class AuditHeaderJsonBuilder {

    private static final Set<String> DEFAULT_REDACT = new HashSet<>(Arrays.asList(
            "authorization", "cookie", "set-cookie", "x-agent-token"
    ));

    private AuditHeaderJsonBuilder() {
    }

    public static String toJson(HttpServletRequest request, Collection<String> extraRedact, ObjectMapper mapper) {
        if (request == null) {
            return null;
        }
        Set<String> redact = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        redact.addAll(DEFAULT_REDACT);
        if (extraRedact != null) {
            for (String h : extraRedact) {
                if (h != null && !StringUtils.isBlank(h)) {
                    redact.add(h.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        Map<String, List<String>> out = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names == null) {
            return write(mapper, out);
        }
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            if (name == null) {
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            Enumeration<String> vals = request.getHeaders(name);
            List<String> list = new ArrayList<>();
            while (vals != null && vals.hasMoreElements()) {
                String v = vals.nextElement();
                if (redact.contains(key)) {
                    list.add("[REDACTED]");
                } else {
                    list.add(v);
                }
            }
            out.put(name, list);
        }
        return write(mapper, out);
    }

    /** For outbound/response {@link HttpHeaders} (e.g. from {@link org.springframework.http.client.ClientHttpResponse}). */
    public static String toJson(HttpHeaders headers, Collection<String> extraRedact, ObjectMapper mapper) {
        if (headers == null) {
            return null;
        }
        Set<String> redact = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        redact.addAll(DEFAULT_REDACT);
        if (extraRedact != null) {
            for (String h : extraRedact) {
                if (h != null && !StringUtils.isBlank(h)) {
                    redact.add(h.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (String name : headers.keySet()) {
            if (name == null) {
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            List<String> list = new ArrayList<>();
            for (String v : headers.getOrEmpty(name)) {
                if (redact.contains(key)) {
                    list.add("[REDACTED]");
                } else {
                    list.add(v);
                }
            }
            out.put(name, list);
        }
        return write(mapper, out);
    }

    public static String toJson(HttpRequest request, Collection<String> extraRedact, ObjectMapper mapper) {
        if (request == null) {
            return null;
        }
        Set<String> redact = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        redact.addAll(DEFAULT_REDACT);
        if (extraRedact != null) {
            for (String h : extraRedact) {
                if (h != null && !StringUtils.isBlank(h)) {
                    redact.add(h.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (String name : request.getHeaders().keySet()) {
            if (name == null) {
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            List<String> list = new ArrayList<>();
            for (String v : request.getHeaders().getOrEmpty(name)) {
                if (redact.contains(key)) {
                    list.add("[REDACTED]");
                } else {
                    list.add(v);
                }
            }
            out.put(name, list);
        }
        return write(mapper, out);
    }

    private static String write(ObjectMapper mapper, Map<String, List<String>> out) {
        try {
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            return "{}";
        }
    }
}
