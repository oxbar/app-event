package com.eventaccess.platform.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuração da notificação por e-mail.
 *
 * <p>O envio é opcional de propósito: em desenvolvimento a stack sobe com um
 * coletor SMTP local (Mailpit) e, se ele não existir, a mensagem é registrada
 * no log e na caixa de saída em memória. Assim o fluxo de recuperação de senha
 * nunca quebra por causa da infraestrutura de e-mail.</p>
 */
@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {
    /** Quando falso, a mensagem é apenas registrada (log + caixa de saída). */
    private boolean enabled = false;
    /** Remetente técnico das mensagens transacionais. */
    private String from = "nao-responda@eventaccess.local";
    /** Nome exibido no remetente. */
    private String fromName = "Event Access";
    /** Endereço opcional de resposta. */
    private String replyTo = "";
    /** Prefixo aplicado a todos os assuntos, útil para separar ambientes. */
    private String subjectPrefix = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getFromName() {
        return fromName;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public String getReplyTo() {
        return replyTo;
    }

    public void setReplyTo(String replyTo) {
        this.replyTo = replyTo;
    }

    public String getSubjectPrefix() {
        return subjectPrefix;
    }

    public void setSubjectPrefix(String subjectPrefix) {
        this.subjectPrefix = subjectPrefix;
    }
}
