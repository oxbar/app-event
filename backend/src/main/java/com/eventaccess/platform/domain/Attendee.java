package com.eventaccess.platform.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name="attendees")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Attendee extends BaseEntity {
    @Column(nullable=false, length=150) private String name;
    @Column(length=150) private String email;
    @Column(length=30) private String phone;
    @Column(name="document_type", length=20) private String documentType;
    @Column(name="document_number_encrypted", columnDefinition="text") private String documentNumberEncrypted;
    @Column(name="document_number_hash", length=255) private String documentNumberHash;
    @Column(name="birth_date") private LocalDate birthDate;
    @Column(name="accepted_terms_at") private OffsetDateTime acceptedTermsAt;
    @Column(name="accepted_privacy_at") private OffsetDateTime acceptedPrivacyAt;
}
