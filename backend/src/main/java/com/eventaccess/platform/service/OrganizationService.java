package com.eventaccess.platform.service;

import com.eventaccess.platform.domain.*;
import com.eventaccess.platform.domain.Enums.*;
import com.eventaccess.platform.repository.*;
import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.web.ApiException;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class OrganizationService {
    private final OrganizationRepository organizations;
    private final OrganizationMemberRepository members;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public OrganizationService(OrganizationRepository organizations, OrganizationMemberRepository members,
                               UserRepository users, PasswordEncoder passwordEncoder) {
        this.organizations = organizations;
        this.members = members;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public Page<OrganizationView> list(AppPrincipal principal, Pageable pageable) {
        if (isSuperAdmin(principal)) {
            return organizations.findAll(pageable).map(OrganizationView::from);
        }
        Organization organization = organizations.findById(principal.organizationId()).orElseThrow();
        return new PageImpl<>(List.of(OrganizationView.from(organization)), pageable, 1);
    }

    @Transactional(readOnly = true)
    public OrganizationView get(AppPrincipal principal, UUID id) {
        return OrganizationView.from(owned(principal, id));
    }

    @Transactional
    public OrganizationView create(AppPrincipal principal, OrganizationRequest request) {
        requireSuperAdmin(principal);
        if (organizations.findBySlug(request.slug()).isPresent()) {
            throw ApiException.conflict("ORGANIZATION_SLUG_EXISTS", "Já existe uma organização com este slug.");
        }
        Organization organization = organizations.save(Organization.builder()
                .name(request.name())
                .legalName(request.legalName())
                .documentNumber(request.documentNumber())
                .email(request.email())
                .phone(request.phone())
                .slug(request.slug())
                .status(OrganizationStatus.ACTIVE)
                .primaryColor(Optional.ofNullable(request.primaryColor()).orElse("#6B4EFF"))
                .timezone(Optional.ofNullable(request.timezone()).orElse("America/Sao_Paulo"))
                .build());
        return OrganizationView.from(organization);
    }

    @Transactional
    public OrganizationView update(AppPrincipal principal, UUID id, OrganizationRequest request) {
        Organization organization = owned(principal, id);
        organization.setName(request.name());
        organization.setLegalName(request.legalName());
        organization.setDocumentNumber(request.documentNumber());
        organization.setEmail(request.email());
        organization.setPhone(request.phone());
        organization.setPrimaryColor(request.primaryColor());
        organization.setTimezone(Optional.ofNullable(request.timezone()).orElse(organization.getTimezone()));
        if (request.status() != null) {
            if (!isSuperAdmin(principal) && request.status() == OrganizationStatus.SUSPENDED) {
                throw ApiException.forbidden("Somente o administrador da plataforma pode suspender organizações.");
            }
            organization.setStatus(request.status());
        }
        return OrganizationView.from(organization);
    }

    @Transactional(readOnly = true)
    public List<MemberView> listMembers(AppPrincipal principal, UUID organizationId) {
        owned(principal, organizationId);
        return members.findByOrganizationId(organizationId).stream().map(MemberView::from).toList();
    }

    @Transactional
    public MemberView addMember(AppPrincipal principal, UUID organizationId, MemberRequest request) {
        Organization organization = owned(principal, organizationId);
        UserAccount user = users.findByEmailIgnoreCase(request.email()).orElseGet(() -> {
            if (request.temporaryPassword() == null || request.temporaryPassword().length() < 8) {
                throw ApiException.badRequest("TEMPORARY_PASSWORD_REQUIRED",
                        "Informe uma senha temporária com ao menos 8 caracteres para o novo usuário.");
            }
            return users.save(UserAccount.builder()
                    .name(request.name())
                    .email(request.email().toLowerCase(Locale.ROOT))
                    .phone(request.phone())
                    .passwordHash(passwordEncoder.encode(request.temporaryPassword()))
                    .status(UserStatus.ACTIVE)
                    .build());
        });
        if (members.findByOrganizationIdAndUserId(organizationId, user.getId()).isPresent()) {
            throw ApiException.conflict("MEMBER_ALREADY_EXISTS", "Usuário já pertence à organização.");
        }
        return MemberView.from(members.save(OrganizationMember.builder()
                .organization(organization)
                .user(user)
                .role(request.role())
                .status("ACTIVE")
                .build()));
    }

    @Transactional
    public void removeMember(AppPrincipal principal, UUID organizationId, UUID userId) {
        owned(principal, organizationId);
        OrganizationMember member = members.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(() -> ApiException.notFound("Membro não encontrado."));
        if (member.getUser().getId().equals(principal.userId())) {
            throw ApiException.conflict("CANNOT_REMOVE_SELF", "Você não pode remover seu próprio acesso.");
        }
        members.delete(member);
    }

    private Organization owned(AppPrincipal principal, UUID id) {
        if (!isSuperAdmin(principal) && !principal.organizationId().equals(id)) {
            throw ApiException.notFound("Organização não encontrada.");
        }
        return organizations.findById(id).orElseThrow(() -> ApiException.notFound("Organização não encontrada."));
    }

    private boolean isSuperAdmin(AppPrincipal principal) {
        return principal.roles().contains(Role.SUPER_ADMIN);
    }

    private void requireSuperAdmin(AppPrincipal principal) {
        if (!isSuperAdmin(principal)) throw ApiException.forbidden("Acesso restrito ao administrador da plataforma.");
    }

    public record OrganizationRequest(@NotBlank String name, String legalName, String documentNumber,
                                      @Email String email, String phone, @NotBlank String slug,
                                      String primaryColor, String timezone, OrganizationStatus status) {}
    public record MemberRequest(@NotBlank String name, @Email @NotBlank String email, String phone,
                                @NotNull Role role, String temporaryPassword) {}
    public record OrganizationView(UUID id, String name, String legalName, String documentNumber,
                                   String email, String phone, String slug, OrganizationStatus status,
                                   String primaryColor, String timezone) {
        static OrganizationView from(Organization organization) {
            return new OrganizationView(organization.getId(), organization.getName(), organization.getLegalName(),
                    organization.getDocumentNumber(), organization.getEmail(), organization.getPhone(),
                    organization.getSlug(), organization.getStatus(), organization.getPrimaryColor(),
                    organization.getTimezone());
        }
    }
    public record MemberView(UUID id, UUID userId, String name, String email, Role role, String status) {
        static MemberView from(OrganizationMember member) {
            return new MemberView(member.getId(), member.getUser().getId(), member.getUser().getName(),
                    member.getUser().getEmail(), member.getRole(), member.getStatus());
        }
    }
}
