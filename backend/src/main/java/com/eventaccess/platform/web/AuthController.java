package com.eventaccess.platform.web;

import com.eventaccess.platform.security.AppPrincipal;
import com.eventaccess.platform.service.AuthService;
import com.eventaccess.platform.service.PasswordResetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final PasswordResetService passwordReset;

    public AuthController(AuthService auth, PasswordResetService passwordReset) {
        this.auth = auth;
        this.passwordReset = passwordReset;
    }

    record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    record RefreshRequest(@NotBlank String refreshToken) {}
    record ForgotRequest(@Email @NotBlank String email) {}
    record ResetRequest(@NotBlank String token,
                        @NotBlank @Size(min = 8, max = 128) String password) {}
    record SwitchOrganizationRequest(@NotNull UUID organizationId) {}

    @PostMapping("/login")
    AuthService.Tokens login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request.email(), request.password());
    }

    @PostMapping("/refresh")
    AuthService.Tokens refresh(@Valid @RequestBody RefreshRequest request) {
        return auth.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@Valid @RequestBody RefreshRequest request) {
        auth.logout(request.refreshToken());
    }

    @GetMapping("/organizations")
    List<AuthService.OrganizationOption> organizations(@AuthenticationPrincipal AppPrincipal principal) {
        return auth.organizations(principal);
    }

    @PostMapping("/switch-organization")
    AuthService.Tokens switchOrganization(@AuthenticationPrincipal AppPrincipal principal,
                                          @Valid @RequestBody SwitchOrganizationRequest request) {
        return auth.switchOrganization(principal, request.organizationId());
    }

    @GetMapping("/me")
    AuthService.UserView me(@AuthenticationPrincipal AppPrincipal principal) {
        return new AuthService.UserView(principal.userId(), principal.organizationId(), principal.name(),
                principal.username(), principal.roles());
    }

    @PostMapping("/forgot-password")
    PasswordResetService.ForgotResult forgot(@Valid @RequestBody ForgotRequest request) {
        return passwordReset.forgot(request.email());
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void reset(@Valid @RequestBody ResetRequest request) {
        passwordReset.reset(request.token(), request.password());
    }
}
