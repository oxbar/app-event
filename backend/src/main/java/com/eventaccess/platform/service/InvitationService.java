package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class InvitationService {
    private final InvitationRepository invitations;
    private final EventRepository events;
    private final TicketTypeRepository types;
    private final AttendeeRepository attendees;
    private final UserRepository users;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final TicketRepository tickets;
    private final CryptoService crypto;
    private final QrCodeService qrCodes;
    private final AuditService audit;

    public InvitationService(InvitationRepository invitations, EventRepository events, TicketTypeRepository types,
                             AttendeeRepository attendees, UserRepository users, OrderRepository orders,
                             OrderItemRepository orderItems, TicketRepository tickets, CryptoService crypto,
                             QrCodeService qrCodes, AuditService audit) {
        this.invitations = invitations;
        this.events = events;
        this.types = types;
        this.attendees = attendees;
        this.users = users;
        this.orders = orders;
        this.orderItems = orderItems;
        this.tickets = tickets;
        this.crypto = crypto;
        this.qrCodes = qrCodes;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<View> list(AppPrincipal principal, UUID eventId) {
        ownedEvent(principal, eventId);
        return invitations.findByEventIdOrderByCreatedAtDesc(eventId).stream().map(View::from).toList();
    }

    @Transactional
    public View create(AppPrincipal principal, UUID eventId, Request request) {
        Event event = ownedEvent(principal, eventId);
        TicketType type = types.findById(request.ticketTypeId())
                .filter(candidate -> candidate.getEvent().getId().equals(eventId))
                .orElseThrow(() -> ApiException.notFound("Tipo de ingresso não encontrado."));
        Attendee attendee = attendees.save(Attendee.builder()
                .name(request.name()).email(request.email()).phone(request.phone())
                .acceptedTermsAt(OffsetDateTime.now()).acceptedPrivacyAt(OffsetDateTime.now()).build());
        Invitation invitation = invitations.save(Invitation.builder()
                .event(event).ticketType(type).attendee(attendee)
                .invitedBy(users.findById(principal.userId()).orElseThrow())
                .code("INV-" + crypto.randomToken().substring(0, 28))
                .status(InvitationStatus.PENDING)
                .expiresAt(Optional.ofNullable(request.expiresAt()).orElse(event.getEndsAt()))
                .build());
        audit.record(principal, event, "INVITATION_CREATED", "INVITATION", invitation.getId(), null,
                Map.of("email", request.email(), "ticketType", type.getName()));
        return View.from(invitation);
    }

    @Transactional
    public CheckoutService.OrderView accept(String code) {
        Invitation invitation = invitations.findForUpdateByCode(code)
                .orElseThrow(() -> ApiException.notFound("Convite não encontrado."));
        if (invitation.getStatus() == InvitationStatus.ACCEPTED && invitation.getConvertedOrder() != null) {
            return orderView(invitation.getConvertedOrder());
        }
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw ApiException.conflict("INVITATION_UNAVAILABLE", "Convite não está disponível.");
        }
        if (invitation.getExpiresAt() != null && invitation.getExpiresAt().isBefore(OffsetDateTime.now())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            throw ApiException.conflict("INVITATION_EXPIRED", "Convite expirado.");
        }
        TicketType type = types.findForUpdate(invitation.getTicketType().getId()).orElseThrow();
        if (type.getSoldQuantity() + type.getReservedQuantity() >= type.getTotalQuantity()) {
            throw ApiException.conflict("INSUFFICIENT_INVENTORY", "Não há ingressos disponíveis para este convite.");
        }
        Event event = invitation.getEvent();
        if (event.getCapacity() != null && types.countCommittedCapacity(event.getId()) >= event.getCapacity()) {
            throw ApiException.conflict("EVENT_CAPACITY_EXCEEDED", "A capacidade total do evento foi atingida.");
        }
        type.setSoldQuantity(type.getSoldQuantity() + 1);
        OffsetDateTime now = OffsetDateTime.now();
        Order order = orders.save(Order.builder()
                .organization(event.getOrganization()).event(event).buyer(invitation.getAttendee())
                .publicCode("ORD-" + crypto.randomToken().substring(0, 22))
                .status(OrderStatus.PAID).subtotal(BigDecimal.ZERO).serviceFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO).totalAmount(BigDecimal.ZERO).currency("BRL")
                .paidAt(now).source(OrderSource.INVITATION).build());
        OrderItem item = orderItems.save(OrderItem.builder()
                .order(order).ticketType(type).quantity(1).unitPrice(BigDecimal.ZERO)
                .serviceFeeUnit(BigDecimal.ZERO).discountAmount(BigDecimal.ZERO).totalAmount(BigDecimal.ZERO).build());
        Ticket ticket = tickets.save(Ticket.builder()
                .event(event).ticketType(type).order(order).orderItem(item).attendee(invitation.getAttendee())
                .publicCode("TKT-" + crypto.randomToken().substring(0, 22))
                .qrTokenHash("pending:" + UUID.randomUUID()).status(TicketStatus.PENDING_PAYMENT).build());
        String token = crypto.ticketToken(ticket.getId(), ticket.getPublicCode());
        ticket.setQrTokenHash(crypto.sha256(token));
        ticket.setStatus(TicketStatus.VALID);
        ticket.setIssuedAt(now);
        ticket.setValidFrom(event.getStartsAt().minusHours(4));
        ticket.setValidUntil(event.getEndsAt().plusHours(2));
        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(now);
        invitation.setConvertedOrder(order);
        return orderView(order);
    }

    private CheckoutService.OrderView orderView(Order order) {
        Ticket ticket = tickets.findByOrderId(order.getId()).getFirst();
        String token = crypto.ticketToken(ticket.getId(), ticket.getPublicCode());
        return new CheckoutService.OrderView(order.getPublicCode(), order.getStatus(), order.getSubtotal(),
                order.getServiceFee(), order.getTotalAmount(), order.getCurrency(), order.getExpiresAt(),
                order.getPaidAt(), null, List.of(new CheckoutService.TicketView(ticket.getPublicCode(),
                ticket.getStatus(), ticket.getAttendee().getName(), ticket.getTicketType().getName(),
                ticket.getEvent().getName(), ticket.getEvent().getStartsAt(), ticket.getEvent().getVenueName(),
                ticket.getTicketType().getWristbandLabel(), ticket.getTicketType().getWristbandColorName(),
                ticket.getTicketType().getWristbandColorHex(), qrCodes.ticketUrl(token),
                qrCodes.dataUrl(qrCodes.ticketUrl(token), 320), ticket.getCheckedInAt())));
    }

    private Event ownedEvent(AppPrincipal principal, UUID eventId) {
        return events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
    }

    public record Request(@NotNull UUID ticketTypeId, @NotBlank String name, @Email @NotBlank String email,
                          String phone, OffsetDateTime expiresAt) {}
    public record View(UUID id, UUID eventId, UUID ticketTypeId, String ticketType, String attendeeName,
                       String attendeeEmail, String code, InvitationStatus status, OffsetDateTime expiresAt,
                       OffsetDateTime acceptedAt, String orderCode) {
        static View from(Invitation invitation) {
            return new View(invitation.getId(), invitation.getEvent().getId(), invitation.getTicketType().getId(),
                    invitation.getTicketType().getName(), invitation.getAttendee().getName(),
                    invitation.getAttendee().getEmail(), invitation.getCode(), invitation.getStatus(),
                    invitation.getExpiresAt(), invitation.getAcceptedAt(),
                    invitation.getConvertedOrder() == null ? null : invitation.getConvertedOrder().getPublicCode());
        }
    }
}
