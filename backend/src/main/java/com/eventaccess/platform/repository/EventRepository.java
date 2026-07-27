package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Event;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface EventRepository extends JpaRepository<Event, UUID> {
    Page<Event> findByOrganizationId(UUID organizationId, Pageable pageable);
    Optional<Event> findByIdAndOrganizationId(UUID id, UUID organizationId);
    Optional<Event> findBySlug(String slug);
    long countByOrganizationId(UUID organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.id=:id")
    Optional<Event> findForCheckout(@Param("id") UUID id);
}
