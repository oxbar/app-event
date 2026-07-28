package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenHashAndUsedAtIsNull(String tokenHash);
    List<PasswordResetToken> findByUserIdAndUsedAtIsNull(UUID userId);
}
