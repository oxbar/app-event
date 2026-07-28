package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AdminQueryService {
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final TicketRepository tickets;
    private final AttendeeRepository attendees;
    private final EventRepository events;
    private final CheckinRepository checkins;
    private final AuditLogRepository auditLogs;
    private final AuditService audit;

    public AdminQueryService(OrderRepository orders, PaymentRepository payments, TicketRepository tickets,
                             AttendeeRepository attendees, EventRepository events, CheckinRepository checkins,
                             AuditLogRepository auditLogs, AuditService audit) {
        this.orders = orders;
        this.payments = payments;
        this.tickets = tickets;
        this.attendees = attendees;
        this.events = events;
        this.checkins = checkins;
        this.auditLogs = auditLogs;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Page<OrderAdminView> orders(AppPrincipal principal, Pageable pageable) {
        return orders.findByOrganizationId(principal.organizationId(), pageable).map(OrderAdminView::from);
    }

    @Transactional(readOnly = true)
    public OrderDetail order(AppPrincipal principal, UUID id) {
        Order order = orders.findByIdAndOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Pedido não encontrado."));
        return new OrderDetail(OrderAdminView.from(order),
                tickets.findByOrderId(order.getId()).stream().map(TicketAdminView::from).toList(),
                payments.findFirstByOrderIdOrderByCreatedAtDesc(order.getId())
                        .map(PaymentAdminView::from).orElse(null));
    }

    @Transactional(readOnly = true)
    public Page<PaymentAdminView> payments(AppPrincipal principal, Pageable pageable) {
        return payments.findByOrderOrganizationId(principal.organizationId(), pageable).map(PaymentAdminView::from);
    }

    @Transactional(readOnly = true)
    public Page<TicketAdminView> tickets(AppPrincipal principal, UUID eventId, Pageable pageable) {
        Page<Ticket> page = eventId == null
                ? tickets.findByEventOrganizationId(principal.organizationId(), pageable)
                : tickets.findByEventIdAndEventOrganizationId(eventId, principal.organizationId(), pageable);
        return page.map(TicketAdminView::from);
    }

    @Transactional
    public TicketAdminView block(AppPrincipal principal, UUID id, String reason) {
        Ticket ticket = tickets.findByIdAndEventOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Ingresso não encontrado."));
        if (ticket.getStatus() == TicketStatus.USED) {
            throw ApiException.conflict("TICKET_ALREADY_USED", "Ingresso já utilizado.");
        }
        TicketStatus previous = ticket.getStatus();
        ticket.setStatus(TicketStatus.BLOCKED);
        ticket.setBlockedAt(OffsetDateTime.now());
        ticket.setBlockReason(reason);
        audit.record(principal, ticket.getEvent(), "TICKET_BLOCKED", "TICKET", ticket.getId(),
                Map.of("status", previous.name()), Map.of("status", ticket.getStatus().name(), "reason", reason));
        return TicketAdminView.from(ticket);
    }

    @Transactional
    public TicketAdminView unblock(AppPrincipal principal, UUID id) {
        Ticket ticket = tickets.findByIdAndEventOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Ingresso não encontrado."));
        if (ticket.getStatus() != TicketStatus.BLOCKED) {
            throw ApiException.conflict("TICKET_NOT_BLOCKED", "Ingresso não está bloqueado.");
        }
        String previousReason = ticket.getBlockReason();
        ticket.setStatus(TicketStatus.VALID);
        ticket.setBlockedAt(null);
        ticket.setBlockReason(null);
        audit.record(principal, ticket.getEvent(), "TICKET_UNBLOCKED", "TICKET", ticket.getId(),
                Map.of("status", TicketStatus.BLOCKED.name(), "reason", Optional.ofNullable(previousReason).orElse("")),
                Map.of("status", TicketStatus.VALID.name()));
        return TicketAdminView.from(ticket);
    }

    @Transactional
    public TicketAdminView transfer(AppPrincipal principal, UUID id, TransferRequest request) {
        Ticket ticket = tickets.findByIdAndEventOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Ingresso não encontrado."));
        if (ticket.getStatus() == TicketStatus.USED || ticket.getStatus() == TicketStatus.REFUNDED
                || ticket.getStatus() == TicketStatus.CANCELED || ticket.getStatus() == TicketStatus.EXPIRED) {
            throw ApiException.conflict("TICKET_NOT_TRANSFERABLE", "Ingresso não pode ser transferido neste estado.");
        }
        Attendee previous = ticket.getAttendee();
        Attendee replacement = attendees.save(Attendee.builder()
                .name(request.name()).email(request.email()).phone(request.phone())
                .acceptedTermsAt(OffsetDateTime.now()).acceptedPrivacyAt(OffsetDateTime.now()).build());
        ticket.setAttendee(replacement);
        audit.record(principal, ticket.getEvent(), "TICKET_TRANSFERRED", "TICKET", ticket.getId(),
                Map.of("attendeeId", previous.getId().toString(), "email", Optional.ofNullable(previous.getEmail()).orElse("")),
                Map.of("attendeeId", replacement.getId().toString(), "email", request.email()));
        return TicketAdminView.from(ticket);
    }

    @Transactional
    public TicketAdminView resend(AppPrincipal principal, UUID id) {
        Ticket ticket = tickets.findByIdAndEventOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Ingresso não encontrado."));
        audit.record(principal, ticket.getEvent(), "TICKET_RESEND_REQUESTED", "TICKET", ticket.getId(), null,
                Map.of("email", Optional.ofNullable(ticket.getAttendee().getEmail()).orElse(""),
                        "delivery", "OUTBOX_READY"));
        return TicketAdminView.from(ticket);
    }

    @Transactional(readOnly = true)
    public Page<AttendeeView> attendees(AppPrincipal principal, Pageable pageable) {
        return attendees.findByOrganization(principal.organizationId(), pageable)
                .map(attendee -> new AttendeeView(attendee.getId(), attendee.getName(), attendee.getEmail(),
                        maskPhone(attendee.getPhone()), attendee.getDocumentNumberHash() == null ? null : "***.***.***-**",
                        attendee.getCreatedAt()));
    }

    @Transactional(readOnly = true)
    public Page<AuditView> audit(AppPrincipal principal, Pageable pageable) {
        return auditLogs.findByOrganizationId(principal.organizationId(), pageable).map(AuditView::from);
    }

    @Transactional(readOnly = true)
    public String salesCsv(AppPrincipal principal, UUID eventId) {
        events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        StringBuilder csv = new StringBuilder("pedido,status,comprador,subtotal,taxa,total,pago_em\n");
        for (Order order : orders.findByEventId(eventId)) {
            csv.append(csv(order.getPublicCode())).append(',')
                    .append(order.getStatus()).append(',')
                    .append(csv(order.getBuyer().getName())).append(',')
                    .append(order.getSubtotal()).append(',')
                    .append(order.getServiceFee()).append(',')
                    .append(order.getTotalAmount()).append(',')
                    .append(order.getPaidAt() == null ? "" : order.getPaidAt())
                    .append('\n');
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public String checkinsCsv(AppPrincipal principal, UUID eventId) {
        events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        StringBuilder csv = new StringBuilder("resultado,participante,portaria,funcionario,horario,motivo\n");
        for (Checkin checkin : checkins.findByEventIdOrderByScannedAtDesc(eventId)) {
            csv.append(checkin.getResult()).append(',')
                    .append(csv(checkin.getTicket() == null ? "" : checkin.getTicket().getAttendee().getName())).append(',')
                    .append(csv(checkin.getAccessPoint() == null ? "" : checkin.getAccessPoint().getName())).append(',')
                    .append(csv(checkin.getStaffUser().getName())).append(',')
                    .append(checkin.getScannedAt()).append(',')
                    .append(csv(checkin.getReason()))
                    .append('\n');
        }
        return csv.toString();
    }

    private String csv(String value) {
        return '"' + (value == null ? "" : value.replace("\"", "\"\"")) + '"';
    }

    private String maskPhone(String value) {
        if (value == null || value.length() < 4) return value;
        return "***" + value.substring(value.length() - 4);
    }

    public record OrderAdminView(UUID id, String publicCode, String eventName, String buyerName,
                                 String buyerEmail, OrderStatus status, BigDecimal subtotal, BigDecimal serviceFee,
                                 BigDecimal totalAmount, String currency, OffsetDateTime expiresAt,
                                 OffsetDateTime paidAt, OffsetDateTime createdAt) {
        static OrderAdminView from(Order order) {
            return new OrderAdminView(order.getId(), order.getPublicCode(), order.getEvent().getName(),
                    order.getBuyer().getName(), order.getBuyer().getEmail(), order.getStatus(), order.getSubtotal(),
                    order.getServiceFee(), order.getTotalAmount(), order.getCurrency(), order.getExpiresAt(),
                    order.getPaidAt(), order.getCreatedAt());
        }
    }

    public record PaymentAdminView(UUID id, String orderCode, String provider, String method, PaymentStatus status,
                                   BigDecimal amount, String currency, String providerPaymentId,
                                   OffsetDateTime expiresAt, OffsetDateTime approvedAt, OffsetDateTime createdAt) {
        static PaymentAdminView from(Payment payment) {
            return new PaymentAdminView(payment.getId(), payment.getOrder().getPublicCode(), payment.getProvider(),
                    payment.getPaymentMethod(), payment.getStatus(), payment.getAmount(), payment.getCurrency(),
                    payment.getProviderPaymentId(), payment.getExpiresAt(), payment.getApprovedAt(),
                    payment.getCreatedAt());
        }
    }

    public record TicketAdminView(UUID id, String publicCode, String eventName, String typeName,
                                  String attendeeName, String attendeeEmail, TicketStatus status,
                                  String wristbandLabel, String wristbandColorName, String wristbandColorHex,
                                  OffsetDateTime issuedAt, OffsetDateTime checkedInAt, String blockReason) {
        static TicketAdminView from(Ticket ticket) {
            return new TicketAdminView(ticket.getId(), ticket.getPublicCode(), ticket.getEvent().getName(),
                    ticket.getTicketType().getName(), ticket.getAttendee().getName(), ticket.getAttendee().getEmail(),
                    ticket.getStatus(), ticket.getTicketType().getWristbandLabel(),
                    ticket.getTicketType().getWristbandColorName(), ticket.getTicketType().getWristbandColorHex(),
                    ticket.getIssuedAt(), ticket.getCheckedInAt(), ticket.getBlockReason());
        }
    }

    public record TransferRequest(@NotBlank String name, @Email @NotBlank String email, String phone) {}

    public record AttendeeView(UUID id, String name, String email, String phoneMasked,
                               String documentMasked, OffsetDateTime createdAt) {}

    public record AuditView(UUID id, String action, String entityType, UUID entityId,
                            Map<String, Object> previousData, Map<String, Object> newData,
                            OffsetDateTime createdAt) {
        static AuditView from(AuditLog log) {
            return new AuditView(log.getId(), log.getAction(), log.getEntityType(), log.getEntityId(),
                    log.getPreviousData(), log.getNewData(), log.getCreatedAt());
        }
    }

    public record OrderDetail(OrderAdminView order, List<TicketAdminView> tickets, PaymentAdminView payment) {}
}
