package com.eventaccess.platform.web;

import com.eventaccess.platform.mail.MailService;
import com.eventaccess.platform.payment.PaymentProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Diagnóstico mínimo da stack usada pela suíte Playwright.
 *
 * O endpoint só existe em development e exige perfil administrativo. Ele não
 * altera estado nem habilita atalhos de pagamento: apenas permite que a suíte
 * falhe antes de abrir 24 navegadores quando a stack está apontando para o
 * Asaas ou quando o backend antigo ainda está em execução.
 */
@RestController
@RequestMapping("/api/dev/e2e")
@ConditionalOnProperty(prefix = "app", name = "environment", havingValue = "development")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN')")
public class E2eSupportController {
    private final PaymentProvider paymentProvider;
    private final MailService mail;
    private final String environment;

    public E2eSupportController(PaymentProvider paymentProvider, MailService mail,
                                @Value("${app.environment}") String environment) {
        this.paymentProvider = paymentProvider;
        this.mail = mail;
        this.environment = environment;
    }

    @GetMapping("/status")
    Status status() {
        String provider = paymentProvider.name();
        return new Status(environment, provider, "FAKE".equalsIgnoreCase(provider));
    }

    /**
     * Caixa de saída em memória. A suíte usa isto para provar que o e-mail de
     * recuperação foi realmente produzido, em vez de confiar no token que o
     * ambiente de desenvolvimento devolve por conveniência.
     */
    @GetMapping("/mail")
    List<MailService.SentMail> mailbox(@RequestParam(required = false) String recipient) {
        return recipient == null || recipient.isBlank() ? mail.outbox() : mail.outboxFor(recipient);
    }

    @DeleteMapping("/mail")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void clearMailbox() {
        mail.clearOutbox();
    }

    public record Status(String environment, String paymentProvider, boolean ready) {}
}
