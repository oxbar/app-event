package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.AccessPoint;
import com.eventaccess.platform.domain.Checkin;
import com.eventaccess.platform.domain.Event;
import com.eventaccess.platform.domain.Ticket;
import com.eventaccess.platform.domain.UserAccount;
import com.eventaccess.platform.domain.Enums.CheckinResult;
import com.eventaccess.platform.domain.Enums.OrderStatus;
import com.eventaccess.platform.domain.Enums.Role;
import com.eventaccess.platform.domain.Enums.TicketStatus;
import com.eventaccess.platform.repository.AccessPointRepository;
import com.eventaccess.platform.repository.CheckinRepository;
import com.eventaccess.platform.repository.EventRepository;
import com.eventaccess.platform.repository.EventStaffRepository;
import com.eventaccess.platform.repository.TicketRepository;
import com.eventaccess.platform.repository.UserRepository;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class CheckinService {
    private final TicketRepository tickets;
    private final EventRepository events;
    private final AccessPointRepository points;
    private final EventStaffRepository eventStaff;
    private final UserRepository users;
    private final CheckinRepository checkins;
    private final CryptoService crypto;
    private final AuditService audit;

    public CheckinService(TicketRepository tickets, EventRepository events, AccessPointRepository points,
                          EventStaffRepository eventStaff, UserRepository users, CheckinRepository checkins,
                          CryptoService crypto, AuditService audit) {
        this.tickets = tickets;
        this.events = events;
        this.points = points;
        this.eventStaff = eventStaff;
        this.users = users;
        this.checkins = checkins;
        this.crypto = crypto;
        this.audit = audit;
    }

    @Transactional
    public Result scan(AppPrincipal principal, UUID eventId, ScanRequest request, String ip) {
        return process(principal, eventId, request, ip, false);
    }

    @Transactional
    public Result manual(AppPrincipal principal, UUID eventId, ScanRequest request, String ip) {
        return process(principal, eventId, request, ip, true);
    }

    private Result process(AppPrincipal principal, UUID eventId, ScanRequest request, String ip, boolean manual) {
        Event event = events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        if (manual && !event.isAllowManualCheckin()) {
            throw ApiException.forbidden("Check-in manual não está habilitado neste evento.");
        }

        AccessPoint point = points.findByIdAndEventId(request.accessPointId(), eventId)
                .orElseThrow(() -> ApiException.notFound("Portaria não encontrada."));
        if (!"ACTIVE".equalsIgnoreCase(point.getStatus())) {
            throw ApiException.conflict("ACCESS_POINT_INACTIVE", "Esta portaria está inativa.");
        }
        authorizeDoorStaff(principal, eventId, point.getId());

        UserAccount user = users.findById(principal.userId()).orElseThrow();
        ResolvedTicket resolved = resolveTicket(request.token());
        Ticket ticket = resolved.ticket();
        String scannedHash = resolved.scannedHash();

        CheckinResult result;
        String reason;
        boolean approved = false;
        OffsetDateTime now = OffsetDateTime.now();

        if (ticket == null) {
            result = CheckinResult.INVALID_QR_CODE;
            reason = manual
                    ? "Código do ingresso inválido. Informe o código TKT-, o link do ingresso ou leia o QR Code."
                    : "QR Code inválido.";
        } else if (!ticket.getEvent().getId().equals(eventId)) {
            result = CheckinResult.WRONG_EVENT;
            reason = "Ingresso pertence a outro evento.";
        } else if (ticket.getStatus() == TicketStatus.USED) {
            result = CheckinResult.ALREADY_USED;
            reason = "Ingresso já utilizado em " + ticket.getCheckedInAt() + '.';
        } else if (ticket.getStatus() == TicketStatus.BLOCKED) {
            result = CheckinResult.BLOCKED;
            reason = "Ingresso bloqueado.";
        } else if (ticket.getStatus() == TicketStatus.CANCELED) {
            result = CheckinResult.CANCELED;
            reason = "Ingresso cancelado.";
        } else if (ticket.getStatus() == TicketStatus.REFUNDED) {
            result = CheckinResult.REFUNDED;
            reason = "Ingresso reembolsado.";
        } else if (ticket.getStatus() == TicketStatus.EXPIRED) {
            result = CheckinResult.EXPIRED;
            reason = "Ingresso expirado.";
        } else if (ticket.getOrder().getStatus() != OrderStatus.PAID) {
            result = CheckinResult.PAYMENT_PENDING;
            reason = "Pagamento não confirmado.";
        } else if (ticket.getValidFrom() != null && now.isBefore(ticket.getValidFrom())) {
            result = CheckinResult.EVENT_NOT_STARTED;
            reason = "Evento ainda não iniciado.";
        } else if (ticket.getValidUntil() != null && now.isAfter(ticket.getValidUntil())) {
            result = CheckinResult.EVENT_FINISHED;
            reason = "Evento encerrado.";
        } else if (tickets.markUsedAtomically(ticket.getId()) == 1) {
            result = CheckinResult.APPROVED;
            reason = "Entrada liberada.";
            approved = true;
            ticket = tickets.findById(ticket.getId()).orElse(ticket);
        } else {
            ticket = tickets.findById(ticket.getId()).orElse(ticket);
            result = ticket.getStatus() == TicketStatus.USED
                    ? CheckinResult.ALREADY_USED
                    : CheckinResult.MANUAL_DENIAL;
            reason = result == CheckinResult.ALREADY_USED
                    ? "Ingresso já utilizado em " + ticket.getCheckedInAt() + '.'
                    : "Entrada não autorizada.";
        }

        Checkin checkin = checkins.save(Checkin.builder()
                .event(event)
                .ticket(ticket)
                .accessPoint(point)
                .staffUser(user)
                .result(result)
                .scannedTokenHash(scannedHash)
                .deviceIdentifier(request.deviceIdentifier())
                .ipAddress(ip)
                .reason(reason)
                .scannedAt(now)
                .build());

        if (manual) {
            audit.record(principal, event, "MANUAL_CHECKIN", "CHECKIN", checkin.getId(), null,
                    Map.of("result", result.name(), "accessPoint", point.getName()));
        }

        return new Result(approved, result, reason,
                ticket == null ? null : ticket.getAttendee().getName(),
                ticket == null ? null : ticket.getTicketType().getName(),
                ticket == null ? null : ticket.getTicketType().getWristbandLabel(),
                ticket == null ? null : ticket.getTicketType().getWristbandColorName(),
                ticket == null ? null : ticket.getTicketType().getWristbandColorHex(),
                point.getName(), ticket == null ? null : ticket.getCheckedInAt());
    }

    private ResolvedTicket resolveTicket(String rawValue) {
        String normalized = normalize(rawValue);
        if (normalized.isBlank()) {
            return new ResolvedTicket(null, crypto.sha256("empty"));
        }

        if (normalized.regionMatches(true, 0, "TKT-", 0, 4)) {
            Ticket ticket = tickets.findByPublicCodeIgnoreCase(normalized).orElse(null);
            return new ResolvedTicket(ticket, crypto.sha256(normalized.toUpperCase(Locale.ROOT)));
        }

        String hash = crypto.sha256(normalized);
        return new ResolvedTicket(tickets.findByQrTokenHash(hash).orElse(null), hash);
    }

    private String normalize(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isBlank()) {
            return value;
        }

        try {
            if (value.startsWith("http://") || value.startsWith("https://")) {
                URI uri = URI.create(value);
                value = uri.getPath() == null ? value : uri.getPath();
            }
        } catch (IllegalArgumentException ignored) {
            // Continua com o valor original para retornar uma recusa de negócio, sem erro técnico.
        }

        value = stripQueryAndFragment(value).replaceAll("/+$", "");
        int ticketMarker = value.lastIndexOf("/ticket/");
        if (ticketMarker >= 0) {
            return value.substring(ticketMarker + "/ticket/".length()).trim();
        }
        int tokenMarker = value.lastIndexOf("/t/");
        if (tokenMarker >= 0) {
            return value.substring(tokenMarker + "/t/".length()).trim();
        }
        return value;
    }

    private String stripQueryAndFragment(String value) {
        int query = value.indexOf('?');
        int fragment = value.indexOf('#');
        int end = value.length();
        if (query >= 0) end = Math.min(end, query);
        if (fragment >= 0) end = Math.min(end, fragment);
        return value.substring(0, end);
    }

    @Transactional(readOnly = true)
    public List<History> history(AppPrincipal principal, UUID eventId) {
        events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        return checkins.findTop100ByEventIdOrderByScannedAtDesc(eventId).stream()
                .map(checkin -> new History(checkin.getId(), checkin.getResult(),
                        checkin.getTicket() == null ? null : checkin.getTicket().getAttendee().getName(),
                        checkin.getAccessPoint() == null ? null : checkin.getAccessPoint().getName(),
                        checkin.getStaffUser().getName(), checkin.getReason(), checkin.getScannedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Summary summary(AppPrincipal principal, UUID eventId) {
        events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        long total = checkins.countByEventId(eventId);
        long approved = checkins.countByEventIdAndResult(eventId, CheckinResult.APPROVED);
        long duplicates = checkins.countByEventIdAndResult(eventId, CheckinResult.ALREADY_USED);
        return new Summary(total, approved, total - approved, duplicates);
    }

    private void authorizeDoorStaff(AppPrincipal principal, UUID eventId, UUID accessPointId) {
        if (!principal.roles().contains(Role.DOOR_STAFF)) return;
        boolean allowed = eventStaff.existsByEventIdAndUserIdAndAccessPointIdAndStatus(
                eventId, principal.userId(), accessPointId, "ACTIVE");
        if (!allowed) {
            throw ApiException.forbidden("Funcionário não autorizado para esta portaria.");
        }
    }

    private record ResolvedTicket(Ticket ticket, String scannedHash) {}

    public record ScanRequest(@NotBlank String token, @NotNull UUID accessPointId, String deviceIdentifier) {}

    public record Result(boolean approved, CheckinResult result, String message, String attendeeName,
                         String ticketType, String wristbandLabel, String wristbandColorName,
                         String wristbandColorHex, String accessPoint, OffsetDateTime checkedInAt) {}

    public record History(UUID id, CheckinResult result, String attendeeName, String accessPoint,
                          String staff, String reason, OffsetDateTime scannedAt) {}

    public record Summary(long attempts, long approved, long denied, long duplicateAttempts) {}
}
