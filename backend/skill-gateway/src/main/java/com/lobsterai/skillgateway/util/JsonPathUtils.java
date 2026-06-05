package com.lobsterai.skillgateway.util;

import java.util.List;
import java.util.Map;

/**
 * Simple dot-notation JSON path utility (no $ prefix, no bracket syntax).
 * Shared by async polling and enum-source proxy.
 */
public final class JsonPathUtils {

    private JsonPathUtils() {}

    /**
     * Navigate a parsed JSON tree by dot-separated path (e.g. "data.items").
     * Returns the raw Object at that path, or null.
     */
    @SuppressWarnings("unchecked")
    public static Object extractValueByPath(Object obj, String path) {
        if (obj == null || path == null || StringUtils.isBlank(path)) return null;
        String[] segments = path.split("\\.");
        Object current = obj;
        for (String segment : segments) {
            if (current == null) return null;
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(segment);
            } else if (current instanceof List) {
                try {
                    int index = Integer.parseInt(segment);
                    List<Object> list = (List<Object>) current;
                    if (index >= 0 && index < list.size()) {
                        current = list.get(index);
                    } else {
                        return null;
                    }
                } catch (NumberFormatException e) {
                    return null;
                }
            } else {
                return null;
            }
        }
        return current;
    }
}
