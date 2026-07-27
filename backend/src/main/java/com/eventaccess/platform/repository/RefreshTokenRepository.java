package com.eventaccess.platform.repository;
import com.eventaccess.platform.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHashAndRevokedAtIsNull(String hash);
    List<RefreshToken> findByUserIdAndRevokedAtIsNull(UUID userId);
}
