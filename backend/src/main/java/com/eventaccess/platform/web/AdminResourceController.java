package com.eventaccess.platform.web;

import com.eventaccess.platform.report.ReportService;
import com.eventaccess.platform.report.ReportSummary;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.AdminQueryService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class AdminResourceController {
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final AdminQueryService service;
    private final ReportService reports;

    public AdminResourceController(AdminQueryService service, ReportService reports) {
        this.service = service;
        this.reports = reports;
    }

    @GetMapping("/orders")
    Page<AdminQueryService.OrderAdminView> orders(
            @AuthenticationPrincipal AppPrincipal principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.orders(principal, pageable);
    }

    @GetMapping("/orders/{id}")
    AdminQueryService.OrderDetail order(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID id) {
        return service.order(principal, id);
    }

    @GetMapping("/payments")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','FINANCE')")
    Page<AdminQueryService.PaymentAdminView> payments(
            @AuthenticationPrincipal AppPrincipal principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.payments(principal, pageable);
    }

    @GetMapping("/tickets")
    Page<AdminQueryService.TicketAdminView> tickets(
            @AuthenticationPrincipal AppPrincipal principal,
            @RequestParam(required = false) UUID eventId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.tickets(principal, eventId, pageable);
    }

    @PostMapping("/tickets/{id}/block")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    AdminQueryService.TicketAdminView block(@AuthenticationPrincipal AppPrincipal principal,
                                            @PathVariable UUID id,
                                            @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? "Bloqueio administrativo"
                : body.getOrDefault("reason", "Bloqueio administrativo");
        return service.block(principal, id, reason);
    }

    @PostMapping("/tickets/{id}/unblock")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    AdminQueryService.TicketAdminView unblock(@AuthenticationPrincipal AppPrincipal principal,
                                              @PathVariable UUID id) {
        return service.unblock(principal, id);
    }

    @PostMapping("/tickets/{id}/transfer")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    AdminQueryService.TicketAdminView transfer(@AuthenticationPrincipal AppPrincipal principal,
                                                @PathVariable UUID id,
                                                @Valid @RequestBody AdminQueryService.TransferRequest request) {
        return service.transfer(principal, id, request);
    }

    @PostMapping("/tickets/{id}/resend")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')")
    AdminQueryService.TicketAdminView resend(@AuthenticationPrincipal AppPrincipal principal,
                                              @PathVariable UUID id) {
        return service.resend(principal, id);
    }

    @GetMapping("/attendees")
    Page<AdminQueryService.AttendeeView> attendees(
            @AuthenticationPrincipal AppPrincipal principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.attendees(principal, pageable);
    }

    @GetMapping("/audit")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN')")
    Page<AdminQueryService.AuditView> audit(
            @AuthenticationPrincipal AppPrincipal principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.audit(principal, pageable);
    }

    @GetMapping(value = "/events/{eventId}/reports/sales", produces = "text/csv")
    ResponseEntity<String> sales(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return csv("sales.csv", service.salesCsv(principal, eventId));
    }

    @GetMapping(value = "/events/{eventId}/reports/checkins", produces = "text/csv")
    ResponseEntity<String> checkins(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return csv("checkins.csv", service.checkinsCsv(principal, eventId));
    }

    /** Números consolidados usados pelos cartões da tela de relatórios. */
    @GetMapping("/events/{eventId}/reports/summary")
    ReportSummary reportSummary(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return reports.summary(principal, eventId);
    }

    @GetMapping(value = "/events/{eventId}/reports/sales.xlsx", produces = XLSX)
    ResponseEntity<byte[]> salesWorkbook(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return xlsx(reports.fileName("vendas", principal, eventId), reports.salesWorkbook(principal, eventId));
    }

    @GetMapping(value = "/events/{eventId}/reports/checkins.xlsx", produces = XLSX)
    ResponseEntity<byte[]> checkinsWorkbook(@AuthenticationPrincipal AppPrincipal principal,
                                            @PathVariable UUID eventId) {
        return xlsx(reports.fileName("entradas", principal, eventId), reports.checkinsWorkbook(principal, eventId));
    }

    /** Pasta de trabalho completa: resumo, vendas, ingressos e entradas. */
    @GetMapping(value = "/events/{eventId}/reports/workbook.xlsx", produces = XLSX)
    ResponseEntity<byte[]> fullWorkbook(@AuthenticationPrincipal AppPrincipal principal, @PathVariable UUID eventId) {
        return xlsx(reports.fileName("relatorio", principal, eventId), reports.fullWorkbook(principal, eventId));
    }

    private ResponseEntity<String> csv(String name, String body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(body);
    }

    private ResponseEntity<byte[]> xlsx(String name, byte[] body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(body.length))
                .contentType(MediaType.parseMediaType(XLSX))
                .body(body);
    }
}
