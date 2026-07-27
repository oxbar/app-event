package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.TicketTypeStatus;

@Entity @Table(name="ticket_types")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TicketType extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="event_id") private Event event;
    @Column(nullable=false, length=100) private String name;
    @Column(columnDefinition="text") private String description;
    @Column(nullable=false, length=50) private String category;
    @Column(nullable=false, precision=15, scale=2) private BigDecimal price;
    @Column(name="service_fee", nullable=false, precision=15, scale=2) private BigDecimal serviceFee;
    @Column(name="total_quantity", nullable=false) private int totalQuantity;
    @Column(name="sold_quantity", nullable=false) private int soldQuantity;
    @Column(name="reserved_quantity", nullable=false) private int reservedQuantity;
    @Column(name="max_per_order", nullable=false) private int maxPerOrder;
    @Column(name="wristband_label", length=100) private String wristbandLabel;
    @Column(name="wristband_color_name", length=50) private String wristbandColorName;
    @Column(name="wristband_color_hex", length=7) private String wristbandColorHex;
    @Column(name="sales_start_at") private OffsetDateTime salesStartAt;
    @Column(name="sales_end_at") private OffsetDateTime salesEndAt;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private TicketTypeStatus status;
    @Column(name="sort_order", nullable=false) private int sortOrder;
}
