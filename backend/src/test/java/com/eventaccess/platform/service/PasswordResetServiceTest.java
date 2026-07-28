package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.Enums.UserStatus;
import com.eventaccess.platform.domain.PasswordResetToken;
import com.eventaccess.platform.domain.RefreshToken;
import com.eventaccess.platform.domain.UserAccount;
import com.eventaccess.platform.mail.MailProperties;
import com.eventaccess.platform.mail.MailService;
import com.eventaccess.platform.repository.PasswordResetTokenRepository;
import com.eventaccess.platform.repository.RefreshTokenRepository;
import com.eventaccess.platform.repository.UserRepository;
import com.eventaccess.platform.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Recuperação de senha vista pelo lado de quem precisa confiar nela: o token
 * nunca é armazenado em claro, o link chega por e-mail, um pedido novo derruba
 * o anterior, e concluir a troca encerra todas as sessões abertas.
 */
class PasswordResetServiceTest {
    private static final String EMAIL = "ana@eventaccess.local";

    private UserRepository users;
    private PasswordResetTokenRepository tokens;
    private RefreshTokenRepository refreshTokens;
    private MailService mail;
    private PasswordEncoder encoder;
    private CryptoService crypto;
    private PasswordResetService service;
    private UserAccount user;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        users = mock(UserRepository.class);
        tokens = mock(PasswordResetTokenRepository.class);
        refreshTokens = mock(RefreshTokenRepository.class);
        encoder = new BCryptPasswordEncoder(4);
        crypto = new CryptoService("test-qr-secret-test-qr-secret-test-qr-secret");

        MailProperties properties = new MailProperties();
        properties.setEnabled(false);
        ObjectProvider<JavaMailSender> senders = mock(ObjectProvider.class);
        when(senders.getIfAvailable()).thenReturn(null);
        mail = new MailService(senders, properties);

        user = UserAccount.builder()
                .name("Ana Souza")
                .email(EMAIL)
                .passwordHash(encoder.encode("SenhaAntiga@1"))
                .status(UserStatus.ACTIVE)
                .build();
        user.setId(UUID.randomUUID());

        when(tokens.findByUserIdAndUsedAtIsNull(any())).thenReturn(List.of());
        when(tokens.save(any(PasswordResetToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(refreshTokens.findByUserIdAndRevokedAtIsNull(any())).thenReturn(List.of());

        service = newService(30, 3, 15);
    }

    private PasswordResetService newService(long ttlMinutes, int maxRequests, long windowMinutes) {
        return new PasswordResetService(users, tokens, refreshTokens, encoder, crypto, mail,
                "development", "http://localhost:4200/", ttlMinutes, maxRequests, windowMinutes);
    }

    @Test
    @DisplayName("e-mail desconhecido recebe a mesma resposta e não gera token")
    void unknownEmailDoesNotLeak() {
        when(users.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        PasswordResetService.ForgotResult result = service.forgot("naoexiste@eventaccess.local");

        assertThat(result.message()).contains("Se o e-mail existir");
        assertThat(result.developmentToken()).isNull();
        assertThat(result.emailSent()).isFalse();
        verify(tokens, never()).save(any());
        assertThat(mail.outbox()).isEmpty();
    }

    @Test
    @DisplayName("grava apenas o hash do token e envia o link por e-mail")
    void storesHashAndSendsLink() {
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(user));

        PasswordResetService.ForgotResult result = service.forgot("  ANA@eventaccess.local ");

        assertThat(result.expiresInMinutes()).isEqualTo(30);
        String rawToken = result.developmentToken();
        assertThat(rawToken).isNotBlank();

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokens).save(captor.capture());
        PasswordResetToken saved = captor.getValue();
        assertThat(saved.getTokenHash()).isNotEqualTo(rawToken).isEqualTo(crypto.sha256(rawToken));
        assertThat(saved.getExpiresAt()).isAfter(OffsetDateTime.now().plusMinutes(25));

        assertThat(mail.outbox()).singleElement().satisfies(sent -> {
            assertThat(sent.to()).isEqualTo(EMAIL);
            assertThat(sent.text()).contains("http://localhost:4200/reset-password?token=");
            // O e-mail carrega o token; o banco, só o hash.
            assertThat(sent.text()).doesNotContain(saved.getTokenHash());
        });
    }

    @Test
    @DisplayName("um novo pedido invalida os links anteriores do mesmo usuário")
    void rotatesPreviousTokens() {
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(user));
        PasswordResetToken previous = PasswordResetToken.builder()
                .user(user).tokenHash("hash-antigo")
                .expiresAt(OffsetDateTime.now().plusMinutes(20))
                .build();
        when(tokens.findByUserIdAndUsedAtIsNull(user.getId())).thenReturn(List.of(previous));

        service.forgot(EMAIL);

        assertThat(previous.getUsedAt()).isNotNull();
    }

