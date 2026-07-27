package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.CheckinResult;

@Entity @Table(name="checkins")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Checkin extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="event_id") private Event event;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="ticket_id") private Ticket ticket;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="access_point_id") private AccessPoint accessPoint;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="staff_user_id") private UserAccount staffUser;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=40) private CheckinResult result;
    @Column(name="scanned_token_hash", length=255) private String scannedTokenHash;
    @Column(name="device_identifier", length=150) private String deviceIdentifier;
    @Column(name="ip_address", length=45) private String ipAddress;
    @Column(precision=10, scale=7) private BigDecimal latitude;
    @Column(precision=10, scale=7) private BigDecimal longitude;
    @Column(length=500) private String reason;
    @Column(name="scanned_at", nullable=false) private OffsetDateTime scannedAt;
}
