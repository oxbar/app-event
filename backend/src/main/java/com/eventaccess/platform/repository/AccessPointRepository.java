package com.eventaccess.platform.repository;
import com.eventaccess.platform.domain.AccessPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface AccessPointRepository extends JpaRepository<AccessPoint, UUID> { List<AccessPoint> findByEventId(UUID eventId); Optional<AccessPoint> findByIdAndEventId(UUID id, UUID eventId); }
