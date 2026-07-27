package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.PaymentWebhook;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PaymentWebhookRepository extends JpaRepository<PaymentWebhook, UUID> {
    Optional<PaymentWebhook> findByProviderAndProviderEventId(String provider, String providerEventId);

    @Modifying
    @Query(value = """
            INSERT INTO payment_webhooks
                (id, provider, provider_event_id, event_type, payload, signature, status, received_at, created_at)
            VALUES
                (:id, :provider, :providerEventId, :eventType, CAST(:payload AS jsonb), :signature,
                 'RECEIVED', :receivedAt, :receivedAt)
            ON CONFLICT (provider, provider_event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id,
                       @Param("provider") String provider,
                       @Param("providerEventId") String providerEventId,
                       @Param("eventType") String eventType,
                       @Param("payload") String payload,
                       @Param("signature") String signature,
                       @Param("receivedAt") OffsetDateTime receivedAt);
}
