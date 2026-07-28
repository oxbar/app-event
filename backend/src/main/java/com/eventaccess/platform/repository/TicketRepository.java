package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Enums.TicketStatus;
import com.eventaccess.platform.domain.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {
    Optional<Ticket> findByQrTokenHash(String hash);

    Optional<Ticket> findByPublicCodeIgnoreCase(String publicCode);

    List<Ticket> findByOrderId(UUID orderId);

    Page<Ticket> findByEventOrganizationId(UUID organizationId, Pageable pageable);

    Page<Ticket> findByEventIdAndEventOrganizationId(UUID eventId, UUID organizationId, Pageable pageable);

    Optional<Ticket> findByIdAndEventOrganizationId(UUID id, UUID organizationId);

    long countByEventOrganizationId(UUID organizationId);

    long countByEventOrganizationIdAndStatus(UUID organizationId, TicketStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE tickets
           SET status = 'USED',
               checked_in_at = NOW(),
               updated_at = NOW(),
               version = version + 1
         WHERE id = :ticketId
           AND status = 'VALID'
        """, nativeQuery = true)
    int markUsedAtomically(@Param("ticketId") UUID ticketId);
}
