package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class EventService {
    private final EventRepository events;
    private final OrganizationRepository organizations;
    private final TicketTypeRepository ticketTypes;
    private final AuditService audit;

    public EventService(EventRepository events, OrganizationRepository organizations,
                        TicketTypeRepository ticketTypes, AuditService audit) {
        this.events = events;
        this.organizations = organizations;
        this.ticketTypes = ticketTypes;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Page<EventView> list(AppPrincipal principal, Pageable pageable) {
        return events.findByOrganizationId(principal.organizationId(), pageable).map(EventView::from);
    }

    @Transactional(readOnly = true)
    public EventView get(AppPrincipal principal, UUID id) {
        return EventView.from(owned(principal, id));
    }

    @Transactional(readOnly = true)
    public PublicEventView publicBySlug(String slug) {
        Event event = events.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
        if (event.getStatus() == EventStatus.DRAFT || event.getStatus() == EventStatus.CANCELED) {
            throw ApiException.notFound("Evento não encontrado.");
        }
        List<TicketType> available = ticketTypes.findByEventIdOrderBySortOrderAsc(event.getId()).stream()
                .filter(type -> type.getStatus() == TicketTypeStatus.ACTIVE || type.getStatus() == TicketTypeStatus.SOLD_OUT)
                .toList();
        return PublicEventView.from(event, available);
    }

    @Transactional
    public EventView create(AppPrincipal principal, EventRequest request) {
        validatePeriod(request.startsAt(), request.endsAt(), request.salesStartAt(), request.salesEndAt());
        Organization organization = organizations.findById(principal.organizationId()).orElseThrow();
        Event event = Event.builder()
                .organization(organization)
                .name(request.name())
                .slug(slug(request.slug(), request.name()))
                .description(request.description())
                .venueName(request.venueName())
                .address(request.address())
                .city(request.city())
                .state(request.state())
                .country(Optional.ofNullable(request.country()).orElse("Brasil"))
                .startsAt(request.startsAt())
                .endsAt(request.endsAt())
                .salesStartAt(request.salesStartAt())
                .salesEndAt(request.salesEndAt())
                .capacity(request.capacity())
                .status(EventStatus.DRAFT)
                .bannerUrl(request.bannerUrl())
                .requireDocument(request.requireDocument())
                .allowManualCheckin(true)
                .build();
        try {
            event = events.save(event);
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.conflict("EVENT_SLUG_ALREADY_EXISTS", "Já existe um evento com esse endereço público.");
        }
        audit.record(principal, event, "EVENT_CREATED", "EVENT", event.getId(), null,
                Map.of("name", event.getName(), "status", event.getStatus().name()));
        return EventView.from(event);
    }

    @Transactional
    public EventView update(AppPrincipal principal, UUID id, EventRequest request) {
        validatePeriod(request.startsAt(), request.endsAt(), request.salesStartAt(), request.salesEndAt());
        Event event = owned(principal, id);
        Map<String, Object> previous = Map.of("name", event.getName(), "status", event.getStatus().name());
        event.setName(request.name());
        event.setDescription(request.description());
        event.setVenueName(request.venueName());
        event.setAddress(request.address());
        event.setCity(request.city());
        event.setState(request.state());
        event.setCountry(Optional.ofNullable(request.country()).orElse("Brasil"));
        event.setStartsAt(request.startsAt());
        event.setEndsAt(request.endsAt());
        event.setSalesStartAt(request.salesStartAt());
        event.setSalesEndAt(request.salesEndAt());
        event.setCapacity(request.capacity());
        event.setBannerUrl(request.bannerUrl());
        event.setRequireDocument(request.requireDocument());
        audit.record(principal, event, "EVENT_UPDATED", "EVENT", event.getId(), previous,
                Map.of("name", event.getName(), "status", event.getStatus().name()));
        return EventView.from(event);
    }

    @Transactional
    public EventView publish(AppPrincipal principal, UUID id) {
        Event event = owned(principal, id);
        if (ticketTypes.findByEventIdOrderBySortOrderAsc(id).isEmpty()) {
            throw ApiException.conflict("TICKET_TYPE_REQUIRED", "Cadastre ao menos um tipo de ingresso antes de publicar.");
        }
        EventStatus previous = event.getStatus();
        event.setStatus(EventStatus.SALES_OPEN);
        audit.record(principal, event, "EVENT_PUBLISHED", "EVENT", id,
                Map.of("status", previous.name()), Map.of("status", event.getStatus().name()));
        return EventView.from(event);
    }

    @Transactional
    public EventView cancel(AppPrincipal principal, UUID id) {
        Event event = owned(principal, id);
        EventStatus previous = event.getStatus();
        event.setStatus(EventStatus.CANCELED);
        audit.record(principal, event, "EVENT_CANCELED", "EVENT", id,
                Map.of("status", previous.name()), Map.of("status", event.getStatus().name()));
        return EventView.from(event);
    }

    @Transactional(readOnly = true)
    public List<TicketTypeView> listTypes(AppPrincipal principal, UUID eventId) {
        owned(principal, eventId);
        return ticketTypes.findByEventIdOrderBySortOrderAsc(eventId).stream().map(TicketTypeView::from).toList();
    }

    @Transactional
    public TicketTypeView createType(AppPrincipal principal, UUID eventId, TicketTypeRequest request) {
        Event event = owned(principal, eventId);
        TicketType type = TicketType.builder()
                .event(event)
                .name(request.name())
                .description(request.description())
                .category(request.category())
                .price(request.price())
                .serviceFee(request.serviceFee())
                .totalQuantity(request.totalQuantity())
                .soldQuantity(0)
                .reservedQuantity(0)
                .maxPerOrder(request.maxPerOrder())
                .wristbandLabel(request.wristbandLabel())
                .wristbandColorName(request.wristbandColorName())
                .wristbandColorHex(request.wristbandColorHex())
                .salesStartAt(request.salesStartAt())
                .salesEndAt(request.salesEndAt())
                .status(TicketTypeStatus.ACTIVE)
                .sortOrder(request.sortOrder())
                .build();
        type = ticketTypes.save(type);
        audit.record(principal, event, "TICKET_TYPE_CREATED", "TICKET_TYPE", type.getId(), null,
                Map.of("name", type.getName(), "price", type.getPrice().toPlainString()));
        return TicketTypeView.from(type);
    }

    @Transactional
    public TicketTypeView updateType(AppPrincipal principal, UUID id, TicketTypeRequest request) {
        TicketType type = ticketTypes.findById(id)
                .orElseThrow(() -> ApiException.notFound("Tipo de ingresso não encontrado."));
        Event event = owned(principal, type.getEvent().getId());
        if (request.totalQuantity() < type.getSoldQuantity() + type.getReservedQuantity()) {
            throw ApiException.conflict("QUANTITY_BELOW_COMMITTED",
                    "A quantidade não pode ser menor que os ingressos vendidos e reservados.");
        }
        Map<String, Object> previous = Map.of("name", type.getName(), "price", type.getPrice().toPlainString());
        type.setName(request.name());
        type.setDescription(request.description());
        type.setCategory(request.category());
        type.setPrice(request.price());
        type.setServiceFee(request.serviceFee());
        type.setTotalQuantity(request.totalQuantity());
        type.setMaxPerOrder(request.maxPerOrder());
        type.setWristbandLabel(request.wristbandLabel());
        type.setWristbandColorName(request.wristbandColorName());
        type.setWristbandColorHex(request.wristbandColorHex());
        type.setSalesStartAt(request.salesStartAt());
        type.setSalesEndAt(request.salesEndAt());
        type.setSortOrder(request.sortOrder());
        audit.record(principal, event, "TICKET_TYPE_UPDATED", "TICKET_TYPE", id, previous,
                Map.of("name", type.getName(), "price", type.getPrice().toPlainString()));
        return TicketTypeView.from(type);
    }

    @Transactional
    public TicketTypeView changeTypeStatus(AppPrincipal principal, UUID id, TicketTypeStatus status) {
        TicketType type = ticketTypes.findById(id)
                .orElseThrow(() -> ApiException.notFound("Tipo de ingresso não encontrado."));
        Event event = owned(principal, type.getEvent().getId());
        TicketTypeStatus previous = type.getStatus();
        type.setStatus(status);
        audit.record(principal, event, "TICKET_TYPE_STATUS_CHANGED", "TICKET_TYPE", id,
                Map.of("status", previous.name()), Map.of("status", status.name()));
        return TicketTypeView.from(type);
    }

    private Event owned(AppPrincipal principal, UUID id) {
        return events.findByIdAndOrganizationId(id, principal.organizationId())
                .orElseThrow(() -> ApiException.notFound("Evento não encontrado."));
    }

    private void validatePeriod(OffsetDateTime startsAt, OffsetDateTime endsAt,
                                OffsetDateTime salesStartAt, OffsetDateTime salesEndAt) {
        if (!endsAt.isAfter(startsAt)) {
            throw ApiException.badRequest("INVALID_PERIOD", "A data final deve ser posterior à data inicial.");
        }
        if (salesStartAt != null && salesEndAt != null && !salesEndAt.isAfter(salesStartAt)) {
            throw ApiException.badRequest("INVALID_SALES_PERIOD", "O fim das vendas deve ser posterior ao início.");
        }
    }

    private String slug(String desired, String name) {
        String raw = desired == null || desired.isBlank() ? name : desired;
        return raw.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "") + '-' + UUID.randomUUID().toString().substring(0, 6);
    }

    public record EventRequest(@NotBlank String name, String slug, String description, String venueName,
                               String address, String city, String state, String country,
                               @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt,
                               OffsetDateTime salesStartAt, OffsetDateTime salesEndAt,
                               @Positive Integer capacity, String bannerUrl, boolean requireDocument) {}

    public record TicketTypeRequest(@NotBlank String name, String description, @NotBlank String category,
                                    @NotNull @PositiveOrZero BigDecimal price,
                                    @NotNull @PositiveOrZero BigDecimal serviceFee,
                                    @Positive int totalQuantity, @Positive int maxPerOrder,
                                    String wristbandLabel, String wristbandColorName,
                                    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String wristbandColorHex,
                                    OffsetDateTime salesStartAt, OffsetDateTime salesEndAt, int sortOrder) {}

    public record EventView(UUID id, String name, String slug, String description, String venueName,
                            String address, String city, String state, String country,
                            OffsetDateTime startsAt, OffsetDateTime endsAt,
                            OffsetDateTime salesStartAt, OffsetDateTime salesEndAt, Integer capacity,
                            EventStatus status, String bannerUrl, boolean requireDocument) {
        static EventView from(Event event) {
            return new EventView(event.getId(), event.getName(), event.getSlug(), event.getDescription(),
                    event.getVenueName(), event.getAddress(), event.getCity(), event.getState(), event.getCountry(),
                    event.getStartsAt(), event.getEndsAt(), event.getSalesStartAt(), event.getSalesEndAt(),
                    event.getCapacity(), event.getStatus(), event.getBannerUrl(), event.isRequireDocument());
        }
    }

    public record TicketTypeView(UUID id, UUID eventId, String name, String description, String category,
                                 BigDecimal price, BigDecimal serviceFee, int totalQuantity, int soldQuantity,
                                 int reservedQuantity, int availableQuantity, int maxPerOrder,
                                 String wristbandLabel, String wristbandColorName, String wristbandColorHex,
                                 TicketTypeStatus status) {
        static TicketTypeView from(TicketType type) {
            return new TicketTypeView(type.getId(), type.getEvent().getId(), type.getName(), type.getDescription(),
                    type.getCategory(), type.getPrice(), type.getServiceFee(), type.getTotalQuantity(),
                    type.getSoldQuantity(), type.getReservedQuantity(),
                    type.getTotalQuantity() - type.getSoldQuantity() - type.getReservedQuantity(),
                    type.getMaxPerOrder(), type.getWristbandLabel(), type.getWristbandColorName(),
                    type.getWristbandColorHex(), type.getStatus());
        }
    }

    public record PublicEventView(EventView event, List<TicketTypeView> ticketTypes) {
        static PublicEventView from(Event event, List<TicketType> types) {
            return new PublicEventView(EventView.from(event), types.stream().map(TicketTypeView::from).toList());
        }
    }
}
