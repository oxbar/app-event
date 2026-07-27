import {CurrencyPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {DashboardApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {DashboardSummary} from '../core/models';

@Component({
  standalone: true,
  imports: [CurrencyPipe, TuiButton, TuiLoader],
  template: `
    <div class="page-title">
      <div><h1>Visão geral</h1><p>Resumo operacional e financeiro da organização.</p></div>
      <button tuiButton appearance="secondary" type="button" (click)="load()" [disabled]="loading()">
        Atualizar
      </button>
    </div>

    @if (loading()) {
      <tui-loader />
    } @else if (error()) {
      <section class="error-panel" role="alert">
        <p>{{error()}}</p>
        <button tuiButton type="button" (click)="load()">Tentar novamente</button>
      </section>
    } @else if (summary(); as current) {
      <section class="metric-grid">
        <article><small>Faturamento</small><strong>{{current.revenue | currency:'BRL'}}</strong></article>
        <article><small>Eventos</small><strong>{{current.events}}</strong></article>
        <article><small>Pedidos pendentes</small><strong>{{current.pendingOrders}}</strong></article>
        <article><small>Ingressos emitidos</small><strong>{{current.issuedTickets}}</strong></article>
        <article><small>Presentes</small><strong>{{current.present}}</strong></article>
        <article><small>Ausentes</small><strong>{{current.absent}}</strong></article>
        <article><small>Tentativas duplicadas</small><strong>{{current.duplicateAttempts}}</strong></article>
      </section>
      <section class="panel">
        <h2>Operação em tempo real</h2>
        <div class="progress">
          <span [style.width.%]="current.issuedTickets ? 100 * current.present / current.issuedTickets : 0"></span>
        </div>
        <p>{{current.present}} de {{current.issuedTickets}} ingressos emitidos já entraram.</p>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly api = inject(DashboardApi);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.summary().subscribe({
      next: summary => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar a visão geral.'));
        this.loading.set(false);
      },
    });
  }
}
