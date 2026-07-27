package com.eventaccess.platform.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final long accessSeconds;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.access-expiration-seconds}") long accessSeconds) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessSeconds = accessSeconds;
    }

    public String create(AppPrincipal principal) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(principal.username())
                .claim("uid", principal.userId().toString())
                .claim("org", principal.organizationId().toString())
                .claim("name", principal.name())
                .claim("roles", principal.roles().stream().map(Enum::name).toList())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessSeconds)))
                .signWith(key)
                .compact();
    }

    public Claims claims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public String subject(String token) {
        return claims(token).getSubject();
    }

    public UUID organizationId(String token) {
        return UUID.fromString(claims(token).get("org", String.class));
    }

    public long accessSeconds() {
        return accessSeconds;
    }
}
