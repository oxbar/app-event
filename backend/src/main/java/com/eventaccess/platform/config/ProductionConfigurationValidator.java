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

    public ProductionConfigurationValidator(
            @Value("${app.environment}") String environment,
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.qr.secret}") String qrSecret,
            @Value("${app.data-encryption-secret}") String dataEncryptionSecret) {
        this.environment = environment;
        this.jwtSecret = jwtSecret;
        this.qrSecret = qrSecret;
        this.dataEncryptionSecret = dataEncryptionSecret;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!"production".equalsIgnoreCase(environment)) {
            return;
        }
        validate("JWT_SECRET", jwtSecret, 32);
        validate("QR_SECRET", qrSecret, 32);
        validate("DATA_ENCRYPTION_SECRET", dataEncryptionSecret, 32);
    }

    private void validate(String name, String value, int minLength) {
        if (value == null || value.length() < minLength || value.toLowerCase().contains("change-this")) {
            throw new IllegalStateException(name + " inseguro: configure um segredo forte antes de iniciar em produção.");
        }
    }
}
