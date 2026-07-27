import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {AuthService} from '../core/auth.service';
import {ThemeService} from '../core/theme.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiInput, TuiSelect],
  template: `
    <div class="shell">
      <aside [class.open]="menu()">
        <div class="logo"><span>EA</span><strong>Event Access</strong></div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER')) {
            <a routerLink="/events" routerLinkActive="active">Eventos</a>
            <a routerLink="/tickets" routerLinkActive="active">Ingressos</a>
            <a routerLink="/attendees" routerLinkActive="active">Participantes</a>
            @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
              <a routerLink="/operations" routerLinkActive="active">Equipe e Portarias</a>
            }
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'DOOR_STAFF')) {
            <a routerLink="/door" routerLinkActive="active">Portaria</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER')) {
            <a routerLink="/orders" routerLinkActive="active">Pedidos</a>
            <a routerLink="/reports" routerLinkActive="active">Relatórios</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE')) {
            <a routerLink="/payments" routerLinkActive="active">Pagamentos</a>
            <a routerLink="/refunds" routerLinkActive="active">Reembolsos</a>
          }
          @if (auth.hasRole('SUPER_ADMIN', 'ORGANIZER_ADMIN')) {
            <a routerLink="/audit" routerLinkActive="active">Auditoria</a>
          }
        </nav>
      </aside>
      <section class="workspace">
        <header>
          <button tuiButton appearance="flat" type="button" (click)="toggleMenu()">☰</button>
          @if (auth.organizationOptions().length > 1) {
            <tui-textfield class="organization-switcher">
              <select tuiSelect [value]="auth.user()?.organizationId" (change)="switchOrganization($event)">
                @for (organization of auth.organizationOptions(); track organization.id) {
                  <option [value]="organization.id">{{organization.name}}</option>
                }
              </select>
            </tui-textfield>
          }
          <div class="user-summary"><strong>{{auth.user()?.name}}</strong><small>{{auth.user()?.email}}</small></div>
          <button tuiButton appearance="secondary" type="button" (click)="theme.toggle()">
            {{theme.dark() ? 'Tema claro' : 'Tema escuro'}}
          </button>
          <button tuiButton appearance="flat" type="button" (click)="auth.logout()">Sair</button>
        </header>
        <main><router-outlet /></main>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly menu = signal(false);

  constructor() {
    this.auth.loadOrganizations();
  }

  toggleMenu(): void {
    this.menu.update(value => !value);
  }

  switchOrganization(event: Event): void {
    const organizationId = (event.target as HTMLSelectElement).value;
    if (!organizationId || organizationId === this.auth.user()?.organizationId) return;
    this.auth.switchOrganization(organizationId).subscribe(() => window.location.assign('/dashboard'));
  }
}
