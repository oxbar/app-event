package com.eventaccess.platform.security;

import com.eventaccess.platform.domain.Enums.Role;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.*;

public record AppPrincipal(UUID userId, UUID organizationId, String name, String username, String password, Set<Role> roles) implements UserDetails {
    @Override public Collection<? extends GrantedAuthority> getAuthorities(){return roles.stream().map(r->new SimpleGrantedAuthority("ROLE_"+r.name())).toList();}
    @Override public String getUsername(){return username;}
    @Override public String getPassword(){return password;}
    @Override public boolean isAccountNonExpired(){return true;}
    @Override public boolean isAccountNonLocked(){return true;}
    @Override public boolean isCredentialsNonExpired(){return true;}
    @Override public boolean isEnabled(){return true;}
}
