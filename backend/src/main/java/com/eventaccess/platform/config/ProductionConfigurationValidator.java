package com.eventaccess.platform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class ProductionConfigurationValidator implements ApplicationRunner {
    private final String environment;
    private final String jwtSecret;
    private final String qrSecret;
    private final String dataEncryptionSecret;
    private final String paymentProvider;
    private final String asaasApiKey;
    private final String asaasWebhookToken;
    private final boolean asaasSandbox;

    public ProductionConfigurationValidator(
            @Value("${app.environment}") String environment,
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.qr.secret}") String qrSecret,
            @Value("${app.data-encryption-secret}") String dataEncryptionSecret,
            @Value("${app.payment-provider}") String paymentProvider,
            @Value("${app.asaas.api-key:}") String asaasApiKey,
            @Value("${app.asaas.webhook-token:}") String asaasWebhookToken,
            @Value("${app.asaas.sandbox:true}") boolean asaasSandbox) {
        this.environment = environment;
        this.jwtSecret = jwtSecret;
        this.qrSecret = qrSecret;
        this.dataEncryptionSecret = dataEncryptionSecret;
        this.paymentProvider = paymentProvider;
        this.asaasApiKey = asaasApiKey;
        this.asaasWebhookToken = asaasWebhookToken;
        this.asaasSandbox = asaasSandbox;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!"production".equalsIgnoreCase(environment)) {
            return;
        }
        validate("JWT_SECRET", jwtSecret, 32);
        validate("QR_SECRET", qrSecret, 32);
        validate("DATA_ENCRYPTION_SECRET", dataEncryptionSecret, 32);
        if ("ASAAS".equalsIgnoreCase(paymentProvider)) {
            validate("ASAAS_API_KEY", asaasApiKey, 20);
            validate("ASAAS_WEBHOOK_TOKEN", asaasWebhookToken, 32);
            if (asaasSandbox) {
                throw new IllegalStateException("ASAAS_SANDBOX deve ser false em produção.");
            }
        }
    }

    private void validate(String name, String value, int minLength) {
        if (value == null || value.length() < minLength || value.toLowerCase().contains("change-this")) {
            throw new IllegalStateException(name + " inseguro: configure um segredo forte antes de iniciar em produção.");
        }
    }
}
