package com.eventaccess.platform.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MailTemplatesTest {

    @Test
    @DisplayName("o e-mail de recuperação leva o link e o prazo nas duas versões")
    void passwordResetCarriesLinkAndDeadline() {
        String url = "http://localhost:4200/reset-password?token=abc123";

        MailMessage message = MailTemplates.passwordReset("ana@exemplo.com", "Ana Souza", url, 30);

        assertThat(message.to()).isEqualTo("ana@exemplo.com");
        assertThat(message.subject()).contains("Recuperação de senha");
        // O link precisa existir também em texto puro: há clientes que não abrem HTML.
        assertThat(message.text()).contains(url).contains("30 minutos");
        assertThat(message.html()).contains(url).contains("30 minutos").contains("Criar nova senha");
        assertThat(message.text()).contains("Ana");
    }

    @Test
    @DisplayName("o aviso de senha alterada aponta o caminho de recuperação")
    void passwordChangedPointsToRecovery() {
        MailMessage message = MailTemplates.passwordChanged("ana@exemplo.com", "Ana", "http://localhost:4200/forgot-password");

        assertThat(message.subject()).contains("senha foi alterada");
        assertThat(message.text()).contains("http://localhost:4200/forgot-password");
        assertThat(message.html()).contains("http://localhost:4200/forgot-password");
    }

    @Test
    @DisplayName("nome do usuário é escapado antes de entrar no HTML")
    void escapesRecipientName() {
        MailMessage message = MailTemplates.passwordReset("ana@exemplo.com",
                "<script>alert(1)</script>", "http://localhost:4200/reset-password?token=x", 30);

        assertThat(message.html()).doesNotContain("<script>");
        assertThat(message.html()).contains("&lt;script&gt;");
    }

    @Test
    @DisplayName("sem nome cadastrado a saudação continua natural")
    void handlesMissingName() {
        MailMessage message = MailTemplates.passwordReset("ana@exemplo.com", null,
                "http://localhost:4200/reset-password?token=x", 15);

        assertThat(message.text()).startsWith("Olá,");
        assertThat(message.html()).contains("Olá,");
    }
}
