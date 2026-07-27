package com.eventaccess.platform.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TraceIdFilter implements Filter {
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        String trace=OptionalHeader.get((HttpServletRequest)req,"X-Trace-Id",UUID.randomUUID().toString());
        MDC.put("traceId",trace); ((HttpServletResponse)res).setHeader("X-Trace-Id",trace);
        try { chain.doFilter(req,res); } finally { MDC.remove("traceId"); }
    }
    static class OptionalHeader { static String get(HttpServletRequest r,String name,String fallback){String v=r.getHeader(name);return v==null||v.isBlank()?fallback:v;} }
}
