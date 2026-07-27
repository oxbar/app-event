package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.Enums.CheckinResult;
import com.eventaccess.platform.domain.Enums.OrderStatus;
import com.eventaccess.platform.domain.Enums.TicketStatus;
import com.eventaccess.platform.repository.CheckinRepository;
import com.eventaccess.platform.repository.EventRepository;
import com.eventaccess.platform.repository.OrderRepository;
import com.eventaccess.platform.repository.TicketRepository;
import com.eventaccess.platform.security.AppPrincipal;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class DashboardService {
    private final EventRepository events;
    private final OrderRepository orders;
    private final TicketRepository tickets;
    private final CheckinRepository checkins;

    public DashboardService(EventRepository events, OrderRepository orders,
                            TicketRepository tickets, CheckinRepository checkins) {
        this.events = events;
        this.orders = orders;
        this.tickets = tickets;
        this.checkins = checkins;
    }

    public Summary summary(AppPrincipal principal) {
        var organizationId = principal.organizationId();
        long present = tickets.countByEventOrganizationIdAndStatus(organizationId, TicketStatus.USED);
        long absent = tickets.countByEventOrganizationIdAndStatus(organizationId, TicketStatus.VALID);
        return new Summary(
                orders.sumPaidByOrganization(organizationId),
                events.countByOrganizationId(organizationId),
                orders.countByOrganizationIdAndStatus(organizationId, OrderStatus.PENDING_PAYMENT),
                present + absent,
                present,
                absent,
                checkins.countByEventOrganizationIdAndResult(organizationId, CheckinResult.ALREADY_USED)
        );
    }

    public record Summary(BigDecimal revenue, long events, long pendingOrders, long issuedTickets,
                          long present, long absent, long duplicateAttempts) {}
}
