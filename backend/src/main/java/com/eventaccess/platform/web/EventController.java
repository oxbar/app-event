package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.EventService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api")
public class EventController {
    private final EventService service; public EventController(EventService service){this.service=service;}
    @GetMapping("/events") Page<EventService.EventView> list(@AuthenticationPrincipal AppPrincipal p,@PageableDefault(size=20,sort="startsAt",direction=Sort.Direction.DESC) Pageable pageable){return service.list(p,pageable);}
    @GetMapping("/events/{id}") EventService.EventView get(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id){return service.get(p,id);}
    @PostMapping("/events") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.EventView create(@AuthenticationPrincipal AppPrincipal p,@Valid @RequestBody EventService.EventRequest r){return service.create(p,r);}
    @PutMapping("/events/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.EventView update(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id,@Valid @RequestBody EventService.EventRequest r){return service.update(p,id,r);}
    @PostMapping("/events/{id}/publish") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.EventView publish(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id){return service.publish(p,id);}
    @PostMapping("/events/{id}/cancel") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.EventView cancel(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id){return service.cancel(p,id);}
    @GetMapping("/events/{eventId}/ticket-types") List<EventService.TicketTypeView> types(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID eventId){return service.listTypes(p,eventId);}
    @PostMapping("/events/{eventId}/ticket-types") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.TicketTypeView createType(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID eventId,@Valid @RequestBody EventService.TicketTypeRequest r){return service.createType(p,eventId,r);}
    @PutMapping("/ticket-types/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.TicketTypeView updateType(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id,@Valid @RequestBody EventService.TicketTypeRequest r){return service.updateType(p,id,r);}

    @PostMapping("/ticket-types/{id}/activate") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.TicketTypeView activateType(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id){return service.changeTypeStatus(p,id,com.eventaccess.platform.domain.Enums.TicketTypeStatus.ACTIVE);}
    @PostMapping("/ticket-types/{id}/pause") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORGANIZER_ADMIN','EVENT_MANAGER')") EventService.TicketTypeView pauseType(@AuthenticationPrincipal AppPrincipal p,@PathVariable UUID id){return service.changeTypeStatus(p,id,com.eventaccess.platform.domain.Enums.TicketTypeStatus.PAUSED);}
    @GetMapping("/public/events/{slug}") EventService.PublicEventView publicEvent(@PathVariable String slug){return service.publicBySlug(slug);}
}
