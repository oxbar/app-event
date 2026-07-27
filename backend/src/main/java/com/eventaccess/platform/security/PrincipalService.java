package com.eventaccess.platform.security;

import com.eventaccess.platform.domain.Enums.OrganizationStatus;
import com.eventaccess.platform.domain.Enums.Role;
import com.eventaccess.platform.domain.Enums.UserStatus;
import com.eventaccess.platform.repository.OrganizationMemberRepository;
import com.eventaccess.platform.repository.UserRepository;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PrincipalService implements UserDetailsService {
    private final UserRepository users;
    private final OrganizationMemberRepository members;

    public PrincipalService(UserRepository users, OrganizationMemberRepository members) {
        this.users = users;
        this.members = members;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        var user = activeUser(email);
        var membership = members.findFirstByUserIdAndStatus(user.getId(), "ACTIVE")
                .orElseThrow(() -> new UsernameNotFoundException("Usuário sem organização ativa"));
        return principal(user, membership);
    }

    public AppPrincipal loadForOrganization(String email, UUID organizationId) {
        var user = activeUser(email);
        var membership = members.findByOrganizationIdAndUserId(organizationId, user.getId())
                .filter(value -> "ACTIVE".equals(value.getStatus()))
                .orElseThrow(() -> new UsernameNotFoundException("Usuário sem acesso à organização"));
        return principal(user, membership);
    }

    private com.eventaccess.platform.domain.UserAccount activeUser(String email) {
        var user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new DisabledException("Usuário inativo");
        }
        return user;
    }

    private AppPrincipal principal(com.eventaccess.platform.domain.UserAccount user,
                                   com.eventaccess.platform.domain.OrganizationMember membership) {
        if (membership.getOrganization().getStatus() != OrganizationStatus.ACTIVE
                && membership.getRole() != Role.SUPER_ADMIN) {
            throw new DisabledException("Organização inativa");
        }
        return new AppPrincipal(user.getId(), membership.getOrganization().getId(), user.getName(),
                user.getEmail(), user.getPasswordHash(), Set.of(membership.getRole()));
    }
}
