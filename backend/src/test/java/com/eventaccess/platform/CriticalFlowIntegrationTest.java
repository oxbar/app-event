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
             "items":[{"ticketTypeId":"%s","quantity":1}],"acceptedTerms":true,"acceptedPrivacy":true}
            """.formatted(ticketTypeId);
        JsonNode order = body(post("/api/public/events/" + eventId + "/checkout").contentType(MediaType.APPLICATION_JSON).content(checkoutPayload), null);
        String orderCode = order.get("publicCode").asText();
        JsonNode pix = body(post("/api/public/orders/" + orderCode + "/payments/pix").contentType(MediaType.APPLICATION_JSON).content("{}"), null);
        String paymentId = pix.get("id").asText();

        body(post("/api/dev/payments/" + paymentId + "/approve").contentType(MediaType.APPLICATION_JSON).content("{}"), organizer);
        JsonNode paid = body(get("/api/public/orders/" + orderCode + "/payment-status"), null);
        assertThat(paid.get("status").asText()).isEqualTo("PAID");
        String qrValue = paid.at("/tickets/0/qrValue").asText();

        String door = login("door@eventaccess.local", "Door@123");
        JsonNode points = body(get("/api/events/" + eventId + "/access-points"), door);
        String pointId = points.get(0).get("id").asText();
        String scan = "{\"token\":\"%s\",\"accessPointId\":\"%s\",\"deviceIdentifier\":\"test\"}".formatted(qrValue, pointId);
        JsonNode first = body(post("/api/events/" + eventId + "/checkins/scan").contentType(MediaType.APPLICATION_JSON).content(scan), door);
        JsonNode second = body(post("/api/events/" + eventId + "/checkins/scan").contentType(MediaType.APPLICATION_JSON).content(scan), door);
        assertThat(first.get("approved").asBoolean()).isTrue();
        assertThat(second.get("result").asText()).isEqualTo("ALREADY_USED");
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
