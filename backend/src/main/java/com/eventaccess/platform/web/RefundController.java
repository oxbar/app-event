package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.RefundService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','FINANCE')")
public class RefundController {
    private final RefundService service;
    public RefundController(RefundService service) { this.service = service; }

    @GetMapping("/refunds")
    Page<RefundService.View> list(@AuthenticationPrincipal AppPrincipal principal,
                                  @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                                  Pageable pageable) {
        return service.list(principal, pageable);
    }

    @PostMapping("/payments/{paymentId}/refund")
    @ResponseStatus(HttpStatus.CREATED)
    RefundService.View refund(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID paymentId,
                              @Valid @RequestBody RefundService.Request request) {
        return service.refund(principal, paymentId, request);
    }
}
