package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.PasswordResetToken;
import com.eventaccess.platform.repository.PasswordResetTokenRepository;
import com.eventaccess.platform.repository.RefreshTokenRepository;
import com.eventaccess.platform.repository.UserRepository;
import com.eventaccess.platform.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;

@Service
public class PasswordResetService {
    private static final String GENERIC_MESSAGE =
            "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.";

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final CryptoService crypto;
    private final PasswordResetMailService mail;
    private final String environment;

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
                                RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                                CryptoService crypto, PasswordResetMailService mail,
                                @Value("${app.environment}") String environment) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.crypto = crypto;
        this.mail = mail;
        this.environment = environment;
    }

    @Transactional
    public ForgotResult forgot(String email) {
        var user = users.findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT));
        if (user.isEmpty()) return new ForgotResult(GENERIC_MESSAGE, null);

        OffsetDateTime now = OffsetDateTime.now();
        tokens.findByUserIdAndUsedAtIsNull(user.get().getId()).forEach(active -> active.setUsedAt(now));

        String rawToken = crypto.randomToken();
        tokens.save(PasswordResetToken.builder()
                .user(user.get())
                .tokenHash(crypto.sha256(rawToken))
                .expiresAt(now.plusMinutes(30))
                .build());
        mail.send(user.get(), rawToken);

        return new ForgotResult(GENERIC_MESSAGE,
                "development".equalsIgnoreCase(environment) ? rawToken : null);
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        PasswordResetToken token = tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256(rawToken.trim()))
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
