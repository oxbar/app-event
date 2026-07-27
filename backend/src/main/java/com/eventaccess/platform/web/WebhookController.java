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
    ResponseEntity<Void> webhook(@PathVariable String provider,
                                 @RequestHeader(value = "X-Fake-Signature", required = false) String signature,
                                 @RequestBody Map<String, Object> payload) {
        service.process(provider, signature, payload);
        return ResponseEntity.ok().build();
    }
}
