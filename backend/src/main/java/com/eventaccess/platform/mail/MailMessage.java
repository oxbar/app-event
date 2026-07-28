package com.eventaccess.platform.mail;

/**
 * Mensagem transacional pronta para envio.
 *
 * <p>Sempre carrega as duas representações: o HTML para clientes modernos e o
 * texto puro para leitores simples e para os testes, que asseguram que nenhum
 * dado essencial (como o link de recuperação) exista apenas no HTML.</p>
 */
public record MailMessage(String to, String recipientName, String subject, String html, String text) {

    public MailMessage {
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Destinatário obrigatório.");
        }
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Assunto obrigatório.");
        }
    }
}
