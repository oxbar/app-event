package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class ReservationExpirationService {
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final TicketTypeRepository ticketTypes;
    private final TicketRepository tickets;
    private final PaymentRepository payments;

    public ReservationExpirationService(OrderRepository orders, OrderItemRepository items,
                                        TicketTypeRepository ticketTypes, TicketRepository tickets,
                                        PaymentRepository payments) {
        this.orders = orders;
        this.items = items;
        this.ticketTypes = ticketTypes;
        this.tickets = tickets;
        this.payments = payments;
    }

    @Scheduled(fixedDelayString = "${app.reservation-expiration-delay-ms:60000}")
    @Transactional
    public void expirePendingOrders() {
        for (var candidate : orders.findTop100ByStatusAndExpiresAtBefore(
                OrderStatus.PENDING_PAYMENT, OffsetDateTime.now())) {
            var order = orders.findForUpdate(candidate.getId()).orElse(null);
            if (order == null || order.getStatus() != OrderStatus.PENDING_PAYMENT
                    || order.getExpiresAt() == null || order.getExpiresAt().isAfter(OffsetDateTime.now())) {
                continue;
            }
            order.setStatus(OrderStatus.EXPIRED);
            for (var item : items.findByOrderId(order.getId())) {
                var type = ticketTypes.findForUpdate(item.getTicketType().getId()).orElseThrow();
                type.setReservedQuantity(Math.max(0, type.getReservedQuantity() - item.getQuantity()));
            }
            tickets.findByOrderId(order.getId()).stream()
                    .filter(ticket -> ticket.getStatus() == TicketStatus.PENDING_PAYMENT)
                    .forEach(ticket -> ticket.setStatus(TicketStatus.EXPIRED));
            payments.findFirstByOrderIdOrderByCreatedAtDesc(order.getId()).ifPresent(payment -> {
                if (payment.getStatus() == PaymentStatus.PENDING || payment.getStatus() == PaymentStatus.CREATED) {
                    payment.setStatus(PaymentStatus.EXPIRED);
                }
            });
        }
    }
}
