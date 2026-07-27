package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Enums.RefundStatus;
import com.eventaccess.platform.domain.Refund;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.*;

public interface RefundRepository extends JpaRepository<Refund, UUID> {
    Page<Refund> findByOrderOrganizationId(UUID organizationId, Pageable pageable);
    @Query("select coalesce(sum(r.amount), 0) from Refund r where r.payment.id=:paymentId and r.status=:status")
    BigDecimal sumByPaymentAndStatus(@Param("paymentId") UUID paymentId, @Param("status") RefundStatus status);
}
