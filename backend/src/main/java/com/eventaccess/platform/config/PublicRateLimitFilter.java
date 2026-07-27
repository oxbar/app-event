package com.eventaccess.platform.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class PublicRateLimitFilter extends OncePerRequestFilter {
    private final int maxRequests;
    private final long windowSeconds;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public PublicRateLimitFilter(
            @Value("${app.rate-limit.max-requests:60}") int maxRequests,
            @Value("${app.rate-limit.window-seconds:60}") long windowSeconds,
            ObjectMapper objectMapper) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return !(path.equals("/api/auth/login")
                || path.matches("/api/public/events/[^/]+/checkout")
                || path.matches("/api/public/orders/[^/]+/payments/pix"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = Instant.now().getEpochSecond();
        String key = request.getRemoteAddr() + ':' + request.getRequestURI();
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt >= windowSeconds) {
                return new Window(now, new AtomicInteger(1));
            }
            current.count.incrementAndGet();
            return current;
        });

        if (window.count.get() > maxRequests) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", Long.toString(Math.max(1, windowSeconds - (now - window.startedAt))));
            objectMapper.writeValue(response.getOutputStream(), Map.of(
                    "timestamp", Instant.now().toString(),
                    "status", 429,
                    "code", "RATE_LIMIT_EXCEEDED",
                    "message", "Muitas tentativas. Aguarde e tente novamente.",
                    "traceId", String.valueOf(MDC.get("traceId"))));
            return;
        }

        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt >= windowSeconds);
        }
        chain.doFilter(request, response);
    }

    private record Window(long startedAt, AtomicInteger count) {}
}
