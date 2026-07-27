package com.eventaccess.platform.payment;

import com.eventaccess.platform.web.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Component
@ConditionalOnProperty(prefix = "app", name = "payment-provider", havingValue = "ASAAS")
public class AsaasPaymentProvider implements PaymentProvider {
    private static final ZoneId BRAZIL_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter ASAAS_DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RestClient client;
    private final ObjectMapper objectMapper;
    private final String webhookToken;
    private final boolean sandbox;

    public AsaasPaymentProvider(
            ObjectMapper objectMapper,
            @Value("${app.asaas.base-url}") String baseUrl,
            @Value("${app.asaas.api-key}") String apiKey,
            @Value("${app.asaas.webhook-token}") String webhookToken,
            @Value("${app.asaas.user-agent}") String userAgent,
            @Value("${app.asaas.sandbox:true}") boolean sandbox) {
        requireConfiguration("ASAAS_API_KEY", apiKey, 20);
        requireConfiguration("ASAAS_WEBHOOK_TOKEN", webhookToken, 32);
        requireConfiguration("ASAAS_USER_AGENT", userAgent, 3);

        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(20));

        this.client = RestClient.builder()
                .baseUrl(stripTrailingSlash(baseUrl))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .defaultHeader("access_token", apiKey)
                .build();
        this.objectMapper = objectMapper;
        this.webhookToken = webhookToken;
        this.sandbox = sandbox;
    }

    @Override
    public String name() {
        return "ASAAS";
    }

    @Override
    public PixPayment createPixPayment(PixRequest request) {
        // externalReference is the idempotency/reconciliation key shared with the local order.
        JsonNode payment = findByExternalReference(request.orderCode());
        String customerId;

        if (payment == null) {
            customerId = request.customer().providerCustomerId();
            if (customerId == null || customerId.isBlank()) {
                customerId = createCustomer(request.customer());
            }

            Map<String, Object> paymentRequest = new LinkedHashMap<>();
            paymentRequest.put("customer", customerId);
            paymentRequest.put("billingType", "PIX");
            paymentRequest.put("value", request.amount());
            paymentRequest.put("dueDate", request.expiresAt().atZoneSameInstant(BRAZIL_ZONE).toLocalDate().toString());
            paymentRequest.put("description", limit(request.description(), 500));
            paymentRequest.put("externalReference", request.orderCode());
            payment = post("/payments", paymentRequest);
        } else {
            customerId = requiredText(payment, "customer", "A cobrança Asaas não possui cliente associado.");
        }

        String paymentId = requiredText(payment, "id", "O Asaas não retornou o identificador da cobrança.");
        JsonNode pix = get("/payments/" + paymentId + "/pixQrCode");
        String payload = requiredText(pix, "payload", "O Asaas não retornou o Pix Copia e Cola.");
        String encodedImage = requiredText(pix, "encodedImage", "O Asaas não retornou a imagem do QR Code Pix.");
        OffsetDateTime expiration = parseExpiration(pix.path("expirationDate").asText(null), request.expiresAt());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("customerId", customerId);
        response.put("paymentId", paymentId);
        response.put("status", payment.path("status").asText("PENDING"));
        response.put("externalReference", request.orderCode());
        putIfPresent(response, "invoiceUrl", nullableText(payment, "invoiceUrl"));
        putIfPresent(response, "bankSlipUrl", nullableText(payment, "bankSlipUrl"));
        response.put("sandbox", sandbox);

        return new PixPayment(
                paymentId,
                customerId,
                payload,
                "data:image/png;base64," + encodedImage,
                expiration,
                response
        );
    }

    @Override
    public ProviderPayment findPayment(String providerPaymentId) {
        return providerPayment(get("/payments/" + providerPaymentId));
    }

    @Override
    public void cancelPayment(String providerPaymentId) {
        delete("/payments/" + providerPaymentId);
    }

    @Override
    public RefundResult refundPayment(String providerPaymentId, BigDecimal amount, String reason) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("value", amount);
        if (reason != null && !reason.isBlank()) {
            body.put("description", limit(reason, 255));
        }
        JsonNode response = post("/payments/" + providerPaymentId + "/refund", body);
        String refundId = nullableText(response, "id");
        if (refundId == null) {
            refundId = providerPaymentId + ":refund:" + System.nanoTime();
        }
        return new RefundResult(refundId, response.path("status").asText("REQUESTED"), toMap(response));
    }

    @Override
    public boolean validateWebhook(String signature, String rawPayload) {
        if (signature == null || rawPayload == null || rawPayload.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                webhookToken.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8)
        );
    }

    @Override
    public WebhookEvent parseWebhook(Map<String, Object> payload) {
        String eventId = stringValue(payload.get("id"));
        String eventName = stringValue(payload.get("event"));
        Object rawPayment = payload.get("payment");
        if (!(rawPayment instanceof Map<?, ?> payment)) {
            throw ApiException.badRequest("INVALID_WEBHOOK", "Webhook Asaas sem objeto de cobrança.");
        }
        String paymentId = stringValue(payment.get("id"));
        String externalReference = stringValue(payment.get("externalReference"));
        BigDecimal amount = decimalValue(payment.get("value"));
        return new WebhookEvent(eventId, paymentId, mapWebhookStatus(eventName), amount, externalReference);
    }

    private JsonNode findByExternalReference(String externalReference) {
        try {
            JsonNode response = client.get()
                    .uri(builder -> builder.path("/payments")
                            .queryParam("externalReference", externalReference)
                            .queryParam("limit", 1)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null || !response.path("data").isArray() || response.path("data").isEmpty()) {
                return null;
            }
            return response.path("data").get(0);
        } catch (RestClientResponseException ex) {
            throw providerError(ex);
        } catch (ResourceAccessException ex) {
            throw ApiException.paymentProvider("O Asaas não respondeu dentro do tempo esperado. Tente novamente.");
        }
    }

    private String createCustomer(Customer customer) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", customer.name());
        putIfPresent(body, "email", customer.email());
        putIfPresent(body, "mobilePhone", digits(customer.phone()));
        String document = digits(customer.document());
        if (document != null && (document.length() == 11 || document.length() == 14)) {
            body.put("cpfCnpj", document);
        }
        body.put("externalReference", customer.internalId());
        body.put("notificationDisabled", true);
        JsonNode response = post("/customers", body);
        return requiredText(response, "id", "O Asaas não retornou o identificador do cliente.");
    }

    private ProviderPayment providerPayment(JsonNode payment) {
        return new ProviderPayment(
                requiredText(payment, "id", "Cobrança Asaas sem identificador."),
                payment.path("status").asText("PENDING"),
                payment.path("value").decimalValue(),
                nullableText(payment, "externalReference"),
                toMap(payment)
        );
    }

    private JsonNode get(String path) {
        try {
            JsonNode response = client.get().uri(path).retrieve().body(JsonNode.class);
            return Objects.requireNonNullElseGet(response, objectMapper::createObjectNode);
        } catch (RestClientResponseException ex) {
            throw providerError(ex);
        } catch (ResourceAccessException ex) {
            throw ApiException.paymentProvider("O Asaas não respondeu dentro do tempo esperado. Tente novamente.");
        }
    }

    private JsonNode post(String path, Object body) {
        try {
            JsonNode response = client.post().uri(path).body(body).retrieve().body(JsonNode.class);
            return Objects.requireNonNullElseGet(response, objectMapper::createObjectNode);
        } catch (RestClientResponseException ex) {
            throw providerError(ex);
        } catch (ResourceAccessException ex) {
            throw ApiException.paymentProvider("O Asaas não respondeu dentro do tempo esperado. Tente novamente.");
        }
    }

    private void delete(String path) {
        try {
            client.delete().uri(path).retrieve().toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw providerError(ex);
        } catch (ResourceAccessException ex) {
            throw ApiException.paymentProvider("O Asaas não respondeu dentro do tempo esperado. Tente novamente.");
        }
    }

    private ApiException providerError(RestClientResponseException ex) {
        String description = switch (ex.getStatusCode().value()) {
            case 401 -> "A API Key do Asaas é inválida ou pertence ao ambiente incorreto.";
            case 403 -> "O Asaas recusou a operação. Verifique permissões, headers e configuração da conta.";
            case 404 -> "O recurso solicitado não foi encontrado no Asaas Sandbox.";
            case 429 -> "O limite de requisições do Asaas foi atingido. Aguarde e tente novamente.";
            default -> "Falha de comunicação com o Asaas.";
        };
        try {
            JsonNode body = objectMapper.readTree(ex.getResponseBodyAsString());
            JsonNode errors = body.path("errors");
            if (errors.isArray() && !errors.isEmpty()) {
                String value = errors.get(0).path("description").asText();
                if (!value.isBlank()) {
                    description = value;
                }
            }
        } catch (Exception ignored) {
            // Não expõe a resposta bruta do provedor para evitar vazamento de dados.
        }
        return ApiException.paymentProvider(description);
    }

    private String mapWebhookStatus(String eventName) {
        if (eventName == null) {
            return "IGNORED";
        }
        return switch (eventName.toUpperCase(Locale.ROOT)) {
            case "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED" -> "APPROVED";
            case "PAYMENT_OVERDUE" -> "EXPIRED";
            case "PAYMENT_DELETED" -> "CANCELED";
            case "PAYMENT_REJECTED_BY_RISK_ANALYSIS", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED" -> "FAILED";
            case "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_AWAITING_RISK_ANALYSIS",
                 "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED" -> "IGNORED";
            default -> "IGNORED";
        };
    }

    private OffsetDateTime parseExpiration(String value, OffsetDateTime fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value, ASAAS_DATE_TIME).atZone(BRAZIL_ZONE).toOffsetDateTime();
            } catch (DateTimeParseException ignoredAgain) {
                try {
                    return LocalDate.parse(value).atTime(23, 59, 59).atZone(BRAZIL_ZONE).toOffsetDateTime();
                } catch (DateTimeParseException ignoredDate) {
                    return fallback;
                }
            }
        }
    }

    private Map<String, Object> toMap(JsonNode node) {
        return objectMapper.convertValue(node, new TypeReference<Map<String, Object>>() {});
    }

    private static String requiredText(JsonNode node, String field, String message) {
        String value = nullableText(node, field);
        if (value == null || value.isBlank()) {
            throw ApiException.paymentProvider(message);
        }
        return value;
    }

    private static String nullableText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static BigDecimal decimalValue(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private static String digits(String value) {
        if (value == null) {
            return null;
        }
        String digits = value.replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private static String limit(String value, int length) {
        if (value == null) {
            return "";
        }
        return value.length() <= length ? value : value.substring(0, length);
    }

    private static void putIfPresent(Map<String, Object> body, String key, String value) {
        if (value != null && !value.isBlank()) {
            body.put(key, value);
        }
    }

    private static String stripTrailingSlash(String value) {
        return value != null && value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static void requireConfiguration(String name, String value, int minimumLength) {
        if (value == null || value.isBlank() || value.length() < minimumLength || value.contains("change-this")) {
            throw new IllegalStateException(name + " não configurado para a integração com o Asaas.");
        }
    }
}
