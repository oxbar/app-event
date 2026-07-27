package com.eventaccess.platform.payment;
import java.math.BigDecimal;import java.time.OffsetDateTime;import java.util.Map;
public interface PaymentProvider {
    PixPayment createPixPayment(String orderCode, BigDecimal amount, OffsetDateTime expiresAt);
    ProviderPayment findPayment(String providerPaymentId);
    void cancelPayment(String providerPaymentId);
    void refundPayment(String providerPaymentId, BigDecimal amount);
    boolean validateWebhook(String signature,String rawPayload);
    WebhookEvent parseWebhook(Map<String,Object> payload);
    record PixPayment(String providerPaymentId,String copyPaste,String qrCodeDataUrl,OffsetDateTime expiresAt){}
    record ProviderPayment(String providerPaymentId,String status,BigDecimal amount){}
    record WebhookEvent(String eventId,String providerPaymentId,String status,BigDecimal amount){}
}
