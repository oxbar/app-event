package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.TicketStatus;

@Entity @Table(name="tickets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Ticket extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="event_id") private Event event;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="ticket_type_id") private TicketType ticketType;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_id") private Order order;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_item_id") private OrderItem orderItem;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="attendee_id") private Attendee attendee;
    @Column(name="public_code", nullable=false, unique=true, length=40) private String publicCode;
    @Column(name="qr_token_hash", nullable=false, unique=true, length=255) private String qrTokenHash;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private TicketStatus status;
    @Column(name="issued_at") private OffsetDateTime issuedAt;
    @Column(name="valid_from") private OffsetDateTime validFrom;
    @Column(name="valid_until") private OffsetDateTime validUntil;
    @Column(name="checked_in_at") private OffsetDateTime checkedInAt;
    @Column(name="blocked_at") private OffsetDateTime blockedAt;
    @Column(name="block_reason", length=500) private String blockReason;
    @Column(name="canceled_at") private OffsetDateTime canceledAt;
    @Version @Column(nullable=false) private long version;
}