    @Test
    @DisplayName("excesso de pedidos para o mesmo e-mail para de gerar token")
    void throttlesRepeatedRequests() {
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(user));
        PasswordResetService throttled = newService(30, 2, 15);

        assertThat(throttled.forgot(EMAIL).developmentToken()).isNotBlank();
        assertThat(throttled.forgot(EMAIL).developmentToken()).isNotBlank();
        PasswordResetService.ForgotResult blocked = throttled.forgot(EMAIL);

        assertThat(blocked.developmentToken()).isNull();
        // A resposta continua idêntica: quem está de fora não percebe o bloqueio.
        assertThat(blocked.message()).contains("Se o e-mail existir");
        verify(tokens, times(2)).save(any(PasswordResetToken.class));
    }

    @Test
    @DisplayName("fora do ambiente de desenvolvimento o token não volta na resposta")
    void hidesTokenOutsideDevelopment() {
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(user));
        PasswordResetService production = new PasswordResetService(users, tokens, refreshTokens, encoder, crypto,
                mail, "production", "https://app.eventaccess.com.br", 30, 3, 15);

        assertThat(production.forgot(EMAIL).developmentToken()).isNull();
        verify(tokens).save(any(PasswordResetToken.class));
    }

    @Test
    @DisplayName("token inválido é recusado")
    void rejectsUnknownToken() {
        when(tokens.findByTokenHashAndUsedAtIsNull(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reset("token-inexistente", "NovaSenha@123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("inválido ou expirado");
    }

    @Test
    @DisplayName("token expirado é recusado")
    void rejectsExpiredToken() {
        PasswordResetToken expired = PasswordResetToken.builder()
                .user(user).tokenHash(crypto.sha256("token-vencido"))
                .expiresAt(OffsetDateTime.now().minusMinutes(1))
                .build();
        when(tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256("token-vencido"))).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.reset("token-vencido", "NovaSenha@123"))
                .isInstanceOf(ApiException.class);
        assertThat(encoder.matches("NovaSenha@123", user.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("troca de senha encerra as sessões abertas e avisa o usuário")
    void resetsPasswordAndRevokesSessions() {
        String raw = "token-valido";
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user).tokenHash(crypto.sha256(raw))
                .expiresAt(OffsetDateTime.now().plusMinutes(10))
                .build();
        when(tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256(raw))).thenReturn(Optional.of(token));
        RefreshToken session = RefreshToken.builder()
                .user(user).tokenHash("sessao").expiresAt(OffsetDateTime.now().plusDays(7)).build();
        when(refreshTokens.findByUserIdAndRevokedAtIsNull(user.getId())).thenReturn(List.of(session));

        service.reset(raw, "NovaSenha@123");

        assertThat(encoder.matches("NovaSenha@123", user.getPasswordHash())).isTrue();
        assertThat(token.getUsedAt()).isNotNull();
        assertThat(session.getRevokedAt()).isNotNull();
        assertThat(mail.outbox()).singleElement()
                .satisfies(sent -> assertThat(sent.subject()).contains("senha foi alterada"));
    }

    @Test
    @DisplayName("o mesmo token não serve duas vezes")
    void tokenIsSingleUse() {
        String raw = "token-unico";
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user).tokenHash(crypto.sha256(raw))
                .expiresAt(OffsetDateTime.now().plusMinutes(10))
                .build();
        when(tokens.findByTokenHashAndUsedAtIsNull(crypto.sha256(raw)))
                .thenReturn(Optional.of(token))
                .thenReturn(Optional.empty());

        service.reset(raw, "NovaSenha@123");

        assertThatThrownBy(() -> service.reset(raw, "OutraSenha@123"))
                .isInstanceOf(ApiException.class);
    }
}
