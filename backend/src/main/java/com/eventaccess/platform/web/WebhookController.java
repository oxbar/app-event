package com.eventaccess.platform.web;

import com.eventaccess.platform.service.PaymentWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/payments")
public class WebhookController {
    private final PaymentWebhookService service;

    public WebhookController(PaymentWebhookService service) {
        this.service = service;
    }

    @PostMapping("/{provider}")
    ResponseEntity<Map<String, Boolean>> webhook(
            @PathVariable String provider,
            @RequestHeader(value = "asaas-access-token", required = false) String asaasToken,
            @RequestHeader(value = "X-Fake-Signature", required = false) String fakeSignature,
            @RequestBody Map<String, Object> payload) {
        String signature = "ASAAS".equalsIgnoreCase(provider) ? asaasToken : fakeSignature;
        service.process(provider, signature, payload);
        return ResponseEntity.ok(Map.of("received", true));
    }
}
