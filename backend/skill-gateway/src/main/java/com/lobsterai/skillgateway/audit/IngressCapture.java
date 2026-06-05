package com.lobsterai.skillgateway.audit;

import java.util.Arrays;
import java.util.Objects;

public final class IngressCapture {
    private final boolean incomplete;
    private final String headersJson;
    private final byte[] body;
    private final boolean bodyTruncated;
    private final String bodySha256;

    public IngressCapture(boolean incomplete, String headersJson, byte[] body, boolean bodyTruncated, String bodySha256) {
        this.incomplete = incomplete;
        this.headersJson = headersJson;
        this.body = body;
        this.bodyTruncated = bodyTruncated;
        this.bodySha256 = bodySha256;
    }

    public static IngressCapture missing() {
        return new IngressCapture(true, null, null, false, null);
    }

    public boolean incomplete() { return incomplete; }
    public String headersJson() { return headersJson; }
    public byte[] body() { return body; }
    public boolean bodyTruncated() { return bodyTruncated; }
    public String bodySha256() { return bodySha256; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof IngressCapture)) return false;
        IngressCapture that = (IngressCapture) o;
        return incomplete == that.incomplete &&
                bodyTruncated == that.bodyTruncated &&
                Objects.equals(headersJson, that.headersJson) &&
                Arrays.equals(body, that.body) &&
                Objects.equals(bodySha256, that.bodySha256);
    }

    @Override
    public int hashCode() {
        int result = Objects.hash(incomplete, headersJson, bodyTruncated, bodySha256);
        result = 31 * result + Arrays.hashCode(body);
        return result;
    }

    @Override
    public String toString() {
        return "IngressCapture[incomplete=" + incomplete + ", headersJson=" + headersJson +
                ", body=" + Arrays.toString(body) + ", bodyTruncated=" + bodyTruncated +
                ", bodySha256=" + bodySha256 + "]";
    }
}
