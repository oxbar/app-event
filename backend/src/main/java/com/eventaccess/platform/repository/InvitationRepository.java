package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Invitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {
    List<Invitation> findByEventIdOrderByCreatedAtDesc(UUID eventId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invitation i where i.code=:code")
    Optional<Invitation> findForUpdateByCode(@Param("code") String code);
}
