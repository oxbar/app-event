package com.eventaccess.platform.mail;

/**
 * Montagem das mensagens transacionais.
 *
 * <p>HTML com estilo inline: clientes de e-mail ignoram folhas externas e boa
 * parte deles ignora também &lt;style&gt; no cabeçalho. Todo dado vindo do
 * usuário passa por {@link #escape(String)} antes de entrar no HTML.</p>
 */
public final class MailTemplates {
    private static final String BRAND = "#6b4eff";
    private static final String INK = "#18181b";
    private static final String MUTED = "#6b7280";

    private MailTemplates() {
    }

    public static MailMessage passwordReset(String recipient, String recipientName, String resetUrl,
                                            long expirationMinutes) {
        String name = firstName(recipientName);
        String subject = "Recuperação de senha — Event Access";
        String text = """
                Olá, %s!

                Recebemos um pedido para redefinir a senha da sua conta no Event Access.

                Abra o link abaixo para criar uma nova senha:
                %s

                O link expira em %d minutos e só pode ser usado uma vez.

                Se você não pediu a recuperação, ignore esta mensagem: sua senha atual continua valendo.

                Event Access — mensagem automática, não responda.
                """.formatted(name, resetUrl, expirationMinutes);

        String html = layout("Recuperação de senha", """
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:%s">Olá, <strong>%s</strong>!</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:%s">
                  Recebemos um pedido para redefinir a senha da sua conta no Event Access.
                </p>
                <p style="margin:0 0 28px;text-align:center">
                  <a href="%s" style="display:inline-block;padding:14px 28px;border-radius:12px;background:%s;color:#ffffff;font-weight:700;text-decoration:none">
                    Criar nova senha
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:%s">
                  O link expira em <strong>%d minutos</strong> e só pode ser usado uma vez.
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:%s">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                  <span style="word-break:break-all;color:%s">%s</span>
                </p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:%s">
                  Se você não pediu a recuperação, ignore esta mensagem: sua senha atual continua valendo.
                </p>
                """.formatted(INK, escape(name), INK, escape(resetUrl), BRAND, MUTED, expirationMinutes,
                MUTED, BRAND, escape(resetUrl), MUTED));

        return new MailMessage(recipient, recipientName, subject, html, text);
    }

    public static MailMessage passwordChanged(String recipient, String recipientName, String supportUrl) {
        String name = firstName(recipientName);
        String subject = "Sua senha foi alterada — Event Access";
        String text = """
                Olá, %s!

                A senha da sua conta no Event Access acabou de ser alterada e todas as sessões
                anteriores foram encerradas.

                Se não foi você, acesse %s e recupere o acesso imediatamente.

                Event Access — mensagem automática, não responda.
                """.formatted(name, supportUrl);

        String html = layout("Senha alterada", """
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:%s">Olá, <strong>%s</strong>!</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:%s">
                  A senha da sua conta no Event Access acabou de ser alterada e todas as sessões
                  anteriores foram encerradas.
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:%s">
                  Se não foi você, <a href="%s" style="color:%s;font-weight:700">recupere o acesso agora</a>.
                </p>
                """.formatted(INK, escape(name), INK, MUTED, escape(supportUrl), BRAND));

        return new MailMessage(recipient, recipientName, subject, html, text);
    }

    private static String layout(String title, String content) {
        return """
                <!doctype html>
                <html lang="pt-BR"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>%s</title></head>
                <body style="margin:0;padding:24px;background:#f5f6f8;font-family:Inter,Segoe UI,Arial,sans-serif">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
                    <tr><td style="padding:0 0 20px">
                      <span style="display:inline-block;width:44px;height:44px;border-radius:14px;background:%s;color:#fff;font-weight:800;text-align:center;line-height:44px">EA</span>
                    </td></tr>
                    <tr><td style="padding:32px;border-radius:20px;background:#ffffff;border:1px solid #e5e7eb">
                      <h1 style="margin:0 0 20px;font-size:22px;color:%s">%s</h1>
                      %s
                    </td></tr>
                    <tr><td style="padding:20px 8px;font-size:12px;color:%s">
                      Event Access — mensagem automática, não responda este e-mail.
                    </td></tr>
                  </table>
                </body></html>
                """.formatted(escape(title), BRAND, INK, escape(title), content, MUTED);
    }

    private static String firstName(String name) {
        if (name == null || name.isBlank()) return "tudo bem";
        String trimmed = name.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }

    static String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
