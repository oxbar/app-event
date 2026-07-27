package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Table(name="order_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderItem extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_id") private Order order;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="ticket_type_id") private TicketType ticketType;
    @Column(nullable=false) private int quantity;
    @Column(name="unit_price", nullable=false, precision=15, scale=2) private BigDecimal unitPrice;
    @Column(name="service_fee_unit", nullable=false, precision=15, scale=2) private BigDecimal serviceFeeUnit;
    @Column(name="discount_amount", nullable=false, precision=15, scale=2) private BigDecimal discountAmount;
    @Column(name="total_amount", nullable=false, precision=15, scale=2) private BigDecimal totalAmount;
}
