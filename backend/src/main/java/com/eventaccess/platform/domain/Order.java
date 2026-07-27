package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.*;

@Entity @Table(name="orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="organization_id") private Organization organization;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="event_id") private Event event;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="buyer_attendee_id") private Attendee buyer;
    @Column(name="public_code", nullable=false, unique=true, length=30) private String publicCode;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private OrderStatus status;
    @Column(nullable=false, precision=15, scale=2) private BigDecimal subtotal;
    @Column(name="service_fee", nullable=false, precision=15, scale=2) private BigDecimal serviceFee;
    @Column(name="discount_amount", nullable=false, precision=15, scale=2) private BigDecimal discountAmount;
    @Column(name="total_amount", nullable=false, precision=15, scale=2) private BigDecimal totalAmount;
    @Column(nullable=false, length=3) private String currency;
    @Column(name="expires_at") private OffsetDateTime expiresAt;
    @Column(name="paid_at") private OffsetDateTime paidAt;
    @Column(name="canceled_at") private OffsetDateTime canceledAt;
    @Column(name="refunded_at") private OffsetDateTime refundedAt;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private OrderSource source;
}
