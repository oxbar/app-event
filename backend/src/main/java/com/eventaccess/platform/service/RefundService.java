package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.payment.PaymentProvider;
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
public class RefundService {
    private final RefundRepository refunds;
    private final PaymentRepository payments;
    private final OrderItemRepository items;
    private final TicketRepository tickets;
    private final TicketTypeRepository ticketTypes;
    private final UserRepository users;
    private final PaymentProvider provider;
    private final AuditService audit;

    public RefundService(RefundRepository refunds, PaymentRepository payments, OrderItemRepository items,
                         TicketRepository tickets, TicketTypeRepository ticketTypes, UserRepository users,
                         PaymentProvider provider, AuditService audit) {
        this.refunds = refunds;
        this.payments = payments;
        this.items = items;
        this.tickets = tickets;
        this.ticketTypes = ticketTypes;
        this.users = users;
        this.provider = provider;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Page<View> list(AppPrincipal principal, Pageable pageable) {
        return refunds.findByOrderOrganizationId(principal.organizationId(), pageable).map(View::from);
    }

    @Transactional
    public View refund(AppPrincipal principal, UUID paymentId, Request request) {
        Payment payment = payments.findForUpdate(paymentId)
                .orElseThrow(() -> ApiException.notFound("Pagamento não encontrado."));
        if (!payment.getOrder().getOrganization().getId().equals(principal.organizationId())) {
            throw ApiException.notFound("Pagamento não encontrado.");
        }
        if (payment.getStatus() != PaymentStatus.APPROVED
                && payment.getStatus() != PaymentStatus.PARTIALLY_REFUNDED) {
            throw ApiException.conflict("PAYMENT_NOT_REFUNDABLE", "Pagamento não está disponível para reembolso.");
        }
        if (tickets.findByOrderId(payment.getOrder().getId()).stream()
                .anyMatch(ticket -> ticket.getStatus() == TicketStatus.USED)) {
            throw ApiException.conflict("TICKET_ALREADY_USED",
                    "Não é possível reembolsar um pedido com ingresso já utilizado.");
        }
        BigDecimal alreadyRefunded = refunds.sumByPaymentAndStatus(paymentId, RefundStatus.APPROVED);
        BigDecimal available = payment.getAmount().subtract(alreadyRefunded);
        if (request.amount().compareTo(available) > 0) {
            throw ApiException.badRequest("REFUND_AMOUNT_EXCEEDED", "Valor de reembolso maior que o saldo disponível.");
        }

        PaymentProvider.RefundResult providerRefund = provider.refundPayment(
                payment.getProviderPaymentId(), request.amount(), request.reason());
        OffsetDateTime now = OffsetDateTime.now();
        UserAccount user = users.findById(principal.userId()).orElseThrow();
        Refund refund = refunds.save(Refund.builder()
                .payment(payment)
                .order(payment.getOrder())
                .requestedBy(user)
                .providerRefundId(providerRefund.providerRefundId())
                .amount(request.amount())
                .reason(request.reason())
                .status(RefundStatus.APPROVED)
                .requestedAt(now)
                .processedAt(now)
                .providerResponse(providerRefund.providerResponse())
                .build());

        BigDecimal totalRefunded = alreadyRefunded.add(request.amount());
        boolean full = totalRefunded.compareTo(payment.getAmount()) >= 0;
        payment.setStatus(full ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
        payment.setRefundedAt(full ? now : payment.getRefundedAt());
        Order order = payment.getOrder();
        order.setStatus(full ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED);
        order.setRefundedAt(full ? now : order.getRefundedAt());

        if (full) {
            for (OrderItem item : items.findByOrderId(order.getId())) {
                TicketType type = ticketTypes.findForUpdate(item.getTicketType().getId()).orElseThrow();
                type.setSoldQuantity(Math.max(0, type.getSoldQuantity() - item.getQuantity()));
            }
            tickets.findByOrderId(order.getId()).stream()
                    .filter(ticket -> ticket.getStatus() != TicketStatus.USED)
                    .forEach(ticket -> ticket.setStatus(TicketStatus.REFUNDED));
        }

        audit.record(principal, order.getEvent(), "PAYMENT_REFUNDED", "REFUND", refund.getId(), null,
                Map.of("paymentId", paymentId.toString(), "amount", request.amount().toPlainString(), "full", full));
        return View.from(refund);
    }

    public record Request(@NotNull @DecimalMin(value = "0.01") BigDecimal amount,
                          @NotBlank @Size(max = 500) String reason) {}
    public record View(UUID id, UUID paymentId, String orderCode, BigDecimal amount, String reason,
                       RefundStatus status, OffsetDateTime requestedAt, OffsetDateTime processedAt) {
        static View from(Refund refund) {
            return new View(refund.getId(), refund.getPayment().getId(), refund.getOrder().getPublicCode(),
                    refund.getAmount(), refund.getReason(), refund.getStatus(), refund.getRequestedAt(),
                    refund.getProcessedAt());
        }
    }
}
