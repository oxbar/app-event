package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="access_points")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccessPoint extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="event_id") private Event event;
    @Column(nullable=false, length=100) private String name;
    @Column(length=300) private String description;
    @Column(nullable=false, length=30) private String status;
}
