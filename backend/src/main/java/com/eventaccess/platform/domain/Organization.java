package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import static com.eventaccess.platform.domain.Enums.OrganizationStatus;

@Entity @Table(name="organizations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Organization extends BaseEntity {
    @Column(nullable=false, length=150) private String name;
    @Column(name="legal_name", length=200) private String legalName;
    @Column(name="document_number", length=20) private String documentNumber;
    @Column(length=150) private String email;
    @Column(length=30) private String phone;
    @Column(nullable=false, unique=true, length=100) private String slug;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private OrganizationStatus status;
    @Column(name="logo_url", length=500) private String logoUrl;
    @Column(name="primary_color", length=7) private String primaryColor;
    @Column(nullable=false, length=50) private String timezone;
}
