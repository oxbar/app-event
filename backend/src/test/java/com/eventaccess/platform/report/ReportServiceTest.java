package com.eventaccess.platform.report;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A planilha só presta se abrir bonita e correta: por isso o teste gera o
 * arquivo de verdade e o lê de volta com o POI, conferindo abas, cabeçalhos,
 * tipos de célula (dinheiro é número, data é data) e a linha de totais.
 */
class ReportServiceTest {
    private static final UUID ORGANIZATION_ID = UUID.randomUUID();

    private EventRepository events;
    private OrderRepository orders;
    private TicketRepository tickets;
    private TicketTypeRepository ticketTypes;
    private CheckinRepository checkins;
    private ReportService service;

    private Event event;
    private TicketType commonType;
    private Order paidOrder;
    private Order pendingOrder;
    private AppPrincipal principal;

    @BeforeEach
    void setUp() {
        events = mock(EventRepository.class);
        orders = mock(OrderRepository.class);
        tickets = mock(TicketRepository.class);
        ticketTypes = mock(TicketTypeRepository.class);
        checkins = mock(CheckinRepository.class);
        service = new ReportService(events, orders, tickets, ticketTypes, checkins, "America/Sao_Paulo");

        Organization organization = Organization.builder()
                .name("Produtora Aurora").slug("aurora").status(OrganizationStatus.ACTIVE)
                .timezone("America/Sao_Paulo").build();
        organization.setId(ORGANIZATION_ID);

        event = Event.builder()
                .organization(organization)
                .name("Festival Aurora").slug("festival-aurora")
                .venueName("Arena Central")
                .startsAt(OffsetDateTime.of(2026, 8, 15, 22, 0, 0, 0, ZoneOffset.UTC))
                .endsAt(OffsetDateTime.of(2026, 8, 16, 5, 0, 0, 0, ZoneOffset.UTC))
                .status(EventStatus.PUBLISHED)
                .requireDocument(false).allowManualCheckin(true)
                .build();
        event.setId(UUID.randomUUID());

        commonType = TicketType.builder()
                .event(event).name("Pista").category("COMUM")
                .price(new BigDecimal("100.00")).serviceFee(new BigDecimal("10.00"))
                .totalQuantity(200).soldQuantity(2).reservedQuantity(1).maxPerOrder(5)
                .wristbandLabel("Verde").wristbandColorName("Verde").wristbandColorHex("#22c55e")
                .status(TicketTypeStatus.ACTIVE).sortOrder(1)
                .build();
        commonType.setId(UUID.randomUUID());

        Attendee buyer = attendee("Ana Souza", "ana@exemplo.com");
        paidOrder = order("EA-0001", OrderStatus.PAID, buyer, new BigDecimal("200.00"),
                new BigDecimal("20.00"), new BigDecimal("220.00"));
        paidOrder.setPaidAt(OffsetDateTime.of(2026, 8, 10, 13, 30, 0, 0, ZoneOffset.UTC));
        pendingOrder = order("EA-0002", OrderStatus.PENDING_PAYMENT, attendee("Bruno Dias", "bruno@exemplo.com"),
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("110.00"));

        principal = new AppPrincipal(UUID.randomUUID(), ORGANIZATION_ID, "Organizador",
                "organizer@eventaccess.local", "", Set.of(Role.ORGANIZER_ADMIN));

        Ticket used = ticket("TCK-0001", TicketStatus.USED, paidOrder, buyer);
        used.setCheckedInAt(OffsetDateTime.of(2026, 8, 15, 23, 5, 0, 0, ZoneOffset.UTC));
        Ticket valid = ticket("TCK-0002", TicketStatus.VALID, paidOrder, attendee("Caio Melo", "caio@exemplo.com"));

        Checkin approved = Checkin.builder()
                .event(event).ticket(used).result(CheckinResult.APPROVED)
                .staffUser(staff("Portaria 1"))
                .accessPoint(accessPoint("Entrada Principal"))
                .scannedAt(OffsetDateTime.of(2026, 8, 15, 23, 5, 0, 0, ZoneOffset.UTC))
                .build();
        approved.setId(UUID.randomUUID());
        Checkin denied = Checkin.builder()
                .event(event).result(CheckinResult.INVALID_QR_CODE)
                .staffUser(staff("Portaria 1"))
                .reason("QR Code não reconhecido")
                .scannedAt(OffsetDateTime.of(2026, 8, 15, 23, 10, 0, 0, ZoneOffset.UTC))
                .build();
        denied.setId(UUID.randomUUID());

        when(events.findByIdAndOrganizationId(any(), eq(ORGANIZATION_ID)))
                .thenAnswer(invocation -> event.getId().equals(invocation.getArgument(0))
                        ? Optional.of(event) : Optional.empty());
        when(orders.findByEventId(event.getId())).thenReturn(List.of(paidOrder, pendingOrder));
        Page<Ticket> page = new PageImpl<>(List.of(used, valid));
        when(tickets.findByEventIdAndEventOrganizationId(eq(event.getId()), eq(ORGANIZATION_ID), any(Pageable.class)))
                .thenReturn(page);
        when(ticketTypes.findByEventIdOrderBySortOrderAsc(event.getId())).thenReturn(List.of(commonType));
        when(checkins.findByEventIdOrderByScannedAtDesc(event.getId())).thenReturn(List.of(denied, approved));
    }

