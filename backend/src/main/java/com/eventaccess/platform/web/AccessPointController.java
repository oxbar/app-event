package com.eventaccess.platform.web;

import com.eventaccess.platform.domain.AccessPoint;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/events/{eventId}/access-points")
public class AccessPointController {
    private final AccessPointRepository points;
    private final EventRepository events;

    public AccessPointController(AccessPointRepository points, EventRepository events) {
        this.points = points;
        this.events = events;
    }

    @GetMapping
    List<View> list(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        ownedEvent(principal, eventId);
        return points.findByEventId(eventId).stream().map(View::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    View create(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                @Valid @RequestBody Request request) {
        var event = ownedEvent(principal, eventId);
        AccessPoint point = points.save(AccessPoint.builder()
                .event(event)
                .name(request.name())
                .description(request.description())
                .status("ACTIVE")
                .build());
        return View.from(point);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    View update(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                @PathVariable UUID id, @Valid @RequestBody Request request) {
        ownedEvent(principal, eventId);
        AccessPoint point = points.findByIdAndEventId(id, eventId)
                .orElseThrow(() -> ApiException.notFound("Portaria não encontrada."));
        point.setName(request.name());
        point.setDescription(request.description());
        point.setStatus(Optional.ofNullable(request.status()).orElse(point.getStatus()));
        return View.from(points.save(point));
    }

    private com.eventaccess.platform.domain.Event ownedEvent(AppPrincipal principal, UUID eventId) {
        return events.findByIdAndOrganizationId(eventId, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
    }

    record Request(@NotBlank String name, String description, String status) {}
    record View(UUID id, String name, String description, String status) {
        static View from(AccessPoint point) {
            return new View(point.getId(), point.getName(), point.getDescription(), point.getStatus());
        }
    }
}
