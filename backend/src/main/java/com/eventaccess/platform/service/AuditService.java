package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {
    private final AuditLogRepository logs;
    private final OrganizationRepository organizations;
    private final UserRepository users;

    public AuditService(AuditLogRepository logs, OrganizationRepository organizations, UserRepository users) {
        this.logs = logs;
        this.organizations = organizations;
        this.users = users;
    }

    public void record(AppPrincipal principal, Event event, String action, String entityType,
                       UUID entityId, Map<String, Object> previous, Map<String, Object> current) {
        Organization organization = organizations.findById(principal.organizationId()).orElse(null);
        UserAccount user = users.findById(principal.userId()).orElse(null);
        logs.save(AuditLog.builder()
                .organization(organization)
                .event(event)
                .user(user)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .previousData(previous)
                .newData(current)
                .build());
    }

    public void system(Event event, String action, String entityType, UUID entityId, Map<String, Object> current) {
        logs.save(AuditLog.builder()
                .organization(event == null ? null : event.getOrganization())
                .event(event)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .newData(current)
                .build());
    }
}
