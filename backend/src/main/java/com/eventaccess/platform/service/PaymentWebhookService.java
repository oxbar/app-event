package com.eventaccess.platform.service;

import com.eventaccess.platform.payment.PaymentProvider;
import com.eventaccess.platform.repository.PaymentRepository;
import com.eventaccess.platform.web.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class PaymentWebhookService {
    private final PaymentProvider provider;
    private final PaymentRepository payments;
    private final PaymentService paymentService;
    private final PaymentWebhookStoreService store;
    private final ObjectMapper objectMapper;

    public PaymentWebhookService(PaymentProvider provider, PaymentRepository payments,
                                 PaymentService paymentService, PaymentWebhookStoreService store,
                                 ObjectMapper objectMapper) {
        this.provider = provider;
        this.payments = payments;
        this.paymentService = paymentService;
        this.store = store;
        this.objectMapper = objectMapper;
    }

    public boolean process(String providerName, String signature, Map<String, Object> payload) {
        String rawPayload = toJson(payload);
        if (!provider.validateWebhook(signature, rawPayload)) {
            throw ApiException.forbidden("Assinatura do webhook inválida.");
        }

        PaymentProvider.WebhookEvent event = provider.parseWebhook(payload);
        if (event.eventId() == null || event.eventId().isBlank() || "null".equals(event.eventId())) {
            throw ApiException.badRequest("INVALID_WEBHOOK", "Webhook sem identificador idempotente.");
        }

        String normalizedProvider = providerName.toUpperCase();
        var webhookId = store.register(normalizedProvider, event.eventId(),
                "PAYMENT_" + event.status().toUpperCase(), rawPayload, signature);
        if (webhookId.isEmpty()) {
            return false;
        }

        store.mark(webhookId.get(), "PROCESSING", null);
        try {
            var payment = payments.findByProviderPaymentId(event.providerPaymentId())
                    .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
            if (event.amount().compareTo(payment.getAmount()) != 0) {
                throw ApiException.badRequest("PAYMENT_AMOUNT_MISMATCH", "Valor do webhook divergente.");
            }
            switch (event.status().toUpperCase()) {
                case "APPROVED" -> paymentService.approve(payment.getId());
                case "FAILED" -> paymentService.fail(payment.getId(), "Falha informada pelo provedor");
                case "EXPIRED" -> paymentService.expire(payment.getId());
                default -> {
                    store.mark(webhookId.get(), "IGNORED", null);
                    return true;
                }
            }
            store.mark(webhookId.get(), "PROCESSED", null);
            return true;
        } catch (RuntimeException ex) {
            store.mark(webhookId.get(), "FAILED", ex.getMessage());
            throw ex;
        }
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw ApiException.badRequest("INVALID_WEBHOOK", "Payload do webhook inválido.");
        }
    }
}
