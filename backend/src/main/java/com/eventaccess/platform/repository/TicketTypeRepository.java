package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.TicketType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface TicketTypeRepository extends JpaRepository<TicketType, UUID> {
    List<TicketType> findByEventIdOrderBySortOrderAsc(UUID eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TicketType t where t.id=:id")
    Optional<TicketType> findForUpdate(@Param("id") UUID id);

    @Query("select coalesce(sum(t.soldQuantity + t.reservedQuantity), 0) from TicketType t where t.event.id=:eventId")
    long countCommittedCapacity(@Param("eventId") UUID eventId);
}
