package com.eventaccess.platform.repository;

import com.eventaccess.platform.domain.Attendee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface AttendeeRepository extends JpaRepository<Attendee, UUID> {
    @Query(value = """
            select distinct a from Attendee a
            where exists (select 1 from Order o where o.buyer=a and o.organization.id=:orgId)
               or exists (select 1 from Ticket t where t.attendee=a and t.event.organization.id=:orgId)
            """,
            countQuery = """
            select count(distinct a.id) from Attendee a
            where exists (select 1 from Order o where o.buyer=a and o.organization.id=:orgId)
               or exists (select 1 from Ticket t where t.attendee=a and t.event.organization.id=:orgId)
            """)
    Page<Attendee> findByOrganization(@Param("orgId") UUID orgId, Pageable pageable);
}
