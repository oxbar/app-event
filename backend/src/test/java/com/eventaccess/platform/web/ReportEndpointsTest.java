package com.eventaccess.platform.web;

import com.eventaccess.platform.domain.Enums.Role;
import com.eventaccess.platform.report.ReportService;
import com.eventaccess.platform.report.ReportSummary;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.AdminQueryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Contrato HTTP das exportações: o navegador precisa receber o tipo MIME certo
 * e um nome de arquivo utilizável, senão o download chega como "download" sem
 * extensão e o Excel se recusa a abrir.
 */
class ReportEndpointsTest {
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final UUID EVENT_ID = UUID.randomUUID();

    private ReportService reports;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        reports = mock(ReportService.class);
        AdminQueryService queries = mock(AdminQueryService.class);
        mvc = MockMvcBuilders.standaloneSetup(new AdminResourceController(queries, reports))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        AppPrincipal principal = new AppPrincipal(UUID.randomUUID(), UUID.randomUUID(), "Organizador",
                "organizer@eventaccess.local", "", Set.of(Role.ORGANIZER_ADMIN));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, "", principal.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("a pasta completa vem com MIME de XLSX e nome de arquivo")
    void fullWorkbookIsDownloadable() throws Exception {
        when(reports.exportFull(any(), any())).thenReturn(new ReportService.ExportedFile(
                "relatorio-festival-aurora-20260815-2200.xlsx", new byte[]{1, 2, 3, 4}));

        mvc.perform(get("/api/events/{id}/reports/workbook.xlsx", EVENT_ID))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(XLSX))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"relatorio-festival-aurora-20260815-2200.xlsx\""));
    }

    @Test
    @DisplayName("vendas e entradas também exportam em planilha")
    void perTopicWorkbooks() throws Exception {
        when(reports.exportSales(any(), any()))
                .thenReturn(new ReportService.ExportedFile("vendas.xlsx", new byte[]{1}));
        when(reports.exportCheckins(any(), any()))
                .thenReturn(new ReportService.ExportedFile("entradas.xlsx", new byte[]{2}));

        mvc.perform(get("/api/events/{id}/reports/sales.xlsx", EVENT_ID))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(XLSX));
        mvc.perform(get("/api/events/{id}/reports/checkins.xlsx", EVENT_ID))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(XLSX));
    }

    @Test
    @DisplayName("o resumo responde em JSON com os números do evento")
    void summaryIsJson() throws Exception {
        when(reports.summary(any(), any())).thenReturn(new ReportSummary(EVENT_ID, "Festival Aurora",
                "festival-aurora", "PUBLISHED", "Arena Central", OffsetDateTime.now(), OffsetDateTime.now(),
                2, 1, new BigDecimal("200.00"), new BigDecimal("20.00"), BigDecimal.ZERO, new BigDecimal("220.00"),
                2, 1, 0, 2, 1, 1, 0.5d, List.of(), OffsetDateTime.now()));

        mvc.perform(get("/api/events/{id}/reports/summary", EVENT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventName").value("Festival Aurora"))
                .andExpect(jsonPath("$.paidOrders").value(1))
                .andExpect(jsonPath("$.attendanceRate").value(0.5));
    }

    @Test
    @DisplayName("as exportações CSV continuam respondendo como antes")
    void csvStillWorks() throws Exception {
        AdminQueryService queries = mock(AdminQueryService.class);
        when(queries.salesCsv(any(), any())).thenReturn("pedido,status\nEA-0001,PAID\n");
        MockMvc csvMvc = MockMvcBuilders.standaloneSetup(new AdminResourceController(queries, reports))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        csvMvc.perform(get("/api/events/{id}/reports/sales", EVENT_ID))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("EA-0001")));
    }
}
