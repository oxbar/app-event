package com.eventaccess.platform.payment;

import com.eventaccess.platform.service.QrCodeService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class FakePaymentProvider implements PaymentProvider {
    private final QrCodeService qrCodes;
    private final Map<String, ProviderPayment> payments = new ConcurrentHashMap<>();

    public FakePaymentProvider(QrCodeService qrCodes) {
        this.qrCodes = qrCodes;
    }

    @Override
    public PixPayment createPixPayment(String orderCode, BigDecimal amount, OffsetDateTime expiresAt) {
        String id = "fake_" + UUID.randomUUID();
        String copyPaste = "00020126FAKEPIX|ORDER=" + orderCode + "|AMOUNT="
                + amount.toPlainString() + "|ID=" + id;
        payments.put(id, new ProviderPayment(id, "PENDING", amount));
        return new PixPayment(id, copyPaste, qrCodes.dataUrl(copyPaste, 320), expiresAt);
    }

    @Override
    public ProviderPayment findPayment(String providerPaymentId) {
        return payments.getOrDefault(providerPaymentId,
                new ProviderPayment(providerPaymentId, "NOT_FOUND", BigDecimal.ZERO));
    }

    @Override
    public void cancelPayment(String providerPaymentId) {
        payments.computeIfPresent(providerPaymentId,
                (id, payment) -> new ProviderPayment(id, "CANCELED", payment.amount()));
    }

    @Override
    public void refundPayment(String providerPaymentId, BigDecimal amount) {
        payments.computeIfPresent(providerPaymentId,
                (id, payment) -> new ProviderPayment(id, "REFUNDED", payment.amount()));
    }

    @Override
    public boolean validateWebhook(String signature, String rawPayload) {
        return signature != null && signature.equals("dev-secret") && rawPayload != null && !rawPayload.isBlank();
    }

    @Override
    public WebhookEvent parseWebhook(Map<String, Object> payload) {
        return new WebhookEvent(
                String.valueOf(payload.get("eventId")),
                String.valueOf(payload.get("providerPaymentId")),
                String.valueOf(payload.get("status")),
                new BigDecimal(String.valueOf(payload.get("amount")))
        );
    }
}
