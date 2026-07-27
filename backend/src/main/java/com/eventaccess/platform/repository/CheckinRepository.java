package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Checkin;
import com.eventaccess.platform.domain.Enums.CheckinResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface CheckinRepository extends JpaRepository<Checkin, UUID> {
    List<Checkin> findTop100ByEventIdOrderByScannedAtDesc(UUID eventId);
    List<Checkin> findByEventIdOrderByScannedAtDesc(UUID eventId);
    long countByEventOrganizationIdAndResult(UUID orgId, CheckinResult result);
    long countByEventId(UUID eventId);
    long countByEventIdAndResult(UUID eventId, CheckinResult result);
}
