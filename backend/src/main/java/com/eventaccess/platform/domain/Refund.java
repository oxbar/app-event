package com.eventaccess.platform.domain;

import com.eventaccess.platform.domain.Enums.RefundStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

@Entity
@Table(name = "refunds")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Refund extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payment_id")
    private Payment payment;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id")
    private Order order;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "requested_by_user_id")
    private UserAccount requestedBy;
    @Column(name = "provider_refund_id", length = 150) private String providerRefundId;
    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(length = 500) private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private RefundStatus status;
    @Column(name = "requested_at", nullable = false) private OffsetDateTime requestedAt;
    @Column(name = "processed_at") private OffsetDateTime processedAt;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "provider_response", columnDefinition = "jsonb")
    private Map<String, Object> providerResponse;
}
