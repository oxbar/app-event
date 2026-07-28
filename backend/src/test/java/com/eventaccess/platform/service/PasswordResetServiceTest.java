package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.PasswordResetToken;
import com.eventaccess.platform.domain.UserAccount;
import com.eventaccess.platform.repository.PasswordResetTokenRepository;
import com.eventaccess.platform.repository.RefreshTokenRepository;
import com.eventaccess.platform.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PasswordResetServiceTest {
    @Test
    void createsSingleUseTokenAndDispatchesEmail() {
        UserRepository users = mock(UserRepository.class);
        PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
        RefreshTokenRepository refreshTokens = mock(RefreshTokenRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        CryptoService crypto = mock(CryptoService.class);
        PasswordResetMailService mail = mock(PasswordResetMailService.class);
        var user = UserAccount.builder().name("Micael").email("micael@example.com").build();
        user.setId(UUID.randomUUID());
        var old = PasswordResetToken.builder().user(user).tokenHash("old").build();

        when(users.findByEmailIgnoreCase("micael@example.com")).thenReturn(Optional.of(user));
        when(tokens.findByUserIdAndUsedAtIsNull(user.getId())).thenReturn(List.of(old));
        when(crypto.randomToken()).thenReturn("raw-token");
        when(crypto.sha256("raw-token")).thenReturn("hash-token");

        var service = new PasswordResetService(
                users, tokens, refreshTokens, encoder, crypto, mail, "development");
        var result = service.forgot(" MICAEL@EXAMPLE.COM ");

        assertThat(result.developmentToken()).isEqualTo("raw-token");
        assertThat(old.getUsedAt()).isNotNull();
        verify(mail).send(user, "raw-token");
        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokens).save(saved.capture());
        assertThat(saved.getValue().getTokenHash()).isEqualTo("hash-token");
        assertThat(saved.getValue().getExpiresAt()).isAfter(java.time.OffsetDateTime.now().plusMinutes(29));
    }

    @Test
    void keepsGenericResponseForUnknownEmail() {
        UserRepository users = mock(UserRepository.class);
        when(users.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());
        PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
        PasswordResetMailService mail = mock(PasswordResetMailService.class);

        var service = new PasswordResetService(users, tokens, mock(RefreshTokenRepository.class),
                mock(PasswordEncoder.class), mock(CryptoService.class), mail, "production");
        var result = service.forgot("unknown@example.com");

        assertThat(result.message()).contains("Se o e-mail estiver cadastrado");
        assertThat(result.developmentToken()).isNull();
        verifyNoInteractions(tokens, mail);
    }
}
