package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.CheckoutService;
import com.eventaccess.platform.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class InvitationController {
    private final InvitationService service;
    public InvitationController(InvitationService service) { this.service = service; }

    @GetMapping("/events/{eventId}/invitations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER','VIEWER')")
    List<InvitationService.View> list(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return service.list(principal, eventId);
    }

    @PostMapping("/events/{eventId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    InvitationService.View create(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId,
                                  @Valid @RequestBody InvitationService.Request request) {
        return service.create(principal, eventId, request);
    }

    @PostMapping("/public/invitations/{code}/accept")
    CheckoutService.OrderView accept(@PathVariable String code) {
        return service.accept(code);
    }
}
