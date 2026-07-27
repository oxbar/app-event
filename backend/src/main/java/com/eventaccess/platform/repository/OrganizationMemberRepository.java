package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.OrganizationMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, UUID> {
    List<OrganizationMember> findByUserId(UUID userId);
    List<OrganizationMember> findByOrganizationId(UUID organizationId);
    Optional<OrganizationMember> findFirstByUserIdAndStatus(UUID userId, String status);
    Optional<OrganizationMember> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);
}
