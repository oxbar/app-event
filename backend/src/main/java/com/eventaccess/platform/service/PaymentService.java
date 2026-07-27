package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.payment.PaymentProvider;
import com.eventaccess.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class PaymentService {
    private final PaymentRepository payments;
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final TicketRepository tickets;
    private final TicketTypeRepository types;
    private final CryptoService crypto;
    private final QrCodeService qr;
    private final AuditService audit;
    private final PaymentProvider provider;

    public PaymentService(PaymentRepository payments, OrderRepository orders, OrderItemRepository items,
                          TicketRepository tickets, TicketTypeRepository types, CryptoService crypto,
                          QrCodeService qr, AuditService audit, PaymentProvider provider) {
        this.payments = payments;
        this.orders = orders;
        this.items = items;
        this.tickets = tickets;
        this.types = types;
        this.crypto = crypto;
        this.qr = qr;
        this.audit = audit;
        this.provider = provider;
    }

    @Transactional(readOnly = true)
    public void assertOwned(UUID paymentId, UUID organizationId) {
        payments.findByIdAndOrderOrganizationId(paymentId, organizationId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
    }

    @Transactional
    public CheckoutService.OrderView approveFake(UUID paymentId) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (!"FAKE".equalsIgnoreCase(payment.getProvider()) || !"FAKE".equalsIgnoreCase(provider.name())) {
            throw ApiException.conflict("MANUAL_APPROVAL_NOT_ALLOWED",
                    "Cobranças Asaas devem ser confirmadas no Sandbox do Asaas ou por webhook.");
        }
        return approve(paymentId);
    }

    @Transactional
    public CheckoutService.OrderView synchronize(UUID paymentId) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (!provider.name().equalsIgnoreCase(payment.getProvider())) {
            throw ApiException.conflict("PAYMENT_PROVIDER_MISMATCH", "O provedor ativo não corresponde ao pagamento.");
        }
        return reconcile(paymentId, provider.findPayment(payment.getProviderPaymentId()));
    }

    private CheckoutService.OrderView reconcile(UUID paymentId, PaymentProvider.ProviderPayment providerPayment) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (providerPayment.amount().compareTo(payment.getAmount()) != 0) {
            throw ApiException.badRequest("PAYMENT_AMOUNT_MISMATCH", "Valor retornado pelo provedor está divergente.");
        }
        payment.setProviderResponse(providerPayment.providerResponse());
        String status = providerPayment.status() == null ? "" : providerPayment.status().toUpperCase(Locale.ROOT);
        return switch (status) {
            case "APPROVED", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH" -> approve(paymentId);
            case "EXPIRED", "OVERDUE" -> {
                expire(paymentId);
                yield currentView(paymentId);
            }
            case "FAILED", "REJECTED", "REFUSED" -> {
                fail(paymentId, "Falha informada pelo provedor");
                yield currentView(paymentId);
            }
            default -> currentView(paymentId);
        };
    }

    @Transactional(readOnly = true)
    public CheckoutService.OrderView currentView(UUID paymentId) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        return view(payment.getOrder(), payment);
    }

    @Transactional
    public CheckoutService.OrderView approve(UUID paymentId) {
        Payment payment = payments.findForUpdate(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        Order order = orders.findForUpdate(payment.getOrder().getId()).orElseThrow();

        if (payment.getStatus() == PaymentStatus.APPROVED && order.getStatus() == OrderStatus.PAID) {
            return view(order, payment);
        }
        if (payment.getStatus() != PaymentStatus.PENDING && payment.getStatus() != PaymentStatus.CREATED) {
            throw ApiException.conflict("INVALID_PAYMENT_STATUS", "Pagamento não pode ser aprovado neste estado.");
        }
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw ApiException.conflict("INVALID_ORDER_STATUS", "Pedido não pode ser aprovado neste estado.");
        }
        if (order.getExpiresAt() != null && order.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw ApiException.conflict("ORDER_EXPIRED", "Pedido expirado; o pagamento precisa de análise manual.");
        }
        if (payment.getAmount().compareTo(order.getTotalAmount()) != 0) {
            throw ApiException.badRequest("PAYMENT_AMOUNT_MISMATCH", "Valor do pagamento divergente.");
        }

        List<OrderItem> orderItems = items.findByOrderId(order.getId());
        for (OrderItem item : orderItems) {
            TicketType type = types.findForUpdate(item.getTicketType().getId()).orElseThrow();
            if (type.getReservedQuantity() < item.getQuantity()) {
                throw ApiException.conflict("RESERVATION_NOT_FOUND", "A reserva de ingressos não está mais disponível.");
            }
            type.setReservedQuantity(type.getReservedQuantity() - item.getQuantity());
            type.setSoldQuantity(type.getSoldQuantity() + item.getQuantity());
        }

        OffsetDateTime approvedAt = OffsetDateTime.now();
        for (Ticket ticket : tickets.findByOrderId(order.getId())) {
            if (ticket.getStatus() != TicketStatus.PENDING_PAYMENT) continue;
            String token = crypto.ticketToken(ticket.getId(), ticket.getPublicCode());
            ticket.setQrTokenHash(crypto.sha256(token));
            ticket.setStatus(TicketStatus.VALID);
            ticket.setIssuedAt(approvedAt);
            ticket.setValidFrom(order.getEvent().getStartsAt().minusHours(4));
            ticket.setValidUntil(order.getEvent().getEndsAt().plusHours(2));
        }

        payment.setStatus(PaymentStatus.APPROVED);
        payment.setApprovedAt(approvedAt);
        order.setStatus(OrderStatus.PAID);
        order.setPaidAt(approvedAt);
        audit.system(order.getEvent(), "PAYMENT_APPROVED", "PAYMENT", payment.getId(),
                Map.of("orderId", order.getId().toString(), "amount", payment.getAmount().toPlainString()));
        return view(order, payment);
    }

    @Transactional
    public void fail(UUID paymentId, String reason) {
        Payment payment = payments.findForUpdate(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (payment.getStatus() == PaymentStatus.APPROVED || payment.getStatus() == PaymentStatus.FAILED) return;
        payment.setStatus(PaymentStatus.FAILED);
        payment.setFailedAt(OffsetDateTime.now());
        payment.setFailureReason(reason);
        payment.getOrder().setStatus(OrderStatus.PAYMENT_FAILED);
        release(payment.getOrder(), TicketStatus.CANCELED);
    }

    @Transactional
    public void expire(UUID paymentId) {
        Payment payment = payments.findForUpdate(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (payment.getStatus() == PaymentStatus.APPROVED || payment.getStatus() == PaymentStatus.EXPIRED) return;
        payment.setStatus(PaymentStatus.EXPIRED);
        payment.getOrder().setStatus(OrderStatus.EXPIRED);
        release(payment.getOrder(), TicketStatus.EXPIRED);
    }

    private void release(Order order, TicketStatus ticketStatus) {
        for (OrderItem item : items.findByOrderId(order.getId())) {
            TicketType type = types.findForUpdate(item.getTicketType().getId()).orElseThrow();
            type.setReservedQuantity(Math.max(0, type.getReservedQuantity() - item.getQuantity()));
        }
        tickets.findByOrderId(order.getId()).stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.PENDING_PAYMENT)
                .forEach(ticket -> ticket.setStatus(ticketStatus));
    }

    private CheckoutService.OrderView view(Order order, Payment payment) {
        List<CheckoutService.TicketView> ticketViews = tickets.findByOrderId(order.getId()).stream()
                .map(ticket -> {
                    String token = ticket.getStatus() == TicketStatus.PENDING_PAYMENT
                            ? null : crypto.ticketToken(ticket.getId(), ticket.getPublicCode());
                    String value = token == null ? null : qr.ticketUrl(token);
                    return new CheckoutService.TicketView(ticket.getPublicCode(), ticket.getStatus(),
                            ticket.getAttendee().getName(), ticket.getTicketType().getName(),
                            ticket.getTicketType().getWristbandLabel(), ticket.getTicketType().getWristbandColorName(),
                            ticket.getTicketType().getWristbandColorHex(), value,
                            value == null ? null : qr.dataUrl(value, 360), ticket.getCheckedInAt());
                }).toList();
        return new CheckoutService.OrderView(order.getPublicCode(), order.getStatus(), order.getSubtotal(),
                order.getServiceFee(), order.getTotalAmount(), order.getCurrency(), order.getExpiresAt(),
                order.getPaidAt(), CheckoutService.PaymentView.from(payment), ticketViews);
    }
}
