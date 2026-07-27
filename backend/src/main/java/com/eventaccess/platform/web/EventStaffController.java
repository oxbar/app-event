package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.EventStaffService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/events/{eventId}/staff")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
public class EventStaffController {
    private final EventStaffService service;

    public EventStaffController(EventStaffService service) {
        this.service = service;
    }

    @GetMapping
    List<EventStaffService.View> list(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return service.list(principal, eventId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    EventStaffService.View add(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                               @Valid @RequestBody EventStaffService.Request request) {
        return service.add(principal, eventId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId, @PathVariable UUID id) {
        service.remove(principal, eventId, id);
    }
}
