package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import static com.eventaccess.platform.domain.Enums.PaymentStatus;

@Entity @Table(name="payments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_id") private Order order;
    @Column(nullable=false, length=50) private String provider;
    @Column(name="payment_method", nullable=false, length=30) private String paymentMethod;
    @Column(name="provider_payment_id", length=150) private String providerPaymentId;
    @Column(name="idempotency_key", nullable=false, unique=true, length=150) private String idempotencyKey;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private PaymentStatus status;
    @Column(nullable=false, precision=15, scale=2) private BigDecimal amount;
    @Column(nullable=false, length=3) private String currency;
    @Column(name="pix_copy_paste", columnDefinition="text") private String pixCopyPaste;
    @Column(name="pix_qr_code_url", length=500) private String pixQrCodeUrl;
    @Column(name="expires_at") private OffsetDateTime expiresAt;
    @Column(name="approved_at") private OffsetDateTime approvedAt;
    @Column(name="failed_at") private OffsetDateTime failedAt;
    @Column(name="refunded_at") private OffsetDateTime refundedAt;
    @Column(name="failure_reason", length=500) private String failureReason;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="provider_response", columnDefinition="jsonb") private Map<String,Object> providerResponse;
}
