package com.eventaccess.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CriticalFlowIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("app.environment", () -> "development");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void checkoutPaymentTicketAndDuplicateCheckin() throws Exception {
        String organizer = login("organizer@eventaccess.local", "Organizer@123");
        JsonNode publicEvent = body(get("/api/public/events/festa-de-verao"), null);
        String eventId = publicEvent.at("/event/id").asText();
        String ticketTypeId = publicEvent.at("/ticketTypes/0/id").asText();

        String checkoutPayload = """
            {"buyer":{"name":"João da Silva","email":"joao@example.com","phone":"47999999999"},
             "items":[{"ticketTypeId":"%s","quantity":2}],"acceptedTerms":true,"acceptedPrivacy":true}
            """.formatted(ticketTypeId);
        JsonNode order = body(post("/api/public/events/" + eventId + "/checkout").contentType(MediaType.APPLICATION_JSON).content(checkoutPayload), null);
        String orderCode = order.get("publicCode").asText();
        JsonNode pix = body(post("/api/public/orders/" + orderCode + "/payments/pix").contentType(MediaType.APPLICATION_JSON).content("{}"), null);
        String paymentId = pix.get("id").asText();

        body(post("/api/dev/payments/" + paymentId + "/approve").contentType(MediaType.APPLICATION_JSON).content("{}"), organizer);
        JsonNode paid = body(get("/api/public/orders/" + orderCode + "/payment-status"), null);
        assertThat(paid.get("status").asText()).isEqualTo("PAID");
        String publicCode = paid.at("/tickets/0/publicCode").asText();
        String alternateTicketUrl = paid.at("/tickets/1/qrValue").asText().replace("/t/", "/ticket/");

        String door = login("door@eventaccess.local", "Door@123");
        JsonNode points = body(get("/api/events/" + eventId + "/access-points"), door);
        String pointId = points.get(0).get("id").asText();

        String manualPayload = "{\"token\":\"%s\",\"accessPointId\":\"%s\",\"deviceIdentifier\":\"manual-test\"}"
                .formatted(publicCode, pointId);
        JsonNode manual = body(post("/api/events/" + eventId + "/checkins/manual")
                .contentType(MediaType.APPLICATION_JSON).content(manualPayload), door);

        String scanPayload = "{\"token\":\"%s\",\"accessPointId\":\"%s\",\"deviceIdentifier\":\"camera-test\"}"
                .formatted(alternateTicketUrl, pointId);
        JsonNode scan = body(post("/api/events/" + eventId + "/checkins/scan")
                .contentType(MediaType.APPLICATION_JSON).content(scanPayload), door);

        JsonNode duplicate = body(post("/api/events/" + eventId + "/checkins/manual")
                .contentType(MediaType.APPLICATION_JSON).content(manualPayload), door);

        assertThat(manual.get("approved").asBoolean()).isTrue();
        assertThat(scan.get("approved").asBoolean()).isTrue();
        assertThat(duplicate.get("result").asText()).isEqualTo("ALREADY_USED");
    }

    private String login(String email, String password) throws Exception {
        JsonNode result = body(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"), null);
        return result.get("accessToken").asText();
    }

    private JsonNode body(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        String content = mvc.perform(request).andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
        return content.isBlank() ? json.createObjectNode() : json.readTree(content);
    }
}
