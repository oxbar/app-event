package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import static com.eventaccess.platform.domain.Enums.UserStatus;

@Entity @Table(name="users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAccount extends BaseEntity {
    @Column(nullable=false, length=150) private String name;
    @Column(nullable=false, unique=true, length=150) private String email;
    @Column(length=30) private String phone;
    @Column(name="password_hash", nullable=false, length=255) private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private UserStatus status;
    @Column(name="last_login_at") private OffsetDateTime lastLoginAt;
}
