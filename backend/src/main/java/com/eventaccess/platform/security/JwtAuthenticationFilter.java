package com.eventaccess.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final PrincipalService principals;

    public JwtAuthenticationFilter(JwtService jwt, PrincipalService principals) {
        this.jwt = jwt;
        this.principals = principals;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                String token = authorization.substring(7).trim();
                if (!token.isEmpty()) {
                    var claims = jwt.claims(token);
                    var principal = principals.loadForOrganization(
                            claims.getSubject(),
                            java.util.UUID.fromString(claims.get("org", String.class)));
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    principal, null, principal.getAuthorities()));
                }
            } catch (Exception exception) {
                // Continue as anonymous. Public endpoints remain accessible and protected endpoints
                // are converted to a standardized 401 by SecurityConfig's authentication entry point.
                SecurityContextHolder.clearContext();
                request.setAttribute("jwtAuthenticationFailure", exception.getClass().getSimpleName());
            }
        }
        chain.doFilter(request, response);
    }
}
