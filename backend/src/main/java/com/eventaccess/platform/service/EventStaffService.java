package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.Role;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class EventStaffService {
    private final EventStaffRepository staff;
    private final EventRepository events;
    private final UserRepository users;
    private final AccessPointRepository accessPoints;
    private final OrganizationMemberRepository members;

    public EventStaffService(EventStaffRepository staff, EventRepository events,
                             UserRepository users, AccessPointRepository accessPoints,
                             OrganizationMemberRepository members) {
        this.staff = staff;
        this.events = events;
        this.users = users;
        this.accessPoints = accessPoints;
        this.members = members;
    }

    @Transactional(readOnly = true)
    public List<View> list(AppPrincipal principal, UUID eventId) {
        ownedEvent(principal, eventId);
        return staff.findByEventId(eventId).stream().map(View::from).toList();
    }

    @Transactional
    public View add(AppPrincipal principal, UUID eventId, Request request) {
        Event event = ownedEvent(principal, eventId);
        UserAccount user = users.findById(request.userId())
                .orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
        members.findByOrganizationIdAndUserId(event.getOrganization().getId(), user.getId())
                .orElseThrow(() -> ApiException.notFound("Usuário não pertence à organização."));
        AccessPoint point = request.accessPointId() == null ? null
                : accessPoints.findByIdAndEventId(request.accessPointId(), eventId)
                .orElseThrow(() -> ApiException.notFound("Portaria não encontrada."));
        boolean duplicate = point == null
                ? staff.existsByEventIdAndUserIdAndStatus(eventId, user.getId(), "ACTIVE")
                : staff.existsByEventIdAndUserIdAndAccessPointIdAndStatus(eventId, user.getId(), point.getId(), "ACTIVE");
        if (duplicate) {
            throw ApiException.conflict("STAFF_ALREADY_ASSIGNED", "Funcionário já está vinculado ao evento ou portaria.");
        }
        return View.from(staff.save(EventStaff.builder()
                .event(event)
                .user(user)
                .accessPoint(point)
                .role(request.role())
                .status("ACTIVE")
                .build()));
    }

    @Transactional
    public void remove(AppPrincipal principal, UUID eventId, UUID id) {
        ownedEvent(principal, eventId);
        EventStaff assignment = staff.findByIdAndEventId(id, eventId)
                .orElseThrow(() -> ApiException.notFound("Vínculo de funcionário não encontrado."));
        staff.delete(assignment);
    }

    private Event ownedEvent(AppPrincipal principal, UUID eventId) {
        return events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
    }

    public record Request(@NotNull UUID userId, UUID accessPointId, @NotNull Role role) {}
    public record View(UUID id, UUID userId, String userName, String email, UUID accessPointId,
                       String accessPointName, Role role, String status) {
        static View from(EventStaff assignment) {
            return new View(assignment.getId(), assignment.getUser().getId(), assignment.getUser().getName(),
                    assignment.getUser().getEmail(),
                    assignment.getAccessPoint() == null ? null : assignment.getAccessPoint().getId(),
                    assignment.getAccessPoint() == null ? null : assignment.getAccessPoint().getName(),
                    assignment.getRole(), assignment.getStatus());
        }
    }
}
