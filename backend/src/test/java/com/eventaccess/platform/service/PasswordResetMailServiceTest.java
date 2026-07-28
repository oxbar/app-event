package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.UserAccount;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PasswordResetMailServiceTest {
    @Test
    void sendsHtmlEmailWithResetLink() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        MimeMessage message = new JavaMailSenderImpl().createMimeMessage();
        when(sender.createMimeMessage()).thenReturn(message);
        var service = new PasswordResetMailService(
                sender, true, "no-reply@eventaccess.local", "https://eventaccess.example");
        var user = UserAccount.builder().name("Micael").email("micael@example.com").build();

        assertThat(service.send(user, "token com espaco"))
                .isEqualTo(PasswordResetMailService.Delivery.SENT);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        MimeMessage sent = captor.getValue();
        assertThat(sent.getSubject()).contains("Redefinição de senha");
        assertThat(sent.getAllRecipients()[0].toString()).isEqualTo("micael@example.com");
    }

    @Test
    void doesNotConnectWhenMailIsDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var service = new PasswordResetMailService(
                sender, false, "no-reply@eventaccess.local", "http://localhost:4200");
        var user = UserAccount.builder().name("Micael").email("micael@example.com").build();

        assertThat(service.send(user, "token"))
                .isEqualTo(PasswordResetMailService.Delivery.DISABLED);
        verifyNoInteractions(sender);
    }
}
