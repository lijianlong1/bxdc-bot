package com.lobsterai.skillgateway.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PendingConfirmationStore {

    private static final long DEFAULT_EXPIRE_SECONDS = 300;

    private final ConcurrentHashMap<String, PendingConfirmation> store = new ConcurrentHashMap<>();
    private final long expireSeconds;

    public PendingConfirmationStore() {
        this.expireSeconds = DEFAULT_EXPIRE_SECONDS;
    }

    public PendingConfirmationStore(long expireSeconds) {
        this.expireSeconds = expireSeconds;
    }

    public String put(Long skillId, String skillName, Object parameters, String userId) {
        String requestId = java.util.UUID.randomUUID().toString();
        PendingConfirmation confirmation = new PendingConfirmation(
                skillId, skillName, parameters, userId, Instant.now().plusSeconds(expireSeconds)
        );
        store.put(requestId, confirmation);
        return requestId;
    }

    public PendingConfirmation getIfValid(String requestId, String userId) {
        PendingConfirmation confirmation = store.get(requestId);
        if (confirmation == null) {
            return null;
        }
        if (Instant.now().isAfter(confirmation.expiresAt)) {
            store.remove(requestId);
            return null;
        }
        if (confirmation.userId != null && !confirmation.userId.equals(userId)) {
            return null;
        }
        return confirmation;
    }

    public void remove(String requestId) {
        store.remove(requestId);
    }

    @Scheduled(fixedRate = 60000)
    public void cleanExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt));
    }

    public static class PendingConfirmation {
        public final Long skillId;
        public final String skillName;
        public final Object parameters;
        public final String userId;
        public final Instant expiresAt;

        PendingConfirmation(Long skillId, String skillName, Object parameters, String userId, Instant expiresAt) {
            this.skillId = skillId;
            this.skillName = skillName;
            this.parameters = parameters;
            this.userId = userId;
            this.expiresAt = expiresAt;
        }
    }
}