    @Test
    @DisplayName("o resumo consolida vendas, ingressos e comparecimento")
    void summarizesEvent() {
        ReportSummary summary = service.summary(principal, event.getId());

        assertThat(summary.eventName()).isEqualTo("Festival Aurora");
        assertThat(summary.totalOrders()).isEqualTo(2);
        assertThat(summary.paidOrders()).isEqualTo(1);
        // Somente pedidos pagos entram na receita.
        assertThat(summary.grossAmount()).isEqualByComparingTo("200.00");
        assertThat(summary.serviceFees()).isEqualByComparingTo("20.00");
        assertThat(summary.totalAmount()).isEqualByComparingTo("220.00");
        assertThat(summary.issuedTickets()).isEqualTo(2);
        assertThat(summary.usedTickets()).isEqualTo(1);
        assertThat(summary.totalCheckins()).isEqualTo(2);
        assertThat(summary.approvedCheckins()).isEqualTo(1);
        assertThat(summary.deniedCheckins()).isEqualTo(1);
        assertThat(summary.attendanceRate()).isEqualTo(0.5d);
        assertThat(summary.ticketTypes()).singleElement().satisfies(line -> {
            assertThat(line.name()).isEqualTo("Pista");
            assertThat(line.availableQuantity()).isEqualTo(197);
            assertThat(line.revenue()).isEqualByComparingTo("220.00");
        });
    }

    @Test
    @DisplayName("a pasta completa traz as quatro abas na ordem de leitura")
    void fullWorkbookHasAllSheets() throws IOException {
        try (Workbook workbook = open(service.fullWorkbook(principal, event.getId()))) {
            assertThat(sheetNames(workbook)).containsExactly("Resumo", "Vendas", "Ingressos", "Entradas");
        }
    }

