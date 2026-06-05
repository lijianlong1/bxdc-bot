package com.lobsterai.skillgateway.http;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OutboundUrlNormalizerTest {

    @Test
    void doubleEncodedUtf8QueryCollapsesToSingleLayer() {
        String in = "https://example.com/api?q=%25E4%25B8%25AD";
        String out = OutboundUrlNormalizer.normalizeForOutboundHttp(in);
        assertFalse(out.contains("%25"), "should not keep percent-encoded percent");
        assertTrue(out.contains("%E4%B8%AD") || out.contains("q=%E4%B8%AD"), out);
    }

    @Test
    void singleEncodedQueryStaysValid() {
        String in = "https://example.com/api?q=%E4%B8%AD";
        String out = OutboundUrlNormalizer.normalizeForOutboundHttp(in);
        assertTrue(out.startsWith("https://example.com/api"));
        assertTrue(out.contains("q=%E4%B8%AD") || out.endsWith("%E4%B8%AD"), out);
    }

    @Test
    void nonHttpReturnedAsTrimmed() {
        assertEquals("ftp://x", OutboundUrlNormalizer.normalizeForOutboundHttp("ftp://x"));
    }

    @Test
    void blankUnchanged() {
        assertEquals(null, OutboundUrlNormalizer.normalizeForOutboundHttp(null));
        assertEquals("", OutboundUrlNormalizer.normalizeForOutboundHttp(""));
    }

    @Test
    void pathSegmentDoubleEncoded() {
        String in = "https://example.com/v1/%25E4%25B8%25AD/items";
        String out = OutboundUrlNormalizer.normalizeForOutboundHttp(in);
        assertFalse(out.contains("%25E4"), out);
    }
}
