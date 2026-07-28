package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.PasswordResetToken;
import com.eventaccess.platform.domain.UserAccount;
import com.eventaccess.platform.mail.MailMessage;
import com.eventaccess.platform.mail.MailService;
import com.eventaccess.platform.mail.MailTemplates;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Recuperação de senha ponta a ponta.
 *
 * <p>Regras que valem a leitura antes de mexer aqui:</p>
 * <ul>
 *   <li>A resposta é sempre a mesma, exista ou não a conta. Diferenciar as duas
 *       situações transformaria o endpoint em um verificador de e-mails.</li>
 *   <li>O token trafega apenas no e-mail; no banco fica somente o hash SHA-256.</li>
 *   <li>Um novo pedido invalida os links anteriores do mesmo usuário.</li>
 *   <li>Há limite de pedidos por e-mail dentro de uma janela, para que a caixa
 *       de entrada de terceiros não vire alvo de flood.</li>
 *   <li>Ao concluir a troca, todas as sessões (refresh tokens) caem e o usuário
 *       recebe um aviso — é assim que uma invasão fica visível.</li>
 * </ul>
 */
@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final String GENERIC_MESSAGE =
            "Se o e-mail existir, enviaremos as instruções de recuperação em instantes.";

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final CryptoService crypto;
    private final MailService mail;
    private final String environment;
    private final String baseUrl;
    private final long tokenTtlMinutes;
    private final int maxRequestsPerWindow;
    private final long windowMinutes;

    private final Map<String, Deque<Instant>> requestHistory = new ConcurrentHashMap<>();
    private Clock clock = Clock.systemDefaultZone();

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
                                RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                                CryptoService crypto, MailService mail,
                                @Value("${app.environment}") String environment,
                                @Value("${app.base-url}") String baseUrl,
                                @Value("${app.password-reset.token-ttl-minutes:30}") long tokenTtlMinutes,
                                @Value("${app.password-reset.max-requests-per-window:3}") int maxRequestsPerWindow,
                                @Value("${app.password-reset.window-minutes:15}") long windowMinutes) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.crypto = crypto;
        this.mail = mail;
        this.environment = environment;
        this.baseUrl = baseUrl;
        this.tokenTtlMinutes = tokenTtlMinutes;
        this.maxRequestsPerWindow = maxRequestsPerWindow;
        this.windowMinutes = windowMinutes;
    }

    /** Ponto de injeção usado apenas pelos testes para controlar a janela de tempo. */
    void useClock(Clock clock) {
        this.clock = clock;
    }

    @Transactional
    public ForgotResult forgot(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        Optional<UserAccount> found = users.findByEmailIgnoreCase(normalized);
        if (found.isEmpty()) {
            log.info("Recuperação de senha solicitada para e-mail desconhecido.");
            return generic(null, false);
        }
        if (!allowRequest(normalized)) {
            log.warn("Recuperação de senha bloqueada por excesso de pedidos para o mesmo e-mail.");
            return generic(null, false);
        }

        UserAccount user = found.get();
        // Um pedido novo aposenta os anteriores.
        tokens.findByUserIdAndUsedAtIsNull(user.getId()).forEach(previous -> {
            previous.setUsedAt(now());
            tokens.save(previous);
        });

        String rawToken = crypto.randomToken();
        tokens.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(crypto.sha256(rawToken))
                .expiresAt(now().plusMinutes(tokenTtlMinutes))
                .build());

        MailMessage message = MailTemplates.passwordReset(user.getEmail(), user.getName(),
                resetUrl(rawToken), tokenTtlMinutes);
        boolean delivered = mail.send(message);

        return new ForgotResult(GENERIC_MESSAGE, developmentToken(rawToken), tokenTtlMinutes, delivered);
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        PasswordResetToken token = tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256(rawToken))
                .orElseThrow(PasswordResetService::invalidToken);
        if (token.getExpiresAt().isBefore(now())) {
            throw invalidToken();
        }

        UserAccount user = token.getUser();
        user.setPasswordHash(encoder.encode(newPassword));
        token.setUsedAt(now());
        tokens.save(token);

        // A troca de senha derruba tudo o que estava aberto em outros dispositivos.
        refreshTokens.findByUserIdAndRevokedAtIsNull(user.getId()).forEach(refresh -> {
            refresh.setRevokedAt(now());
            refreshTokens.save(refresh);
        });
        requestHistory.remove(user.getEmail().toLowerCase(Locale.ROOT));

        mail.send(MailTemplates.passwordChanged(user.getEmail(), user.getName(),
                trimTrailingSlash(baseUrl) + "/forgot-password"));
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESET_TOKEN",
                "Token de recuperação inválido ou expirado.");
    }

    private ForgotResult generic(String rawToken, boolean delivered) {
        return new ForgotResult(GENERIC_MESSAGE, developmentToken(rawToken), tokenTtlMinutes, delivered);
    }

    private String developmentToken(String rawToken) {
        return "development".equalsIgnoreCase(environment) ? rawToken : null;
    }

    private String resetUrl(String rawToken) {
        return trimTrailingSlash(baseUrl) + "/reset-password?token="
                + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
    }

    private static String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private boolean allowRequest(String email) {
        if (maxRequestsPerWindow <= 0) return true;
        Instant reference = clock.instant();
        Duration window = Duration.ofMinutes(windowMinutes);
        Deque<Instant> history = requestHistory.computeIfAbsent(email, key -> new ArrayDeque<>());
        synchronized (history) {
            while (!history.isEmpty() && Duration.between(history.peekFirst(), reference).compareTo(window) > 0) {
                history.pollFirst();
            }
            if (history.size() >= maxRequestsPerWindow) return false;
            history.addLast(reference);
            return true;
        }
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    /**
     * @param message           texto genérico exibido ao usuário
     * @param developmentToken  token exposto apenas em ambiente de desenvolvimento
     * @param expiresInMinutes  validade do link, para a interface informar o prazo
     * @param emailSent         se a mensagem chegou ao servidor SMTP
     */
    public record ForgotResult(String message, String developmentToken, long expiresInMinutes, boolean emailSent) {}
}
