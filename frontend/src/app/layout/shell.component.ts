import {ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TuiButton, TuiIcon, TuiInput} from '@taiga-ui/core';
import {filter} from 'rxjs';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';
import {ThemeService} from '../core/theme.service';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiIcon, TuiInput, SelectFieldComponent],
  template: `
    <a class="skip-link" href="#main-content">Ir para o conteúdo principal</a>
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <aside id="main-menu" [class.open]="mobileMenuOpen()" aria-label="Menu principal">
        <div class="logo"><tui-icon icon="@tui.building-2" /><strong>Event Access</strong></div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" title="Visão geral"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.layout-dashboard" /><span>Visão geral</span></a>
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER')) {
            <a routerLink="/events" routerLinkActive="active" title="Eventos"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.calendar-days" /><span>Eventos</span></a>
            <a routerLink="/tickets" routerLinkActive="active" title="Ingressos"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.ticket" /><span>Ingressos</span></a>
            <a routerLink="/attendees" routerLinkActive="active" title="Participantes"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.users" /><span>Participantes</span></a>
            @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
              <a routerLink="/operations" routerLinkActive="active" title="Equipe e portarias"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.door-open" /><span>Equipe e portarias</span></a>
            }
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'DOOR_STAFF')) {
            <a routerLink="/door" routerLinkActive="active" title="Portaria"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.scan-line" /><span>Portaria</span></a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER')) {
            <a routerLink="/orders" routerLinkActive="active" title="Pedidos"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.receipt-text" /><span>Pedidos</span></a>
            <a routerLink="/reports" routerLinkActive="active" title="Relatórios"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.chart-column" /><span>Relatórios</span></a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE')) {
            <a routerLink="/payments" routerLinkActive="active" title="Pagamentos"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.wallet" /><span>Pagamentos</span></a>
            <a routerLink="/refunds" routerLinkActive="active" title="Reembolsos"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.rotate-ccw" /><span>Reembolsos</span></a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
            <a routerLink="/audit" routerLinkActive="active" title="Auditoria"
               (click)="closeMobileMenu()"><tui-icon icon="@tui.shield-check" /><span>Auditoria</span></a>
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
            <tui-icon icon="@tui.menu" />
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
          <button
            class="theme-toggle"
            tuiButton
            appearance="secondary"
            type="button"
            [iconStart]="theme.dark() ? '@tui.sun' : '@tui.moon'"
            [attr.aria-pressed]="theme.dark()"
            [attr.aria-label]="theme.dark() ? 'Tema claro' : 'Tema escuro'"
            [attr.title]="theme.dark() ? 'Ativar tema claro' : 'Ativar tema escuro'"
            (click)="theme.toggle()"
          >
            <span>{{theme.dark() ? 'Tema claro' : 'Tema escuro'}}</span>
          </button>
          <button tuiButton appearance="flat" type="button" iconStart="@tui.log-out" (click)="auth.logout()">
            Sair
          </button>
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
