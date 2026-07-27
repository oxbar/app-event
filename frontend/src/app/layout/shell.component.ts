import {ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {filter} from 'rxjs';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';
import {ThemeService} from '../core/theme.service';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiInput, SelectFieldComponent],
  template: `
    <a class="skip-link" href="#main-content">Ir para o conteúdo principal</a>
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <aside id="main-menu" [class.open]="mobileMenuOpen()" aria-label="Menu principal">
        <div class="logo"><span>EA</span><strong>Event Access</strong></div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" (click)="closeMobileMenu()">Visão geral</a>
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER')) {
            <a routerLink="/events" routerLinkActive="active" (click)="closeMobileMenu()">Eventos</a>
            <a routerLink="/tickets" routerLinkActive="active" (click)="closeMobileMenu()">Ingressos</a>
            <a routerLink="/attendees" routerLinkActive="active" (click)="closeMobileMenu()">Participantes</a>
            @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
              <a routerLink="/operations" routerLinkActive="active" (click)="closeMobileMenu()">Equipe e portarias</a>
            }
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'DOOR_STAFF')) {
            <a routerLink="/door" routerLinkActive="active" (click)="closeMobileMenu()">Portaria</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER')) {
            <a routerLink="/orders" routerLinkActive="active" (click)="closeMobileMenu()">Pedidos</a>
            <a routerLink="/reports" routerLinkActive="active" (click)="closeMobileMenu()">Relatórios</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE')) {
            <a routerLink="/payments" routerLinkActive="active" (click)="closeMobileMenu()">Pagamentos</a>
            <a routerLink="/refunds" routerLinkActive="active" (click)="closeMobileMenu()">Reembolsos</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
            <a routerLink="/audit" routerLinkActive="active" (click)="closeMobileMenu()">Auditoria</a>
          }
        </nav>
      </aside>

      @if (mobileMenuOpen()) {
        <button
          class="menu-backdrop"
          type="button"
          aria-label="Fechar menu"
          (click)="closeMobileMenu()"
        ></button>
      }

      <section class="workspace">
        <header>
          <button
            class="menu-toggle"
            tuiButton
            appearance="secondary"
            type="button"
            aria-label="Abrir ou recolher menu"
            aria-controls="main-menu"
            [attr.aria-expanded]="isMenuExpanded()"
            (click)="toggleMenu()"
          >
            <span aria-hidden="true">☰</span>
          </button>

          @if (auth.organizationOptions().length > 1) {
            <app-select-field
              class="organization-switcher"
              [control]="organizationControl"
              [options]="organizationOptions()"
              placeholder="Selecione a organização"
              ariaLabel="Organização atual"
              inputId="organization-switcher"
            />
          }

          @if (error()) {<small class="header-error" role="alert">{{error()}}</small>}

          <div class="header-spacer"></div>
          <div class="user-summary">
            <strong>{{auth.user()?.name}}</strong>
            <small>{{auth.user()?.email}}</small>
          </div>
          <button tuiButton appearance="secondary" type="button" (click)="theme.toggle()">
            {{theme.dark() ? 'Tema claro' : 'Tema escuro'}}
          </button>
          <button tuiButton appearance="flat" type="button" (click)="auth.logout()">Sair</button>
        </header>
        <main id="main-content" tabindex="-1"><router-outlet /></main>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mobileQuery = window.matchMedia('(max-width: 800px)');
  private readonly sidebarKey = 'event-access-sidebar-collapsed';

  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly mobileMenuOpen = signal(false);
  readonly sidebarCollapsed = signal(localStorage.getItem(this.sidebarKey) === 'true');
  readonly error = signal('');
  readonly organizationOptions = computed<readonly SelectOption[]>(() =>
    this.auth.organizationOptions().map(organization => ({value: organization.id, label: organization.name})),
  );
  readonly organizationControl = new FormControl(
    this.auth.user()?.organizationId ?? '',
    {nonNullable: true},
  );

  constructor() {
    this.auth.loadOrganizations();

    this.organizationControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(organizationId => {
        if (!organizationId || organizationId === this.auth.user()?.organizationId) return;
        this.switchOrganization(organizationId);
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeMobileMenu());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }

  isMenuExpanded(): boolean {
    return this.mobileQuery.matches ? this.mobileMenuOpen() : !this.sidebarCollapsed();
  }

  toggleMenu(): void {
    if (this.mobileQuery.matches) {
      this.mobileMenuOpen.update(value => !value);
      return;
    }

    this.sidebarCollapsed.update(value => {
      const collapsed = !value;
      localStorage.setItem(this.sidebarKey, String(collapsed));
      return collapsed;
    });
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  private switchOrganization(organizationId: string): void {
    this.error.set('');
    this.organizationControl.disable({emitEvent: false});
    this.auth.switchOrganization(organizationId).subscribe({
      next: () => window.location.assign('/dashboard'),
      error: error => {
        this.organizationControl.setValue(this.auth.user()?.organizationId ?? '', {emitEvent: false});
        this.organizationControl.enable({emitEvent: false});
        this.error.set(apiErrorMessage(error, 'Não foi possível trocar de organização.'));
      },
    });
  }
}
