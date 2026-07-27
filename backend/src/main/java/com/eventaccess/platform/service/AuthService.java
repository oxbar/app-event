package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.OrganizationMember;
import com.eventaccess.platform.domain.RefreshToken;
import com.eventaccess.platform.repository.OrganizationMemberRepository;
import com.eventaccess.platform.repository.RefreshTokenRepository;
import com.eventaccess.platform.repository.UserRepository;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.security.JwtService;
import com.eventaccess.platform.security.PrincipalService;
import com.eventaccess.platform.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final JwtService jwt;
    private final RefreshTokenRepository refreshes;
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final CryptoService crypto;
    private final PrincipalService principals;
    private final long refreshSeconds;

    public AuthService(AuthenticationManager authenticationManager, JwtService jwt,
                       RefreshTokenRepository refreshes, UserRepository users,
                       OrganizationMemberRepository members, CryptoService crypto,
                       PrincipalService principals,
                       @Value("${app.jwt.refresh-expiration-seconds}") long refreshSeconds) {
        this.authenticationManager = authenticationManager;
        this.jwt = jwt;
        this.refreshes = refreshes;
        this.users = users;
        this.members = members;
        this.crypto = crypto;
        this.principals = principals;
        this.refreshSeconds = refreshSeconds;
    }

    @Transactional
    public Tokens login(String email, String password) {
        try {
            var authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, password));
            var principal = (AppPrincipal) authentication.getPrincipal();
            var user = users.findById(principal.userId()).orElseThrow();
            user.setLastLoginAt(OffsetDateTime.now());
            return issue(principal, user);
        } catch (AuthenticationException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
        }
    }

    @Transactional
    public Tokens refresh(String rawToken) {
        var stored = refreshes.findByTokenHashAndRevokedAtIsNull(crypto.sha256(rawToken))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED,
                        "INVALID_REFRESH_TOKEN", "Sessão expirada."));
        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Sessão expirada.");
        }
        stored.setRevokedAt(OffsetDateTime.now());
        var principal = principals.loadForOrganization(stored.getUser().getEmail(),
                stored.getOrganization().getId());
        return issue(principal, stored.getUser());
    }

    @Transactional
    public Tokens switchOrganization(AppPrincipal current, UUID organizationId) {
        var principal = principals.loadForOrganization(current.username(), organizationId);
        var user = users.findById(current.userId()).orElseThrow();
        return issue(principal, user);
    }

    @Transactional(readOnly = true)
    public List<OrganizationOption> organizations(AppPrincipal principal) {
        return members.findByUserId(principal.userId()).stream()
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .map(OrganizationOption::from)
                .toList();
    }

    @Transactional
    public void logout(String rawToken) {
        refreshes.findByTokenHashAndRevokedAtIsNull(crypto.sha256(rawToken)).ifPresent(token -> {
            token.setRevokedAt(OffsetDateTime.now());
            refreshes.save(token);
        });
    }

    private Tokens issue(AppPrincipal principal, com.eventaccess.platform.domain.UserAccount user) {
        String refresh = crypto.randomToken();
        var organization = members.findByOrganizationIdAndUserId(principal.organizationId(), user.getId())
                .orElseThrow();
        refreshes.save(RefreshToken.builder()
                .user(user)
                .organization(organization.getOrganization())
                .tokenHash(crypto.sha256(refresh))
                .expiresAt(OffsetDateTime.now().plusSeconds(refreshSeconds))
                .build());
        return new Tokens(jwt.create(principal), refresh, jwt.accessSeconds(), UserView.from(principal));
    }

    public record Tokens(String accessToken, String refreshToken, long expiresIn, UserView user) {}

    public record UserView(UUID id, UUID organizationId, String name, String email,
                           java.util.Set<com.eventaccess.platform.domain.Enums.Role> roles) {
        static UserView from(AppPrincipal principal) {
            return new UserView(principal.userId(), principal.organizationId(), principal.name(),
                    principal.username(), principal.roles());
        }
    }

    public record OrganizationOption(UUID id, String name, String slug,
                                     com.eventaccess.platform.domain.Enums.Role role) {
        static OrganizationOption from(OrganizationMember member) {
            return new OrganizationOption(member.getOrganization().getId(), member.getOrganization().getName(),
                    member.getOrganization().getSlug(), member.getRole());
        }
    }
}
