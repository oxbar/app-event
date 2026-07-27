package com.eventaccess.platform.repository;
import com.eventaccess.platform.domain.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> { List<OrderItem> findByOrderId(UUID orderId); }
