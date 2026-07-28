package com.eventaccess.platform.mail;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * O serviço de e-mail é o ponto onde a infraestrutura encontra o produto: se
 * ele lançar exceção, o fluxo de recuperação de senha quebra. Estes testes
 * fixam justamente esse contrato.
 */
class MailServiceTest {
    private JavaMailSender sender;
    private ObjectProvider<JavaMailSender> provider;
    private MailProperties properties;

    private final MailMessage message = new MailMessage(
            "pessoa@exemplo.com", "Ana Souza", "Recuperação de senha", "<p>oi</p>", "oi");

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        sender = mock(JavaMailSender.class);
        provider = mock(ObjectProvider.class);
        properties = new MailProperties();
        properties.setEnabled(true);
        properties.setFrom("nao-responda@eventaccess.test");
        properties.setFromName("Event Access");
        when(provider.getIfAvailable()).thenReturn(sender);
        when(sender.createMimeMessage()).thenAnswer(invocation ->
                new MimeMessage(Session.getInstance(new Properties())));
    }

    @Test
    @DisplayName("envia pelo SMTP quando a entrega está habilitada")
    void sendsThroughSmtp() {
        MailService service = new MailService(provider, properties);

        boolean delivered = service.send(message);

        assertThat(delivered).isTrue();
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        assertThat(captor.getValue()).isNotNull();
        assertThat(service.outbox()).singleElement()
                .satisfies(sent -> {
                    assertThat(sent.delivered()).isTrue();
                    assertThat(sent.to()).isEqualTo("pessoa@exemplo.com");
                });
    }

    @Test
    @DisplayName("apenas registra a mensagem quando a entrega está desabilitada")
    void skipsDeliveryWhenDisabled() {
        properties.setEnabled(false);
        MailService service = new MailService(provider, properties);

        boolean delivered = service.send(message);

        assertThat(delivered).isFalse();
        verify(sender, never()).send(any(MimeMessage.class));
        assertThat(service.outbox()).singleElement()
                .satisfies(sent -> assertThat(sent.delivered()).isFalse());
    }

    @Test
    @DisplayName("falha de SMTP não propaga exceção para quem chamou")
    void swallowsDeliveryFailure() {
        doThrow(new MailSendException("smtp fora do ar")).when(sender).send(any(MimeMessage.class));
        MailService service = new MailService(provider, properties);

        assertThat(service.send(message)).isFalse();
        assertThat(service.outbox()).singleElement()
                .satisfies(sent -> assertThat(sent.delivered()).isFalse());
    }

    @Test
    @DisplayName("aplica o prefixo de assunto configurado")
    void appliesSubjectPrefix() {
        properties.setEnabled(false);
        properties.setSubjectPrefix("[homologação]");
        MailService service = new MailService(provider, properties);

        service.send(message);

        assertThat(service.outbox().getFirst().subject()).isEqualTo("[homologação] Recuperação de senha");
    }

    @Test
    @DisplayName("a caixa de saída filtra por destinatário e respeita o limite")
    void keepsBoundedOutbox() {
        properties.setEnabled(false);
        MailService service = new MailService(provider, properties);

        for (int index = 0; index < 60; index++) {
            service.send(new MailMessage("pessoa%d@exemplo.com".formatted(index), "Pessoa",
                    "Assunto " + index, "<p>x</p>", "x"));
        }

        assertThat(service.outbox()).hasSize(50);
        assertThat(service.outboxFor("PESSOA59@EXEMPLO.COM")).hasSize(1);
        assertThat(service.outboxFor("pessoa0@exemplo.com")).isEmpty();

        service.clearOutbox();
        assertThat(service.outbox()).isEmpty();
    }

    @Test
    @DisplayName("mensagem sem destinatário ou assunto é rejeitada na origem")
    void rejectsIncompleteMessage() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> new MailMessage("", "Ana", "Assunto", "<p>x</p>", "x"));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> new MailMessage("ana@exemplo.com", "Ana", " ", "<p>x</p>", "x"));
    }
}
