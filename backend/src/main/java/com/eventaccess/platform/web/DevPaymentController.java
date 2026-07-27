package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.CheckoutService;
import com.eventaccess.platform.service.PaymentService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/dev/payments")
@ConditionalOnProperty(prefix = "app", name = "environment", havingValue = "development")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','FINANCE')")
public class DevPaymentController {
    private final PaymentService payments;

    public DevPaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping("/{id}/approve")
    CheckoutService.OrderView approve(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        payments.assertOwned(id, principal.organizationId());
        return payments.approve(id);
    }

    @PostMapping("/{id}/fail")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void fail(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        payments.assertOwned(id, principal.organizationId());
        payments.fail(id, "Falha simulada");
    }

    @PostMapping("/{id}/expire")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void expire(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        payments.assertOwned(id, principal.organizationId());
        payments.expire(id);
    }

    @PostMapping("/{id}/duplicate")
    CheckoutService.OrderView duplicate(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        payments.assertOwned(id, principal.organizationId());
        payments.approve(id);
        return payments.approve(id);
    }
}
