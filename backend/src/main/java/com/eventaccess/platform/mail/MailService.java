package com.eventaccess.platform.mail;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Entrega de e-mails transacionais.
 *
 * <p>Três decisões importantes:</p>
 * <ul>
 *   <li>O envio nunca propaga exceção. Um SMTP fora do ar não pode transformar
 *       "esqueci minha senha" em erro 500 nem revelar se o e-mail existe.</li>
 *   <li>Quando o envio está desabilitado, a mensagem é registrada no log em
 *       nível INFO — é o modo padrão de desenvolvimento.</li>
 *   <li>Toda mensagem processada entra numa caixa de saída em memória limitada,
 *       usada pelos testes automatizados e pelo endpoint de diagnóstico.</li>
 * </ul>
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private static final int OUTBOX_LIMIT = 50;

    private final ObjectProvider<JavaMailSender> mailSenders;
    private final MailProperties properties;
    private final Deque<SentMail> outbox = new ConcurrentLinkedDeque<>();

    public MailService(ObjectProvider<JavaMailSender> mailSenders, MailProperties properties) {
        this.mailSenders = mailSenders;
        this.properties = properties;
    }

    /**
     * @return true quando a mensagem foi efetivamente entregue ao servidor SMTP.
     */
    public boolean send(MailMessage message) {
        String subject = applyPrefix(message.subject());
        JavaMailSender sender = properties.isEnabled() ? mailSenders.getIfAvailable() : null;
        if (sender == null) {
            log.info("E-mail não enviado (entrega desabilitada). destinatario={} assunto={}", message.to(), subject);
            record(new SentMail(message.to(), message.recipientName(), subject, message.html(), message.text(),
                    false, OffsetDateTime.now()));
            return false;
        }
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.getFrom(), properties.getFromName());
            if (message.recipientName() == null || message.recipientName().isBlank()) {
                helper.setTo(message.to());
            } else {
                helper.setTo(new jakarta.mail.internet.InternetAddress(message.to(), message.recipientName(),
                        StandardCharsets.UTF_8.name()));
            }
            if (properties.getReplyTo() != null && !properties.getReplyTo().isBlank()) {
                helper.setReplyTo(properties.getReplyTo());
            }
            helper.setSubject(subject);
            helper.setText(message.text(), message.html());
            sender.send(mime);
            log.info("E-mail enviado. destinatario={} assunto={}", message.to(), subject);
            record(new SentMail(message.to(), message.recipientName(), subject, message.html(), message.text(),
                    true, OffsetDateTime.now()));
            return true;
        } catch (UnsupportedEncodingException | jakarta.mail.MessagingException | RuntimeException error) {
            // Falha de entrega é problema de infraestrutura, não do usuário.
            log.warn("Falha ao enviar e-mail para {}: {}", message.to(), error.getMessage());
            record(new SentMail(message.to(), message.recipientName(), subject, message.html(), message.text(),
                    false, OffsetDateTime.now()));
            return false;
        }
    }

    /** Últimas mensagens processadas, da mais recente para a mais antiga. */
    public List<SentMail> outbox() {
        return List.copyOf(new ArrayList<>(outbox));
    }

    public List<SentMail> outboxFor(String recipient) {
        String normalized = recipient == null ? "" : recipient.trim().toLowerCase(Locale.ROOT);
        return outbox().stream()
                .filter(mail -> mail.to().toLowerCase(Locale.ROOT).equals(normalized))
                .toList();
    }

    public void clearOutbox() {
        outbox.clear();
    }

    private void record(SentMail mail) {
        outbox.addFirst(mail);
        while (outbox.size() > OUTBOX_LIMIT) {
            outbox.pollLast();
        }
    }

    private String applyPrefix(String subject) {
        String prefix = properties.getSubjectPrefix();
        return prefix == null || prefix.isBlank() ? subject : prefix.trim() + " " + subject;
    }

    public record SentMail(String to, String recipientName, String subject, String html, String text,
                           boolean delivered, OffsetDateTime processedAt) {}
}
