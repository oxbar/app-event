package com.eventaccess.platform.service;

import com.eventaccess.platform.repository.PaymentWebhookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class PaymentWebhookStoreService {
    private final PaymentWebhookRepository webhooks;

    public PaymentWebhookStoreService(PaymentWebhookRepository webhooks) {
        this.webhooks = webhooks;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<UUID> register(String provider, String eventId, String eventType,
                                   String rawPayload, String signature) {
        OffsetDateTime now = OffsetDateTime.now();
        UUID id = UUID.randomUUID();
        int inserted = webhooks.insertIfAbsent(id, provider, eventId, eventType, rawPayload, signature, now);
        return inserted == 1 ? Optional.of(id) : Optional.empty();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void mark(UUID id, String status, String errorMessage) {
        webhooks.findById(id).ifPresent(webhook -> {
            webhook.setStatus(status);
            webhook.setErrorMessage(errorMessage);
            if ("PROCESSED".equals(status) || "IGNORED".equals(status) || "FAILED".equals(status)) {
                webhook.setProcessedAt(OffsetDateTime.now());
            }
        });
    }
}