    @Test
    @DisplayName("a aba de vendas tem cabeçalho, tipos corretos e linha de totais")
    void salesSheetIsWellFormed() throws IOException {
        try (Workbook workbook = open(service.salesWorkbook(principal, event.getId()))) {
            Sheet sheet = workbook.getSheet("Vendas");
            assertThat(sheet).isNotNull();

            Row header = findRow(sheet, "Pedido");
            assertThat(header).isNotNull();
            assertThat(texts(header)).startsWith("Pedido", "Status", "Comprador", "E-mail", "Ingressos",
                    "Subtotal", "Taxa", "Desconto", "Total");
            // Cabeçalho congelado e filtro ligado: a planilha abre pronta para uso.
            assertThat(sheet.getPaneInformation()).isNotNull();

            Row first = sheet.getRow(header.getRowNum() + 1);
            assertThat(first.getCell(0).getStringCellValue()).isEqualTo("EA-0001");
            assertThat(first.getCell(4).getNumericCellValue()).isEqualTo(2d);
            // Dinheiro precisa ser número, senão não soma no Excel.
            assertThat(first.getCell(8).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(first.getCell(8).getNumericCellValue()).isEqualTo(220d);
            assertThat(first.getCell(8).getCellStyle().getDataFormatString()).contains("R$");
            // Data precisa ser data, senão não ordena nem filtra por período.
            assertThat(DateUtil.isCellDateFormatted(first.getCell(11))).isTrue();

            Row totals = findRow(sheet, "Total pago");
            assertThat(totals).isNotNull();
            assertThat(totals.getCell(8).getNumericCellValue()).isEqualTo(220d);
        }
    }

    @Test
    @DisplayName("a aba de entradas registra aprovações e negativas")
    void checkinSheetListsEveryScan() throws IOException {
        try (Workbook workbook = open(service.checkinsWorkbook(principal, event.getId()))) {
            Sheet sheet = workbook.getSheet("Entradas");
            Row header = findRow(sheet, "Horário");
            assertThat(texts(header)).startsWith("Horário", "Resultado", "Participante", "Ingresso");

            List<String> results = List.of(
                    sheet.getRow(header.getRowNum() + 1).getCell(1).getStringCellValue(),
                    sheet.getRow(header.getRowNum() + 2).getCell(1).getStringCellValue());
            assertThat(results).containsExactlyInAnyOrder("INVALID_QR_CODE", "APPROVED");
            assertThat(sheet.getRow(header.getRowNum() + 1).getCell(7).getStringCellValue())
                    .isEqualTo("QR Code não reconhecido");
        }
    }

    @Test
    @DisplayName("o nome do arquivo identifica evento e momento da geração")
    void fileNameCarriesSlug() {
        String name = service.fileName("relatorio", principal, event.getId());

        assertThat(name).startsWith("relatorio-festival-aurora-").endsWith(".xlsx");
    }

    @Test
    @DisplayName("evento de outra organização não é exportado")
    void refusesEventFromAnotherOrganization() {
        AppPrincipal intruder = new AppPrincipal(UUID.randomUUID(), UUID.randomUUID(), "Outro",
                "outro@eventaccess.local", "", Set.of(Role.ORGANIZER_ADMIN));

        assertThatThrownBy(() -> service.fullWorkbook(intruder, event.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Evento não encontrado");
    }

    // ------------------------------------------------------------------ apoio

    private static Workbook open(byte[] bytes) throws IOException {
        assertThat(bytes).isNotEmpty();
        return new XSSFWorkbook(new ByteArrayInputStream(bytes));
    }

    private static List<String> sheetNames(Workbook workbook) {
        return java.util.stream.IntStream.range(0, workbook.getNumberOfSheets())
                .mapToObj(workbook::getSheetName).toList();
    }

    private static Row findRow(Sheet sheet, String firstCellText) {
        for (Row row : sheet) {
            Cell cell = row.getCell(0);
            if (cell != null && cell.getCellType() == CellType.STRING
                    && firstCellText.equals(cell.getStringCellValue())) {
                return row;
            }
        }
        return null;
    }

    private static String[] texts(Row row) {
        return java.util.stream.IntStream.range(0, row.getLastCellNum())
                .mapToObj(index -> {
                    Cell cell = row.getCell(index);
                    return cell == null || cell.getCellType() != CellType.STRING ? "" : cell.getStringCellValue();
                })
                .toArray(String[]::new);
    }

    private Attendee attendee(String name, String email) {
        Attendee attendee = Attendee.builder().name(name).email(email).build();
        attendee.setId(UUID.randomUUID());
        return attendee;
    }

    private UserAccount staff(String name) {
        UserAccount account = UserAccount.builder()
                .name(name).email(name.replace(' ', '.').toLowerCase() + "@eventaccess.local")
                .passwordHash("x").status(UserStatus.ACTIVE).build();
        account.setId(UUID.randomUUID());
        return account;
    }

    private AccessPoint accessPoint(String name) {
        AccessPoint point = AccessPoint.builder().event(event).name(name).status("ACTIVE").build();
        point.setId(UUID.randomUUID());
        return point;
    }

    private Order order(String code, OrderStatus status, Attendee buyer, BigDecimal subtotal,
                        BigDecimal fee, BigDecimal total) {
        Order order = Order.builder()
                .organization(event.getOrganization()).event(event).buyer(buyer)
                .publicCode(code).status(status)
                .subtotal(subtotal).serviceFee(fee).discountAmount(BigDecimal.ZERO).totalAmount(total)
                .currency("BRL").source(OrderSource.ONLINE_CHECKOUT)
                .build();
        order.setId(UUID.randomUUID());
        order.setCreatedAt(OffsetDateTime.of(2026, 8, 10, 13, 0, 0, 0, ZoneOffset.UTC));
        return order;
    }

    private Ticket ticket(String code, TicketStatus status, Order order, Attendee attendee) {
        Ticket ticket = Ticket.builder()
                .event(event).ticketType(commonType).order(order).attendee(attendee)
                .publicCode(code).qrTokenHash("hash-" + code).status(status)
                .issuedAt(OffsetDateTime.of(2026, 8, 10, 13, 5, 0, 0, ZoneOffset.UTC))
                .build();
        ticket.setId(UUID.randomUUID());
        return ticket;
    }
}
