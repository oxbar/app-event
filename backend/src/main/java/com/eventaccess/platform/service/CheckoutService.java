package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.payment.PaymentProvider;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class CheckoutService {
    private final EventRepository events;
    private final TicketTypeRepository types;
    private final AttendeeRepository attendees;
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final PaymentRepository payments;
    private final TicketRepository tickets;
    private final PaymentProvider provider;
    private final CryptoService crypto;
    private final SensitiveDataCryptoService sensitiveData;
    private final QrCodeService qr;

    public CheckoutService(EventRepository events, TicketTypeRepository types, AttendeeRepository attendees,
                           OrderRepository orders, OrderItemRepository items, PaymentRepository payments,
                           TicketRepository tickets, PaymentProvider provider, CryptoService crypto,
                           SensitiveDataCryptoService sensitiveData, QrCodeService qr) {
        this.events = events;
        this.types = types;
        this.attendees = attendees;
        this.orders = orders;
        this.items = items;
        this.payments = payments;
        this.tickets = tickets;
        this.provider = provider;
        this.crypto = crypto;
        this.sensitiveData = sensitiveData;
        this.qr = qr;
    }

    @Transactional
    public OrderView checkout(UUID eventId, CheckoutRequest request) {
        Event event = events.findForCheckout(eventId)
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        OffsetDateTime now = OffsetDateTime.now();
        validateSalesWindow(event, now);
        if (event.isRequireDocument() && blank(request.buyer().documentNumber())) {
            throw ApiException.badRequest("DOCUMENT_REQUIRED", "Documento é obrigatório para este evento.");
        }

        Map<UUID, Integer> requestedQuantities = new TreeMap<>();
        for (Item item : request.items()) {
            requestedQuantities.merge(item.ticketTypeId(), item.quantity(), Integer::sum);
        }
        int totalTickets = requestedQuantities.values().stream().mapToInt(Integer::intValue).sum();
        if (request.participants() != null && !request.participants().isEmpty()
                && request.participants().size() != totalTickets) {
            throw ApiException.badRequest("PARTICIPANT_COUNT_MISMATCH",
                    "Informe exatamente um participante para cada ingresso.");
        }

        long committedCapacity = types.countCommittedCapacity(eventId);
        if (event.getCapacity() != null && committedCapacity + totalTickets > event.getCapacity()) {
            throw ApiException.conflict("EVENT_CAPACITY_EXCEEDED", "A capacidade total do evento foi atingida.");
        }

        List<LockedType> lockedTypes = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal fees = BigDecimal.ZERO;
        for (Map.Entry<UUID, Integer> requested : requestedQuantities.entrySet()) {
            TicketType type = types.findForUpdate(requested.getKey())
                    .orElseThrow(() -> ApiException.notFound("Tipo de ingresso não encontrado."));
            validateTicketType(eventId, type, requested.getValue(), now);
            type.setReservedQuantity(type.getReservedQuantity() + requested.getValue());
            subtotal = subtotal.add(type.getPrice().multiply(BigDecimal.valueOf(requested.getValue())));
            fees = fees.add(type.getServiceFee().multiply(BigDecimal.valueOf(requested.getValue())));
            lockedTypes.add(new LockedType(type, requested.getValue()));
        }

        Attendee buyer = saveAttendee(request.buyer());
        List<Attendee> participantRecords = new ArrayList<>();
        if (request.participants() == null || request.participants().isEmpty()) {
            for (int i = 0; i < totalTickets; i++) participantRecords.add(buyer);
        } else {
            request.participants().forEach(participant -> participantRecords.add(saveAttendee(participant)));
        }

        Order order = orders.save(Order.builder()
                .organization(event.getOrganization())
                .event(event)
                .buyer(buyer)
                .publicCode("ORD-" + crypto.randomToken().substring(0, 22))
                .status(OrderStatus.PENDING_PAYMENT)
                .subtotal(subtotal)
                .serviceFee(fees)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(subtotal.add(fees))
                .currency("BRL")
                .expiresAt(now.plusMinutes(20))
                .source(OrderSource.ONLINE_CHECKOUT)
                .build());

        Iterator<Attendee> participantIterator = participantRecords.iterator();
        for (LockedType locked : lockedTypes) {
            OrderItem orderItem = items.save(OrderItem.builder()
                    .order(order)
                    .ticketType(locked.type())
                    .quantity(locked.quantity())
                    .unitPrice(locked.type().getPrice())
                    .serviceFeeUnit(locked.type().getServiceFee())
                    .discountAmount(BigDecimal.ZERO)
                    .totalAmount(locked.type().getPrice().add(locked.type().getServiceFee())
                            .multiply(BigDecimal.valueOf(locked.quantity())))
                    .build());
            for (int index = 0; index < locked.quantity(); index++) {
                tickets.save(Ticket.builder()
                        .event(event)
                        .ticketType(locked.type())
                        .order(order)
                        .orderItem(orderItem)
                        .attendee(participantIterator.next())
                        .publicCode("TKT-" + crypto.randomToken().substring(0, 22))
                        .qrTokenHash("pending:" + UUID.randomUUID())
                        .status(TicketStatus.PENDING_PAYMENT)
                        .build());
            }
        }
        return view(order, null, tickets.findByOrderId(order.getId()));
    }

    @Transactional
    public PaymentView createPix(String publicCode) {
        Order order = orders.findForUpdateByPublicCode(publicCode)
                .orElseThrow(() -> ApiException.notFound("Pedido não encontrado."));
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw ApiException.conflict("INVALID_ORDER_STATUS", "Pedido não está aguardando pagamento.");
        }
        if (order.getExpiresAt() != null && order.getExpiresAt().isBefore(OffsetDateTime.now())) {
            expireOrder(order);
            throw ApiException.conflict("ORDER_EXPIRED", "O prazo para pagamento expirou.");
        }
        Optional<Payment> existing = payments.findFirstByOrderIdOrderByCreatedAtDesc(order.getId());
        if (existing.isPresent() && existing.get().getStatus() == PaymentStatus.PENDING) {
            return PaymentView.from(existing.get());
        }
        Attendee buyer = order.getBuyer();
        String providerCustomerId = provider.name().equalsIgnoreCase(buyer.getPaymentProvider())
                ? buyer.getProviderCustomerId() : null;
        PaymentProvider.PixPayment created = provider.createPixPayment(new PaymentProvider.PixRequest(
                order.getPublicCode(),
                order.getEvent().getName() + " — pedido " + order.getPublicCode(),
                order.getTotalAmount(),
                order.getExpiresAt(),
                new PaymentProvider.Customer(
                        buyer.getId().toString(),
                        providerCustomerId,
                        buyer.getName(),
                        buyer.getEmail(),
                        buyer.getPhone(),
                        sensitiveData.decrypt(buyer.getDocumentNumberEncrypted()))));
        buyer.setPaymentProvider(provider.name());
        buyer.setProviderCustomerId(created.providerCustomerId());

        Payment payment = Payment.builder()
                .order(order)
                .provider(provider.name())
                .paymentMethod("PIX")
                .providerPaymentId(created.providerPaymentId())
                .idempotencyKey(provider.name().toLowerCase(Locale.ROOT) + ":pix:" + order.getId())
                .status(PaymentStatus.PENDING)
                .amount(order.getTotalAmount())
                .currency("BRL")
                .pixCopyPaste(created.copyPaste())
                .pixQrCodeUrl(created.qrCodeDataUrl())
                .expiresAt(earliest(order.getExpiresAt(), created.expiresAt()))
                .providerResponse(created.providerResponse())
                .build();
        return PaymentView.from(payments.save(payment));
    }

    @Transactional(readOnly = true)
    public TicketView publicTicket(String rawToken) {
        String token = normalizeTicketToken(rawToken);
        Ticket ticket = tickets.findByQrTokenHash(crypto.sha256(token))
                .orElseThrow(() -> ApiException.notFound("Ingresso não encontrado."));
        if (ticket.getStatus() == TicketStatus.PENDING_PAYMENT) {
            throw ApiException.notFound("Ingresso não encontrado.");
        }
        String value = qr.ticketUrl(token);
        return new TicketView(ticket.getPublicCode(), ticket.getStatus(), ticket.getAttendee().getName(),
                ticket.getTicketType().getName(), ticket.getTicketType().getWristbandLabel(),
                ticket.getTicketType().getWristbandColorName(), ticket.getTicketType().getWristbandColorHex(),
                value, qr.dataUrl(value, 360), ticket.getCheckedInAt());
    }

    @Transactional(readOnly = true)
    public OrderView status(String publicCode) {
        Order order = orders.findByPublicCode(publicCode)
                .orElseThrow(() -> ApiException.notFound("Pedido não encontrado."));
        Payment payment = payments.findFirstByOrderIdOrderByCreatedAtDesc(order.getId()).orElse(null);
        return view(order, payment, tickets.findByOrderId(order.getId()));
    }

    private Attendee saveAttendee(Buyer data) {
        String normalizedDocument = normalizeDocument(data.documentNumber());
        return attendees.save(Attendee.builder()
                .name(data.name())
                .email(data.email())
                .phone(data.phone())
                .documentType(data.documentType())
                .documentNumberEncrypted(sensitiveData.encrypt(normalizedDocument))
                .documentNumberHash(blank(normalizedDocument) ? null : crypto.sha256(normalizedDocument))
                .acceptedTermsAt(OffsetDateTime.now())
                .acceptedPrivacyAt(OffsetDateTime.now())
                .build());
    }

    private void validateSalesWindow(Event event, OffsetDateTime now) {
        if (event.getStatus() != EventStatus.SALES_OPEN && event.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("SALES_CLOSED", "As vendas não estão abertas.");
        }
        if (event.getSalesStartAt() != null && now.isBefore(event.getSalesStartAt())) {
            throw ApiException.conflict("SALES_NOT_STARTED", "As vendas ainda não começaram.");
        }
        if (event.getSalesEndAt() != null && now.isAfter(event.getSalesEndAt())) {
            throw ApiException.conflict("SALES_CLOSED", "As vendas foram encerradas.");
        }
    }

    private void validateTicketType(UUID eventId, TicketType type, int quantity, OffsetDateTime now) {
        if (!type.getEvent().getId().equals(eventId)) {
            throw ApiException.badRequest("WRONG_EVENT", "Tipo de ingresso inválido para este evento.");
        }
        if (type.getStatus() != TicketTypeStatus.ACTIVE) {
            throw ApiException.conflict("TICKET_TYPE_UNAVAILABLE", "Tipo de ingresso indisponível.");
        }
        if (type.getSalesStartAt() != null && now.isBefore(type.getSalesStartAt())
                || type.getSalesEndAt() != null && now.isAfter(type.getSalesEndAt())) {
            throw ApiException.conflict("TICKET_TYPE_UNAVAILABLE", "Período de venda deste ingresso está encerrado.");
        }
        int available = type.getTotalQuantity() - type.getSoldQuantity() - type.getReservedQuantity();
        if (quantity > type.getMaxPerOrder() || quantity > available) {
            throw ApiException.conflict("INSUFFICIENT_INVENTORY", "Quantidade de ingressos indisponível.");
        }
    }

    private void expireOrder(Order order) {
        order.setStatus(OrderStatus.EXPIRED);
        for (OrderItem item : items.findByOrderId(order.getId())) {
            TicketType type = types.findForUpdate(item.getTicketType().getId()).orElseThrow();
            type.setReservedQuantity(Math.max(0, type.getReservedQuantity() - item.getQuantity()));
        }
        tickets.findByOrderId(order.getId()).stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.PENDING_PAYMENT)
                .forEach(ticket -> ticket.setStatus(TicketStatus.EXPIRED));
    }

    private OrderView view(Order order, Payment payment, List<Ticket> orderTickets) {
        return new OrderView(order.getPublicCode(), order.getStatus(), order.getSubtotal(), order.getServiceFee(),
                order.getTotalAmount(), order.getCurrency(), order.getExpiresAt(), order.getPaidAt(),
                payment == null ? null : PaymentView.from(payment),
                orderTickets.stream().map(ticket -> {
                    if (ticket.getStatus() == TicketStatus.PENDING_PAYMENT) {
                        return new TicketView(ticket.getPublicCode(), ticket.getStatus(), ticket.getAttendee().getName(),
                                ticket.getTicketType().getName(), ticket.getTicketType().getWristbandLabel(),
                                ticket.getTicketType().getWristbandColorName(), ticket.getTicketType().getWristbandColorHex(),
                                null, null, ticket.getCheckedInAt());
                    }
                    String token = crypto.ticketToken(ticket.getId(), ticket.getPublicCode());
                    String value = qr.ticketUrl(token);
                    return new TicketView(ticket.getPublicCode(), ticket.getStatus(), ticket.getAttendee().getName(),
                            ticket.getTicketType().getName(), ticket.getTicketType().getWristbandLabel(),
                            ticket.getTicketType().getWristbandColorName(), ticket.getTicketType().getWristbandColorHex(),
                            value, qr.dataUrl(value, 360), ticket.getCheckedInAt());
                }).toList());
    }

    private OffsetDateTime earliest(OffsetDateTime first, OffsetDateTime second) {
        if (first == null) {
            return second;
        }
        if (second == null) {
            return first;
        }
        return first.isBefore(second) ? first : second;
    }

    private String normalizeTicketToken(String value) {
        String trimmed = value == null ? "" : value.trim();
        int marker = trimmed.lastIndexOf("/t/");
        return marker >= 0 ? trimmed.substring(marker + 3) : trimmed;
    }

    private String normalizeDocument(String value) {
        return value == null ? null : value.replaceAll("\\D", "");
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private record LockedType(TicketType type, int quantity) {}

    public record Buyer(@NotBlank String name, @Email @NotBlank String email, @NotBlank String phone,
                        String documentType, String documentNumber) {}
    public record Item(@NotNull UUID ticketTypeId, @Min(1) int quantity) {}
    public record CheckoutRequest(@Valid @NotNull Buyer buyer, @NotEmpty List<@Valid Item> items,
                                  List<@Valid Buyer> participants,
                                  @AssertTrue boolean acceptedTerms, @AssertTrue boolean acceptedPrivacy) {}
    public record PaymentView(UUID id, String provider, String paymentMethod, PaymentStatus status, BigDecimal amount,
                              String currency, String pixCopyPaste, String pixQrCodeUrl, OffsetDateTime expiresAt,
                              String invoiceUrl, boolean sandbox) {
        static PaymentView from(Payment payment) {
            Map<String, Object> response = payment.getProviderResponse() == null ? Map.of() : payment.getProviderResponse();
            Object invoice = response.get("invoiceUrl");
            Object sandboxValue = response.get("sandbox");
            return new PaymentView(payment.getId(), payment.getProvider(), payment.getPaymentMethod(), payment.getStatus(),
                    payment.getAmount(), payment.getCurrency(), payment.getPixCopyPaste(), payment.getPixQrCodeUrl(),
                    payment.getExpiresAt(), invoice == null ? null : String.valueOf(invoice),
                    sandboxValue instanceof Boolean value && value);
        }
    }
    public record TicketView(String publicCode, TicketStatus status, String attendeeName, String ticketType,
                             String wristbandLabel, String wristbandColorName, String wristbandColorHex,
                             String qrValue, String qrCodeDataUrl, OffsetDateTime checkedInAt) {}
    public record OrderView(String publicCode, OrderStatus status, BigDecimal subtotal, BigDecimal serviceFee,
                            BigDecimal totalAmount, String currency, OffsetDateTime expiresAt, OffsetDateTime paidAt,
                            PaymentView payment, List<TicketView> tickets) {}
}
