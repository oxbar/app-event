package com.eventaccess.platform.payment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

public interface PaymentProvider {
    String name();

    PixPayment createPixPayment(PixRequest request);

    ProviderPayment findPayment(String providerPaymentId);

    void cancelPayment(String providerPaymentId);

    RefundResult refundPayment(String providerPaymentId, BigDecimal amount, String reason);

    boolean validateWebhook(String signature, String rawPayload);

    WebhookEvent parseWebhook(Map<String, Object> payload);

    record Customer(
            String internalId,
            String providerCustomerId,
            String name,
            String email,
            String phone,
            String document
    ) {}

    record PixRequest(
            String orderCode,
            String description,
            BigDecimal amount,
            OffsetDateTime expiresAt,
            Customer customer
    ) {}

    record PixPayment(
            String providerPaymentId,
            String providerCustomerId,
            String copyPaste,
            String qrCodeDataUrl,
            OffsetDateTime expiresAt,
            Map<String, Object> providerResponse
    ) {}

    record ProviderPayment(
            String providerPaymentId,
            String status,
            BigDecimal amount,
            String externalReference,
            Map<String, Object> providerResponse
    ) {}

    record RefundResult(String providerRefundId, String status, Map<String, Object> providerResponse) {}

    record WebhookEvent(
            String eventId,
            String providerPaymentId,
            String status,
            BigDecimal amount,
            String externalReference
    ) {}
}
