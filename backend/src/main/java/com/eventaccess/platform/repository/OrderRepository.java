package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Order;
import com.eventaccess.platform.domain.Enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByPublicCode(String publicCode);
    List<Order> findByEventId(UUID eventId);
    Page<Order> findByOrganizationId(UUID organizationId, Pageable pageable);
    Optional<Order> findByIdAndOrganizationId(UUID id, UUID organizationId);
    long countByOrganizationIdAndStatus(UUID orgId, OrderStatus status);
    List<Order> findTop100ByStatusAndExpiresAtBefore(OrderStatus status, OffsetDateTime expiresAt);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id=:id")
    Optional<Order> findForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.publicCode=:publicCode")
    Optional<Order> findForUpdateByPublicCode(@Param("publicCode") String publicCode);

    @Query(value="SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE organization_id=:orgId AND status='PAID'", nativeQuery=true)
    BigDecimal sumPaidByOrganization(@Param("orgId") UUID orgId);
}
