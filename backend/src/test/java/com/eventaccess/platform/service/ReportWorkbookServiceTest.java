package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.AccessPoint;
import com.eventaccess.platform.domain.Attendee;
import com.eventaccess.platform.domain.Checkin;
import com.eventaccess.platform.domain.Order;
import com.eventaccess.platform.domain.Ticket;
import com.eventaccess.platform.domain.UserAccount;
import com.eventaccess.platform.domain.Enums.CheckinResult;
import com.eventaccess.platform.domain.Enums.OrderSource;
import com.eventaccess.platform.domain.Enums.OrderStatus;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ReportWorkbookServiceTest {
    private final ReportWorkbookService service = new ReportWorkbookService();

    @Test
    void createsFormattedSalesWorkbook() throws Exception {
        Attendee buyer = Attendee.builder().name("Cliente Teste").email("cliente@example.com").build();
        Order order = Order.builder()
                .publicCode("ORD-123")
                .status(OrderStatus.PAID)
                .buyer(buyer)
                .subtotal(new BigDecimal("50.00"))
                .serviceFee(new BigDecimal("5.00"))
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("55.00"))
                .currency("BRL")
                .paidAt(OffsetDateTime.now())
                .source(OrderSource.ONLINE_CHECKOUT)
                .build();

        byte[] bytes = service.sales("Evento QA", List.of(order));

        assertThat(bytes).hasSizeGreaterThan(1_000);
        assertThat(bytes[0]).isEqualTo((byte) 'P');
        assertThat(bytes[1]).isEqualTo((byte) 'K');
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = workbook.getSheet("Vendas");
            assertThat(sheet).isNotNull();
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Relatório de vendas");
            assertThat(sheet.getRow(4).getCell(0).getStringCellValue()).isEqualTo("Pedido");
            assertThat(sheet.getRow(5).getCell(0).getStringCellValue()).isEqualTo("ORD-123");
            assertThat(sheet.getRow(5).getCell(6).getNumericCellValue()).isEqualTo(55.0);
            assertThat(sheet.getPaneInformation()).isNotNull();
        }
    }

    @Test
    void createsCheckinWorkbook() throws Exception {
        Attendee attendee = Attendee.builder().name("Convidado").email("convidado@example.com").build();
        Ticket ticket = Ticket.builder().attendee(attendee).publicCode("TKT-123").build();
        AccessPoint point = AccessPoint.builder().name("Entrada principal").build();
        UserAccount staff = UserAccount.builder().name("Operador").email("door@example.com").build();
        Checkin checkin = Checkin.builder()
                .ticket(ticket)
                .accessPoint(point)
                .staffUser(staff)
                .result(CheckinResult.APPROVED)
                .scannedAt(OffsetDateTime.now())
                .reason("Entrada liberada")
                .build();

        byte[] bytes = service.checkins("Evento QA", List.of(checkin));

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = workbook.getSheet("Entradas");
            assertThat(sheet.getRow(5).getCell(0).getStringCellValue()).isEqualTo("APPROVED");
            assertThat(sheet.getRow(5).getCell(2).getStringCellValue()).isEqualTo("TKT-123");
            assertThat(sheet.getRow(5).getCell(3).getStringCellValue()).isEqualTo("Entrada principal");
        }
    }
}
