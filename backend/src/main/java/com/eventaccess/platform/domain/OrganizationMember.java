package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import static com.eventaccess.platform.domain.Enums.Role;

@Entity @Table(name="organization_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrganizationMember extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="organization_id") private Organization organization;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="user_id") private UserAccount user;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private Role role;
    @Column(nullable=false, length=30) private String status;
}
