import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {tap} from 'rxjs';
import {AuthTokens, ForgotPasswordResult, OrganizationOption} from './models';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly key = 'event-access-session';
  private readonly state = signal<AuthTokens | null>(this.read());
  readonly organizationOptions = signal<OrganizationOption[]>([]);

  readonly user = computed(() => this.state()?.user ?? null);
  readonly authenticated = computed(() => Boolean(this.state()?.accessToken));

  token(): string | null {
    return this.state()?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.state()?.refreshToken ?? null;
  }

  login(email: string, password: string, remember = false) {
    return this.http.post<AuthTokens>('/api/auth/login', {email, password})
      .pipe(tap(tokens => this.save(tokens, remember)));
  }

  refresh() {
    return this.http.post<AuthTokens>('/api/auth/refresh', {refreshToken: this.refreshToken()})
      .pipe(tap(tokens => this.save(tokens, Boolean(localStorage.getItem(this.key)))));
  }

  forgotPassword(email: string) {
    return this.http.post<ForgotPasswordResult>('/api/auth/forgot-password', {email});
  }

  resetPassword(token: string, password: string) {
    return this.http.post<void>('/api/auth/reset-password', {token, password});
  }

  loadOrganizations(): void {
    this.http.get<OrganizationOption[]>('/api/auth/organizations').subscribe({
      next: organizations => this.organizationOptions.set(organizations),
      error: () => this.organizationOptions.set([]),
    });
  }

  switchOrganization(organizationId: string) {
    return this.http.post<AuthTokens>('/api/auth/switch-organization', {organizationId})
      .pipe(tap(tokens => this.save(tokens, Boolean(localStorage.getItem(this.key)))));
  }

  logout(): void {
    const refreshToken = this.refreshToken();
    const accessToken = this.token();
    if (refreshToken && accessToken) {
      this.http.post('/api/auth/logout', {refreshToken}, {
        headers: {Authorization: `Bearer ${accessToken}`},
      }).subscribe({error: () => undefined});
    }
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  clearSession(): void {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.key);
    this.state.set(null);
  }

  hasRole(...roles: string[]): boolean {
    return this.user()?.roles.some(role => roles.includes(role)) ?? false;
  }

  private save(tokens: AuthTokens, remember: boolean): void {
    const persistent = remember ? localStorage : sessionStorage;
    const transient = remember ? sessionStorage : localStorage;
    transient.removeItem(this.key);
    persistent.setItem(this.key, JSON.stringify(tokens));
    this.state.set(tokens);
  }

  private read(): AuthTokens | null {
    const stored = localStorage.getItem(this.key) ?? sessionStorage.getItem(this.key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthTokens;
    } catch {
      localStorage.removeItem(this.key);
      sessionStorage.removeItem(this.key);
      return null;
    }
  }
}
