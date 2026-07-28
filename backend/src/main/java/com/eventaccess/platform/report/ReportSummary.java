package com.eventaccess.platform.report;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Números consolidados de um evento.
 *
 * <p>Serve tanto para a aba "Resumo" da planilha quanto para os cartões da tela
 * de relatórios — a mesma fonte, para que o que a pessoa vê na tela seja o que
 * ela encontra no arquivo.</p>
 */
public record ReportSummary(
        UUID eventId,
        String eventName,
        String eventSlug,
        String eventStatus,
        String venueName,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        int totalOrders,
        int paidOrders,
        BigDecimal grossAmount,
        BigDecimal serviceFees,
        BigDecimal discounts,
        BigDecimal totalAmount,
        long issuedTickets,
        long usedTickets,
        long blockedTickets,
        long totalCheckins,
        long approvedCheckins,
        long deniedCheckins,
        double attendanceRate,
        List<TicketTypeLine> ticketTypes,
        OffsetDateTime generatedAt) {

    public record TicketTypeLine(
            UUID ticketTypeId,
            String name,
            String category,
            String wristband,
            BigDecimal price,
            BigDecimal serviceFee,
            int totalQuantity,
            int soldQuantity,
            int reservedQuantity,
            int availableQuantity,
            long issuedTickets,
            long usedTickets,
            BigDecimal revenue) {}
}
