package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.UserAccount;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;

@Service
public class PasswordResetMailService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailService.class);

    private final JavaMailSender sender;
    private final boolean enabled;
    private final String from;
    private final String baseUrl;

    public PasswordResetMailService(JavaMailSender sender,
                                    @Value("${app.mail.enabled:false}") boolean enabled,
                                    @Value("${app.mail.from:no-reply@eventaccess.local}") String from,
                                    @Value("${app.base-url}") String baseUrl) {
        this.sender = sender;
        this.enabled = enabled;
        this.from = from;
        this.baseUrl = baseUrl;
    }

    public Delivery send(UserAccount user, String rawToken) {
        String resetUrl = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/reset-password")
                .queryParam("token", rawToken)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUriString();

        if (!enabled) {
            log.info("Envio de e-mail desabilitado. Link de recuperação para {}: {}", user.getEmail(), resetUrl);
            return Delivery.DISABLED;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from, "Event Access");
            helper.setTo(user.getEmail());
            helper.setSubject("Redefinição de senha — Event Access");
            helper.setText(textBody(user, resetUrl), htmlBody(user, resetUrl));
            sender.send(message);
            return Delivery.SENT;
        } catch (MessagingException | MailException exception) {
            log.error("Não foi possível enviar o e-mail de recuperação para {}", user.getEmail(), exception);
            return Delivery.FAILED;
        } catch (java.io.UnsupportedEncodingException exception) {
            log.error("Configuração inválida do remetente de recuperação de senha", exception);
            return Delivery.FAILED;
        }
    }

    private String textBody(UserAccount user, String resetUrl) {
        return "Olá, " + safeName(user) + "!\n\n"
                + "Recebemos uma solicitação para redefinir sua senha no Event Access.\n"
                + "Use o link abaixo nas próximas 30 minutos:\n\n"
                + resetUrl + "\n\n"
                + "Se você não fez essa solicitação, ignore esta mensagem. Sua senha continuará a mesma.\n";
    }

    private String htmlBody(UserAccount user, String resetUrl) {
        String name = HtmlUtils.htmlEscape(safeName(user));
        String link = HtmlUtils.htmlEscape(resetUrl);
        return """
                <!doctype html>
                <html lang="pt-BR">
                <body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#101828">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f6fb">
                    <tr><td align="center">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e7ef;border-radius:18px;padding:32px">
                        <tr><td>
                          <div style="display:inline-block;background:#5b6fda;color:#fff;font-weight:700;border-radius:12px;padding:11px 13px">EA</div>
                          <h1 style="font-size:24px;margin:24px 0 12px">Redefina sua senha</h1>
                          <p style="line-height:1.6;color:#475467">Olá, %s. Recebemos uma solicitação para alterar a senha da sua conta.</p>
                          <p style="margin:28px 0"><a href="%s" style="display:inline-block;background:#5b6fda;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:14px 20px">Criar nova senha</a></p>
                          <p style="line-height:1.6;color:#667085;font-size:14px">Este link expira em 30 minutos e só pode ser usado uma vez. Caso não tenha solicitado a alteração, ignore este e-mail.</p>
                          <p style="line-height:1.5;color:#98a2b3;font-size:12px;word-break:break-all">%s</p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(name, link, link);
    }

    private String safeName(UserAccount user) {
        return user.getName() == null || user.getName().isBlank() ? "usuário" : user.getName().trim();
    }

    public enum Delivery { SENT, DISABLED, FAILED }
}
