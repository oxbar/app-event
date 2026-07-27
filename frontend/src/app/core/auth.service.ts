import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {throwError, tap} from 'rxjs';
import {AuthTokens, ForgotPasswordResult, OrganizationOption} from './models';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly key = 'event-access-session';
  private readonly state = signal<AuthTokens | null>(this.read());
  readonly organizationOptions = signal<OrganizationOption[]>([]);

  readonly user = computed(() => this.state()?.user ?? null);
  readonly authenticated = computed(() => {
    const session = this.state();
    return Boolean(session?.accessToken && session.refreshToken && session.user?.id);
  });

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
    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token indisponível.'));
    }
    return this.http.post<AuthTokens>('/api/auth/refresh', {refreshToken})
      .pipe(tap(tokens => this.save(tokens, this.isPersistent())));
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
      .pipe(tap(tokens => this.save(tokens, this.isPersistent())));
  }

  logout(): void {
    const refreshToken = this.refreshToken();
    if (refreshToken && this.token()) {
      this.http.post('/api/auth/logout', {refreshToken})
        .subscribe({error: () => undefined});
    }
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  clearSession(): void {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.key);
    this.organizationOptions.set([]);
    this.state.set(null);
  }

  hasRole(...roles: string[]): boolean {
    return this.user()?.roles.some(role => roles.includes(role)) ?? false;
  }

  private isPersistent(): boolean {
    return localStorage.getItem(this.key) !== null;
  }

  private save(tokens: AuthTokens, remember: boolean): void {
    if (!this.isValid(tokens)) {
      throw new Error('Resposta de autenticação inválida.');
    }
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
      const parsed = JSON.parse(stored) as AuthTokens;
      if (this.isValid(parsed)) return parsed;
    } catch {
      // Invalid or obsolete session data is discarded below.
    }
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.key);
    return null;
  }

  private isValid(value: AuthTokens | null | undefined): value is AuthTokens {
    return Boolean(
      value
      && typeof value.accessToken === 'string'
      && typeof value.refreshToken === 'string'
      && value.user
      && typeof value.user.id === 'string'
      && typeof value.user.organizationId === 'string'
      && Array.isArray(value.user.roles),
    );
  }
}
