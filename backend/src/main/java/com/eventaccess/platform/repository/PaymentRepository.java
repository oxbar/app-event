package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Payment;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findFirstByOrderIdOrderByCreatedAtDesc(UUID orderId);
    Optional<Payment> findByProviderPaymentId(String id);
    Page<Payment> findByOrderOrganizationId(UUID organizationId, Pageable pageable);
    Optional<Payment> findByIdAndOrderOrganizationId(UUID id, UUID organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id=:id")
    Optional<Payment> findForUpdate(@Param("id") UUID id);
}
