package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.EventStaff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface EventStaffRepository extends JpaRepository<EventStaff, UUID> {
    List<EventStaff> findByEventId(UUID eventId);
    Optional<EventStaff> findByIdAndEventId(UUID id, UUID eventId);
    boolean existsByEventIdAndUserIdAndStatus(UUID eventId, UUID userId, String status);
    boolean existsByEventIdAndUserIdAndAccessPointIdAndStatus(UUID eventId, UUID userId, UUID accessPointId, String status);
}
