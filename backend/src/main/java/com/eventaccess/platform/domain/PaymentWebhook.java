package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;

@Entity
@Table(name = "payment_webhooks", uniqueConstraints = @UniqueConstraint(columnNames = {"provider", "provider_event_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentWebhook extends BaseEntity {
    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "provider_event_id", nullable = false, length = 150)
    private String providerEventId;

    @Column(name = "event_type", length = 100)
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(length = 500)
    private String signature;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;
}
