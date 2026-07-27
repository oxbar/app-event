package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.CheckinService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/events/{eventId}/checkins")
public class CheckinController {
    private final CheckinService service;
    public CheckinController(CheckinService service) { this.service = service; }

    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER','DOOR_STAFF')")
    CheckinService.Result scan(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                               @Valid @RequestBody CheckinService.ScanRequest request, HttpServletRequest http) {
        return service.scan(principal, eventId, request, http.getRemoteAddr());
    }

    @PostMapping("/manual")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER','DOOR_STAFF')")
    CheckinService.Result manual(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                                 @Valid @RequestBody CheckinService.ScanRequest request, HttpServletRequest http) {
        return service.manual(principal, eventId, request, http.getRemoteAddr());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER','DOOR_STAFF','VIEWER')")
    List<CheckinService.History> history(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return service.history(principal, eventId);
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER','DOOR_STAFF','VIEWER')")
    CheckinService.Summary summary(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return service.summary(principal, eventId);
    }
}
