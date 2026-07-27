package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.PasswordResetToken;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class PasswordResetService {
    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final CryptoService crypto;
    private final String environment;

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
                                RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                                CryptoService crypto, @Value("${app.environment}") String environment) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.crypto = crypto;
        this.environment = environment;
    }

    @Transactional
    public ForgotResult forgot(String email) {
        var user = users.findByEmailIgnoreCase(email);
        if (user.isEmpty()) return new ForgotResult("Se o e-mail existir, as instruções serão enviadas.", null);
        String rawToken = crypto.randomToken();
        tokens.save(PasswordResetToken.builder()
                .user(user.get())
                .tokenHash(crypto.sha256(rawToken))
                .expiresAt(OffsetDateTime.now().plusMinutes(30))
                .build());
        return new ForgotResult("Se o e-mail existir, as instruções serão enviadas.",
                "development".equalsIgnoreCase(environment) ? rawToken : null);
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        PasswordResetToken token = tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256(rawToken))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESET_TOKEN",
                        "Token de recuperação inválido ou expirado."));
        if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESET_TOKEN",
                    "Token de recuperação inválido ou expirado.");
        }
        token.getUser().setPasswordHash(encoder.encode(newPassword));
        token.setUsedAt(OffsetDateTime.now());
        refreshTokens.findByUserIdAndRevokedAtIsNull(token.getUser().getId()).forEach(refresh -> {
            refresh.setRevokedAt(OffsetDateTime.now());
            refreshTokens.save(refresh);
        });
    }

    public record ForgotResult(String message, String developmentToken) {}
}
