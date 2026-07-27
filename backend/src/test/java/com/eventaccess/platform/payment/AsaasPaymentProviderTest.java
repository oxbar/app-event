package com.eventaccess.platform.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AsaasPaymentProviderTest {
    private final AsaasPaymentProvider provider = new AsaasPaymentProvider(
            new ObjectMapper(),
            "https://api-sandbox.asaas.com/v3",
            "$aact_hmlg_012345678901234567890123456789",
            "webhook-token-with-more-than-thirty-two-characters",
            "event-access-tests/1.0",
            true
    );

    @Test
    void validatesWebhookTokenInConstantTimeComparison() {
        assertTrue(provider.validateWebhook(
                "webhook-token-with-more-than-thirty-two-characters", "{}"));
        assertFalse(provider.validateWebhook("wrong-token", "{}"));
    }

    @Test
    void mapsPaymentReceivedWebhook() {
        PaymentProvider.WebhookEvent event = provider.parseWebhook(Map.of(
                "id", "evt_123",
                "event", "PAYMENT_RECEIVED",
                "payment", Map.of(
                        "id", "pay_123",
                        "externalReference", "ORD-123",
                        "value", 160.00
                )
        ));

        assertEquals("evt_123", event.eventId());
        assertEquals("pay_123", event.providerPaymentId());
        assertEquals("APPROVED", event.status());
        assertEquals(new BigDecimal("160.0"), event.amount());
        assertEquals("ORD-123", event.externalReference());
    }

    @Test
    void ignoresRefundEventBecauseRefundServiceOwnsLocalStateTransition() {
        PaymentProvider.WebhookEvent event = provider.parseWebhook(Map.of(
                "id", "evt_refund",
                "event", "PAYMENT_REFUNDED",
                "payment", Map.of("id", "pay_123", "value", 160.00)
        ));

        assertEquals("IGNORED", event.status());
    }
}
