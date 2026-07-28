package com.eventaccess.platform.web;

import com.eventaccess.platform.payment.PaymentProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    private final String environment;

    public E2eSupportController(PaymentProvider paymentProvider,
                                @Value("${app.environment}") String environment) {
        this.paymentProvider = paymentProvider;
        this.environment = environment;
    }

    @GetMapping("/status")
    Status status() {
        String provider = paymentProvider.name();
        return new Status(environment, provider, "FAKE".equalsIgnoreCase(provider));
    }

    public record Status(String environment, String paymentProvider, boolean ready) {}
}
