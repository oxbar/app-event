package com.eventaccess.platform.domain;

import com.eventaccess.platform.domain.Enums.InvitationStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "invitations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invitation extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "event_id")
    private Event event;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "ticket_type_id")
    private TicketType ticketType;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "attendee_id")
    private Attendee attendee;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "invited_by_user_id")
    private UserAccount invitedBy;
    @Column(nullable = false, unique = true, length = 50)
    private String code;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    private InvitationStatus status;
    @Column(name = "expires_at") private OffsetDateTime expiresAt;
    @Column(name = "accepted_at") private OffsetDateTime acceptedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "converted_order_id")
    private Order convertedOrder;
}
