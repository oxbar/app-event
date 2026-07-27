package com.eventaccess.platform.config;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Component
public class DevelopmentDataInitializer implements CommandLineRunner {
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final EventRepository events;
    private final TicketTypeRepository ticketTypes;
    private final AccessPointRepository accessPoints;
    private final EventStaffRepository eventStaff;
    private final PasswordEncoder encoder;
    private final String environment;

    public DevelopmentDataInitializer(OrganizationRepository organizations, UserRepository users,
                                      OrganizationMemberRepository members, EventRepository events,
                                      TicketTypeRepository ticketTypes, AccessPointRepository accessPoints,
                                      EventStaffRepository eventStaff, PasswordEncoder encoder,
                                      @Value("${app.environment}") String environment) {
        this.organizations = organizations;
        this.users = users;
        this.members = members;
        this.events = events;
        this.ticketTypes = ticketTypes;
        this.accessPoints = accessPoints;
        this.eventStaff = eventStaff;
        this.encoder = encoder;
        this.environment = environment;
    }

    @Override
    public void run(String... args) {
        if (!"development".equalsIgnoreCase(environment)
                || users.findByEmailIgnoreCase("admin@eventaccess.local").isPresent()) {
            return;
        }

        Organization organization = organizations.save(Organization.builder()
                .name("Event Access Demo")
                .legalName("Event Access Demo Ltda")
                .email("contato@eventaccess.local")
                .slug("event-access-demo")
                .status(OrganizationStatus.ACTIVE)
                .primaryColor("#6B4EFF")
                .timezone("America/Sao_Paulo")
                .build());

        createUser(organization, "Administrador", "admin@eventaccess.local", "Admin@123", Role.SUPER_ADMIN);
        createUser(organization, "Organizador Demo", "organizer@eventaccess.local", "Organizer@123", Role.ORGANIZER_ADMIN);
        UserAccount door = createUser(organization, "Portaria Demo", "door@eventaccess.local", "Door@123", Role.DOOR_STAFF);

        Event event = events.save(Event.builder()
                .organization(organization)
                .name("Festa de Verão")
                .slug("festa-de-verao")
                .description("Evento demonstrativo com ingressos comum e premium.")
                .venueName("Arena Event Access")
                .address("Rua das Festas, 100")
                .city("Blumenau")
                .state("SC")
                .country("Brasil")
                .startsAt(OffsetDateTime.now().minusHours(1))
                .endsAt(OffsetDateTime.now().plusHours(8))
                .salesStartAt(OffsetDateTime.now().minusDays(1))
                .salesEndAt(OffsetDateTime.now().plusHours(6))
                .capacity(600)
                .status(EventStatus.SALES_OPEN)
                .requireDocument(false)
                .allowManualCheckin(true)
                .build());

        ticketTypes.save(TicketType.builder()
                .event(event).name("Comum").description("Acesso à pista").category("COMMON")
                .price(new BigDecimal("50.00")).serviceFee(new BigDecimal("5.00"))
                .totalQuantity(500).soldQuantity(0).reservedQuantity(0).maxPerOrder(5)
                .wristbandLabel("Pulseira Branca").wristbandColorName("Branca").wristbandColorHex("#FFFFFF")
                .status(TicketTypeStatus.ACTIVE).sortOrder(1).build());

        ticketTypes.save(TicketType.builder()
                .event(event).name("Premium").description("Acesso premium").category("PREMIUM")
                .price(new BigDecimal("150.00")).serviceFee(new BigDecimal("10.00"))
                .totalQuantity(100).soldQuantity(0).reservedQuantity(0).maxPerOrder(3)
                .wristbandLabel("Pulseira Preta").wristbandColorName("Preta").wristbandColorHex("#111111")
                .status(TicketTypeStatus.ACTIVE).sortOrder(2).build());

        AccessPoint mainEntrance = accessPoints.save(AccessPoint.builder()
                .event(event)
                .name("Entrada Principal")
                .description("Portaria principal")
                .status("ACTIVE")
                .build());

        eventStaff.save(EventStaff.builder()
                .event(event)
                .user(door)
                .accessPoint(mainEntrance)
                .role(Role.DOOR_STAFF)
                .status("ACTIVE")
                .build());
    }

    private UserAccount createUser(Organization organization, String name, String email, String password, Role role) {
        UserAccount user = users.save(UserAccount.builder()
                .name(name)
                .email(email)
                .passwordHash(encoder.encode(password))
                .status(UserStatus.ACTIVE)
                .build());
        members.save(OrganizationMember.builder()
                .organization(organization)
                .user(user)
                .role(role)
                .status("ACTIVE")
                .build());
        return user;
    }
}
