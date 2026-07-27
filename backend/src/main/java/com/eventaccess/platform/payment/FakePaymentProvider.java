package com.eventaccess.platform.payment;

import com.eventaccess.platform.service.QrCodeService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(prefix = "app", name = "payment-provider", havingValue = "FAKE", matchIfMissing = true)
public class FakePaymentProvider implements PaymentProvider {
    private final QrCodeService qrCodes;
    private final Map<String, ProviderPayment> payments = new ConcurrentHashMap<>();

    public FakePaymentProvider(QrCodeService qrCodes) {
        this.qrCodes = qrCodes;
    }

    @Override
    public String name() {
        return "FAKE";
    }

    @Override
    public PixPayment createPixPayment(PixRequest request) {
        String id = "fake_" + UUID.randomUUID();
        String copyPaste = "00020126FAKEPIX|ORDER=" + request.orderCode() + "|AMOUNT="
                + request.amount().toPlainString() + "|ID=" + id;
        payments.put(id, new ProviderPayment(id, "PENDING", request.amount(), request.orderCode(), Map.of()));
        return new PixPayment(id, "fake-customer-" + request.customer().internalId(), copyPaste,
                qrCodes.dataUrl(copyPaste, 320), request.expiresAt(), Map.of("mode", "development"));
    }

    @Override
    public ProviderPayment findPayment(String providerPaymentId) {
        return payments.getOrDefault(providerPaymentId,
                new ProviderPayment(providerPaymentId, "NOT_FOUND", BigDecimal.ZERO, null, Map.of()));
    }

    @Override
    public void cancelPayment(String providerPaymentId) {
        payments.computeIfPresent(providerPaymentId,
                (id, payment) -> new ProviderPayment(id, "CANCELED", payment.amount(),
                        payment.externalReference(), payment.providerResponse()));
    }

    @Override
    public RefundResult refundPayment(String providerPaymentId, BigDecimal amount, String reason) {
        payments.computeIfPresent(providerPaymentId,
                (id, payment) -> new ProviderPayment(id, "REFUNDED", payment.amount(),
                        payment.externalReference(), payment.providerResponse()));
        return new RefundResult("fake-refund-" + UUID.randomUUID(), "APPROVED",
                Map.of("amount", amount, "reason", reason));
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
                new BigDecimal(String.valueOf(payload.get("amount"))),
                payload.get("externalReference") == null ? null : String.valueOf(payload.get("externalReference"))
        );
    }

}
