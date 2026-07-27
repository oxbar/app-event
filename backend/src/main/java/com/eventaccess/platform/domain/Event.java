package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.EventStatus;

@Entity @Table(name="events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Event extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="organization_id") private Organization organization;
    @Column(nullable=false, length=200) private String name;
    @Column(nullable=false, length=150) private String slug;
    @Column(columnDefinition="text") private String description;
    @Column(name="venue_name", length=200) private String venueName;
    @Column(length=300) private String address;
    @Column(length=100) private String city;
    @Column(length=50) private String state;
    @Column(length=50) private String country;
    @Column(name="starts_at", nullable=false) private OffsetDateTime startsAt;
    @Column(name="ends_at", nullable=false) private OffsetDateTime endsAt;
    @Column(name="sales_start_at") private OffsetDateTime salesStartAt;
    @Column(name="sales_end_at") private OffsetDateTime salesEndAt;
    private Integer capacity;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private EventStatus status;
    @Column(name="banner_url", length=500) private String bannerUrl;
    @Column(name="require_document", nullable=false) private boolean requireDocument;
    @Column(name="allow_manual_checkin", nullable=false) private boolean allowManualCheckin;
    @Column(name="terms_url", length=500) private String termsUrl;
}
