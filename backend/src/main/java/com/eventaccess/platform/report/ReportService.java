package com.eventaccess.platform.report;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Relatórios do evento: números consolidados e exportação em XLSX.
 *
 * <p>As exportações em CSV continuam onde sempre estiveram
 * ({@code AdminQueryService}); esta classe acrescenta a planilha, que é o que a
 * operação de fato abre no fim do evento — com resumo, vendas, ingressos e
 * entradas em abas separadas.</p>
 */
@Service
public class ReportService {
    private static final DateTimeFormatter FILE_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");
    private static final DateTimeFormatter HUMAN = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final EventRepository events;
    private final OrderRepository orders;
    private final TicketRepository tickets;
    private final TicketTypeRepository ticketTypes;
    private final CheckinRepository checkins;
    private final String fallbackTimezone;

    public ReportService(EventRepository events, OrderRepository orders, TicketRepository tickets,
                         TicketTypeRepository ticketTypes, CheckinRepository checkins,
                         @Value("${app.reports.timezone:America/Sao_Paulo}") String fallbackTimezone) {
        this.events = events;
        this.orders = orders;
        this.tickets = tickets;
        this.ticketTypes = ticketTypes;
        this.checkins = checkins;
        this.fallbackTimezone = fallbackTimezone;
    }

    @Transactional(readOnly = true)
    public ReportSummary summary(AppPrincipal principal, UUID eventId) {
        Event event = requireEvent(principal, eventId);
        return buildSummary(event, orders.findByEventId(eventId), ticketsOf(principal, eventId),
                ticketTypes.findByEventIdOrderBySortOrderAsc(eventId),
                checkins.findByEventIdOrderByScannedAtDesc(eventId));
    }

    @Transactional(readOnly = true)
    public byte[] salesWorkbook(AppPrincipal principal, UUID eventId) {
        return exportSales(principal, eventId).content();
    }

    @Transactional(readOnly = true)
    public byte[] checkinsWorkbook(AppPrincipal principal, UUID eventId) {
        return exportCheckins(principal, eventId).content();
    }

    /** Pasta de trabalho completa: resumo, vendas, ingressos e entradas. */
    @Transactional(readOnly = true)
    public byte[] fullWorkbook(AppPrincipal principal, UUID eventId) {
        return exportFull(principal, eventId).content();
    }

    /**
     * Gera nome e conteúdo no mesmo contexto transacional.
     *
     * <p>O nome usa o fuso da organização, que é uma associação LAZY do evento.
     * Separar {@code fileName()} da geração fazia o controller acessar essa
     * associação depois que a sessão JPA já havia sido fechada.</p>
     */
    @Transactional(readOnly = true)
    public ExportedFile exportSales(AppPrincipal principal, UUID eventId) {
        Event event = requireEvent(principal, eventId);
        ZoneId zone = zoneOf(event);
        List<Order> eventOrders = orders.findByEventId(eventId);
        List<Ticket> eventTickets = ticketsOf(principal, eventId);
        try (ExcelReportWriter writer = new ExcelReportWriter(zone)) {
            writeSales(writer, event, eventOrders, eventTickets);
            return exported("vendas", event, zone, writer.toByteArray());
        }
    }

    @Transactional(readOnly = true)
    public ExportedFile exportCheckins(AppPrincipal principal, UUID eventId) {
        Event event = requireEvent(principal, eventId);
        ZoneId zone = zoneOf(event);
        try (ExcelReportWriter writer = new ExcelReportWriter(zone)) {
            writeCheckins(writer, event, checkins.findByEventIdOrderByScannedAtDesc(eventId));
            return exported("entradas", event, zone, writer.toByteArray());
        }
    }

    /** Pasta de trabalho completa: resumo, vendas, ingressos e entradas. */
    @Transactional(readOnly = true)
    public ExportedFile exportFull(AppPrincipal principal, UUID eventId) {
        Event event = requireEvent(principal, eventId);
        ZoneId zone = zoneOf(event);
        List<Order> eventOrders = orders.findByEventId(eventId);
        List<Ticket> eventTickets = ticketsOf(principal, eventId);
        List<TicketType> types = ticketTypes.findByEventIdOrderBySortOrderAsc(eventId);
        List<Checkin> eventCheckins = checkins.findByEventIdOrderByScannedAtDesc(eventId);
        ReportSummary summary = buildSummary(event, eventOrders, eventTickets, types, eventCheckins);

        try (ExcelReportWriter writer = new ExcelReportWriter(zone)) {
            writeSummary(writer, event, summary, zone);
            writeSales(writer, event, eventOrders, eventTickets);
            writeTickets(writer, event, eventTickets);
            writeCheckins(writer, event, eventCheckins);
            return exported("relatorio", event, zone, writer.toByteArray());
        }
    }

