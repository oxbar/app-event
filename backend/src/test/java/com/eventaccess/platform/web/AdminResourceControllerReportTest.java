package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.domain.Enums.Role;
import com.eventaccess.platform.service.AdminQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AdminResourceControllerReportTest {
    private final AdminQueryService service = mock(AdminQueryService.class);
    private final AdminResourceController controller = new AdminResourceController(service);
    private final AppPrincipal principal = new AppPrincipal(
            UUID.randomUUID(), UUID.randomUUID(), "Organizador", "organizer@example.com", "", Set.of(Role.ORGANIZER_ADMIN));

    @Test
    void returnsExcelContentTypeAndAttachment() {
        UUID eventId = UUID.randomUUID();
        byte[] workbook = {(byte) 'P', (byte) 'K', 3, 4};
        when(service.salesXlsx(principal, eventId)).thenReturn(workbook);

        var response = controller.sales(principal, eventId, "xlsx");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("vendas.xlsx");
        assertThat(response.getBody()).isEqualTo(workbook);
    }

    @Test
    void keepsCsvAsDefaultFormat() {
        UUID eventId = UUID.randomUUID();
        when(service.checkinsCsv(principal, eventId)).thenReturn("resultado,participante\n");

        var response = controller.checkins(principal, eventId, "csv");

        assertThat(response.getHeaders().getContentType().toString()).startsWith("text/csv");
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("entradas.csv");
    }
}
