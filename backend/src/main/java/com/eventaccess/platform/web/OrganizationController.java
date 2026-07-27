package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.OrganizationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/organizations")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN')")
public class OrganizationController {
    private final OrganizationService service;

    public OrganizationController(OrganizationService service) {
        this.service = service;
    }

    @GetMapping
    Page<OrganizationService.OrganizationView> list(
            @AuthenticationPrincipal AppPrincipal principal,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.list(principal, pageable);
    }

    @GetMapping("/{id}")
    OrganizationService.OrganizationView get(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        return service.get(principal, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    OrganizationService.OrganizationView create(@AuthenticationPrincipal AppPrincipal principal,
                                                @Valid @RequestBody OrganizationService.OrganizationRequest request) {
        return service.create(principal, request);
    }

    @PutMapping("/{id}")
    OrganizationService.OrganizationView update(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id,
                                                @Valid @RequestBody OrganizationService.OrganizationRequest request) {
        return service.update(principal, id, request);
    }

    @GetMapping("/{id}/members")
    List<OrganizationService.MemberView> members(@AuthenticationPrincipal AppPrincipal principal,
                                                 @PathVariable UUID id) {
        return service.listMembers(principal, id);
    }

    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    OrganizationService.MemberView addMember(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id,
                                             @Valid @RequestBody OrganizationService.MemberRequest request) {
        return service.addMember(principal, id, request);
    }

    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeMember(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id,
                      @PathVariable UUID userId) {
        service.removeMember(principal, id, userId);
    }
}