    /** Mantido para compatibilidade; o controller usa os métodos export* acima. */
    @Transactional(readOnly = true)
    public String fileName(String prefix, AppPrincipal principal, UUID eventId) {
        Event event = requireEvent(principal, eventId);
        return fileName(prefix, event, zoneOf(event));
    }

    // ------------------------------------------------------------------ dados

    private Event requireEvent(AppPrincipal principal, UUID eventId) {
        return events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
    }

    private List<Ticket> ticketsOf(AppPrincipal principal, UUID eventId) {
        return tickets.findByEventIdAndEventOrganizationId(eventId, principal.organizationId(), Pageable.unpaged())
                .getContent();
    }

    private ReportSummary buildSummary(Event event, List<Order> eventOrders, List<Ticket> eventTickets,
                                       List<TicketType> types, List<Checkin> eventCheckins) {
        List<Order> paid = eventOrders.stream().filter(order -> order.getStatus() == OrderStatus.PAID).toList();
        BigDecimal gross = sum(paid, Order::getSubtotal);
        BigDecimal fees = sum(paid, Order::getServiceFee);
        BigDecimal discounts = sum(paid, Order::getDiscountAmount);
        BigDecimal total = sum(paid, Order::getTotalAmount);

        long issued = eventTickets.stream().filter(ticket -> ticket.getStatus() != TicketStatus.PENDING_PAYMENT).count();
        long used = eventTickets.stream().filter(ticket -> ticket.getStatus() == TicketStatus.USED).count();
        long blocked = eventTickets.stream().filter(ticket -> ticket.getStatus() == TicketStatus.BLOCKED).count();
        long approvedCheckins = eventCheckins.stream()
                .filter(checkin -> checkin.getResult() == CheckinResult.APPROVED).count();
        long deniedCheckins = eventCheckins.size() - approvedCheckins;

        Map<UUID, Long> issuedByType = eventTickets.stream()
                .filter(ticket -> ticket.getTicketType() != null)
                .collect(Collectors.groupingBy(ticket -> ticket.getTicketType().getId(), Collectors.counting()));
        Map<UUID, Long> usedByType = eventTickets.stream()
                .filter(ticket -> ticket.getTicketType() != null && ticket.getStatus() == TicketStatus.USED)
                .collect(Collectors.groupingBy(ticket -> ticket.getTicketType().getId(), Collectors.counting()));

        List<ReportSummary.TicketTypeLine> lines = types.stream().map(type -> {
            long typeIssued = issuedByType.getOrDefault(type.getId(), 0L);
            long typeUsed = usedByType.getOrDefault(type.getId(), 0L);
            BigDecimal revenue = type.getPrice().add(type.getServiceFee())
                    .multiply(BigDecimal.valueOf(type.getSoldQuantity()));
            int available = Math.max(0, type.getTotalQuantity() - type.getSoldQuantity() - type.getReservedQuantity());
            return new ReportSummary.TicketTypeLine(type.getId(), type.getName(), type.getCategory(),
                    type.getWristbandLabel(), type.getPrice(), type.getServiceFee(), type.getTotalQuantity(),
                    type.getSoldQuantity(), type.getReservedQuantity(), available, typeIssued, typeUsed, revenue);
        }).toList();

        return new ReportSummary(event.getId(), event.getName(), event.getSlug(), event.getStatus().name(),
                event.getVenueName(), event.getStartsAt(), event.getEndsAt(),
                eventOrders.size(), paid.size(), gross, fees, discounts, total,
                issued, used, blocked, eventCheckins.size(), approvedCheckins, deniedCheckins,
                ratio(used, issued), lines, OffsetDateTime.now());
    }

    // ------------------------------------------------------------------- abas

