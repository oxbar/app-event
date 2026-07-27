import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';
import {ThemeService} from '../core/theme.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiInput, TuiSelect],
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
              <select tuiSelect [formControl]="organizationControl">
                @for (organization of auth.organizationOptions(); track organization.id) {
                  <option [value]="organization.id">{{organization.name}}</option>
                }
              </select>
            </tui-textfield>
          }
          @if (error()) {<small class="header-error">{{error()}}</small>}
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
  readonly error = signal('');
  readonly organizationControl = new FormControl(
    this.auth.user()?.organizationId ?? '',
    {nonNullable: true},
  );

  constructor() {
    this.auth.loadOrganizations();
    this.organizationControl.valueChanges.subscribe(organizationId => {
      if (!organizationId || organizationId === this.auth.user()?.organizationId) return;
      this.switchOrganization(organizationId);
    });
  }

  toggleMenu(): void {
    this.menu.update(value => !value);
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
