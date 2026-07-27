package com.eventaccess.platform.domain;

import com.eventaccess.platform.domain.Enums.Role;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "event_staff")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventStaff extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id")
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_point_id")
    private AccessPoint accessPoint;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role;

    @Column(nullable = false, length = 30)
    private String status;
}