    private void writeSummary(ExcelReportWriter writer, Event event, ReportSummary summary, ZoneId zone) {
        ExcelReportWriter.SheetWriter sheet = writer.sheet("Resumo", summary.eventName(),
                "Gerado em " + summary.generatedAt().atZoneSameInstant(zone).format(HUMAN)
                        + " (" + zone.getId() + ")");

        sheet.widths(34, 26, 14, 14, 14, 14, 14, 14, 14, 16);
        sheet.keyValue("Evento", summary.eventName());
        sheet.keyValue("Situação", summary.eventStatus());
        sheet.keyValue("Local", value(summary.venueName()));
        sheet.keyValue("Início", summary.startsAt() == null ? "—"
                : summary.startsAt().atZoneSameInstant(zone).format(HUMAN));
        sheet.keyValue("Término", summary.endsAt() == null ? "—"
                : summary.endsAt().atZoneSameInstant(zone).format(HUMAN));
        sheet.blank();

        sheet.heading("Vendas");
        sheet.keyValue("Pedidos criados", summary.totalOrders());
        sheet.keyValue("Pedidos pagos", summary.paidOrders());
        sheet.keyValue("Receita bruta", summary.grossAmount());
        sheet.keyValue("Taxas de serviço", summary.serviceFees());
        sheet.keyValue("Descontos", summary.discounts());
        sheet.keyValue("Total recebido", summary.totalAmount());
        sheet.blank();

        sheet.heading("Acesso");
        sheet.keyValue("Ingressos emitidos", summary.issuedTickets());
        sheet.keyValue("Ingressos utilizados", summary.usedTickets());
        sheet.keyValue("Ingressos bloqueados", summary.blockedTickets());
        sheet.keyValue("Leituras na portaria", summary.totalCheckins());
        sheet.keyValue("Leituras aprovadas", summary.approvedCheckins());
        sheet.keyValue("Leituras negadas", summary.deniedCheckins());
        sheet.keyValuePercent("Comparecimento", summary.attendanceRate());
        sheet.blank();

        sheet.heading("Vendas por tipo de ingresso");
        sheet.headers("Tipo", "Categoria", "Pulseira", "Preço", "Taxa", "Lote", "Vendidos",
                "Reservados", "Disponíveis", "Receita");
        for (ReportSummary.TicketTypeLine line : summary.ticketTypes()) {
            sheet.row(writer.text(line.name()), writer.text(line.category()), writer.text(value(line.wristband())),
                    writer.money(line.price()), writer.money(line.serviceFee()), writer.integer(line.totalQuantity()),
                    writer.integer(line.soldQuantity()), writer.integer(line.reservedQuantity()),
                    writer.integer(line.availableQuantity()), writer.money(line.revenue()));
        }
        sheet.totals("Total", "", "", "", "",
                summary.ticketTypes().stream().mapToLong(ReportSummary.TicketTypeLine::totalQuantity).sum(),
                summary.ticketTypes().stream().mapToLong(ReportSummary.TicketTypeLine::soldQuantity).sum(),
                summary.ticketTypes().stream().mapToLong(ReportSummary.TicketTypeLine::reservedQuantity).sum(),
                summary.ticketTypes().stream().mapToLong(ReportSummary.TicketTypeLine::availableQuantity).sum(),
                summary.ticketTypes().stream().map(ReportSummary.TicketTypeLine::revenue)
                        .reduce(BigDecimal.ZERO, BigDecimal::add));
        sheet.finish();
    }

    private void writeSales(ExcelReportWriter writer, Event event, List<Order> eventOrders, List<Ticket> eventTickets) {
        Map<UUID, Long> ticketsByOrder = eventTickets.stream()
                .filter(ticket -> ticket.getOrder() != null)
                .collect(Collectors.groupingBy(ticket -> ticket.getOrder().getId(), Collectors.counting()));

        ExcelReportWriter.SheetWriter sheet = writer.sheet("Vendas", event.getName() + " — vendas",
                "Um pedido por linha. Valores em " + currency(eventOrders) + ".");
        sheet.widths(16, 18, 28, 30, 12, 14, 14, 14, 14, 18, 20, 20);
        sheet.headers("Pedido", "Status", "Comprador", "E-mail", "Ingressos", "Subtotal", "Taxa",
                "Desconto", "Total", "Origem", "Criado em", "Pago em");

        for (Order order : eventOrders) {
            sheet.row(
                    writer.text(order.getPublicCode()),
                    writer.text(order.getStatus().name()),
                    writer.text(order.getBuyer() == null ? "" : order.getBuyer().getName()),
                    writer.text(order.getBuyer() == null ? "" : order.getBuyer().getEmail()),
                    writer.integer(ticketsByOrder.getOrDefault(order.getId(), 0L)),
                    writer.money(order.getSubtotal()),
                    writer.money(order.getServiceFee()),
                    writer.money(order.getDiscountAmount()),
                    writer.money(order.getTotalAmount()),
                    writer.text(order.getSource() == null ? "" : order.getSource().name()),
                    writer.dateTime(order.getCreatedAt()),
                    writer.dateTime(order.getPaidAt()));
        }

        List<Order> paid = eventOrders.stream().filter(order -> order.getStatus() == OrderStatus.PAID).toList();
        sheet.totals("Total pago", "", "", "",
                paid.stream().mapToLong(order -> ticketsByOrder.getOrDefault(order.getId(), 0L)).sum(),
                sum(paid, Order::getSubtotal), sum(paid, Order::getServiceFee),
                sum(paid, Order::getDiscountAmount), sum(paid, Order::getTotalAmount), "", "", "");
        sheet.finish();
    }

