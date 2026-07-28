package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenHashAndUsedAtIsNull(String tokenHash);

    /**
     * Tokens ainda válidos de um usuário. Ao pedir uma nova recuperação, os
     * anteriores são invalidados: dois links vivos ao mesmo tempo dobram a
     * janela de ataque sem trazer nenhum ganho para quem esqueceu a senha.
     */
    List<PasswordResetToken> findByUserIdAndUsedAtIsNull(UUID userId);
}