    private void writeTickets(ExcelReportWriter writer, Event event, List<Ticket> eventTickets) {
        ExcelReportWriter.SheetWriter sheet = writer.sheet("Ingressos", event.getName() + " — ingressos",
                "Situação individual de cada ingresso emitido.");
        sheet.widths(20, 22, 18, 28, 30, 16, 18, 20, 20);
        sheet.headers("Código", "Tipo", "Pulseira", "Participante", "E-mail", "Status", "Pedido",
                "Emitido em", "Check-in em");

        for (Ticket ticket : eventTickets) {
            TicketType type = ticket.getTicketType();
            Attendee attendee = ticket.getAttendee();
            sheet.row(
                    writer.text(ticket.getPublicCode()),
                    writer.text(type == null ? "" : type.getName()),
                    writer.text(type == null ? "" : value(type.getWristbandLabel())),
                    writer.text(attendee == null ? "" : attendee.getName()),
                    writer.text(attendee == null ? "" : value(attendee.getEmail())),
                    writer.text(ticket.getStatus().name()),
                    writer.text(ticket.getOrder() == null ? "" : ticket.getOrder().getPublicCode()),
                    writer.dateTime(ticket.getIssuedAt()),
                    writer.dateTime(ticket.getCheckedInAt()));
        }
        sheet.finish();
    }

    private void writeCheckins(ExcelReportWriter writer, Event event, List<Checkin> eventCheckins) {
        ExcelReportWriter.SheetWriter sheet = writer.sheet("Entradas", event.getName() + " — entradas",
                "Cada leitura na portaria, da mais recente para a mais antiga.");
        sheet.widths(20, 20, 28, 20, 22, 22, 26, 34);
        sheet.headers("Horário", "Resultado", "Participante", "Ingresso", "Tipo", "Portaria",
                "Operador", "Motivo");

        for (Checkin checkin : eventCheckins) {
            Ticket ticket = checkin.getTicket();
            Attendee attendee = ticket == null ? null : ticket.getAttendee();
            TicketType type = ticket == null ? null : ticket.getTicketType();
            sheet.row(
                    writer.dateTime(checkin.getScannedAt()),
                    writer.text(checkin.getResult().name()),
                    writer.text(attendee == null ? "" : attendee.getName()),
                    writer.text(ticket == null ? "" : ticket.getPublicCode()),
                    writer.text(type == null ? "" : type.getName()),
                    writer.text(checkin.getAccessPoint() == null ? "" : checkin.getAccessPoint().getName()),
                    writer.text(checkin.getStaffUser() == null ? "" : checkin.getStaffUser().getName()),
                    writer.text(value(checkin.getReason())));
        }
        sheet.finish();
    }

    // ---------------------------------------------------------------- helpers

    private ZoneId zoneOf(Event event) {
        String configured = event.getOrganization() == null ? null : event.getOrganization().getTimezone();
        for (String candidate : new String[]{configured, fallbackTimezone}) {
            if (candidate == null || candidate.isBlank()) continue;
            try {
                return ZoneId.of(candidate.trim());
            } catch (DateTimeException ignored) {
                // Fuso inválido no cadastro não pode derrubar o relatório.
            }
        }
        return ZoneId.systemDefault();
    }

    private ExportedFile exported(String prefix, Event event, ZoneId zone, byte[] content) {
        return new ExportedFile(fileName(prefix, event, zone), content);
    }

    private String fileName(String prefix, Event event, ZoneId zone) {
        String slug = event.getSlug() == null || event.getSlug().isBlank()
                ? event.getId().toString() : event.getSlug();
        return "%s-%s-%s.xlsx".formatted(prefix, slug, OffsetDateTime.now(zone).format(FILE_STAMP));
    }

    private static String currency(List<Order> eventOrders) {
        return eventOrders.stream().map(Order::getCurrency).filter(Objects::nonNull).findFirst().orElse("BRL");
    }

    private static String value(String raw) {
        return raw == null || raw.isBlank() ? "—" : raw;
    }

    private static BigDecimal sum(List<Order> source, Function<Order, BigDecimal> field) {
        return source.stream().map(field).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static double ratio(long part, long total) {
        if (total <= 0) return 0d;
        return BigDecimal.valueOf(part).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP).doubleValue();
    }

    public record ExportedFile(String filename, byte[] content) {
        public ExportedFile {
            Objects.requireNonNull(filename, "filename");
            Objects.requireNonNull(content, "content");
        }
    }
}
