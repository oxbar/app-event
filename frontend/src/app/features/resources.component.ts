import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {TuiPagination} from '@taiga-ui/kit';
import {apiErrorMessage} from '../core/api-error';
import {AdminApi, AdminKind, CheckoutApi} from '../core/api.services';
import {AdminRow} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, TuiButton, TuiLoader, TuiPagination, DisplayLabelPipe],
  template: `
    <div class="page-title">
      <div><h1>{{title()}}</h1><p>Dados reais da organização autenticada.</p></div>
      <button tuiButton appearance="secondary" type="button" (click)="load(pageIndex)" [disabled]="loading()">Atualizar</button>
    </div>

    @if (error()) {
      <section class="error-panel" role="alert">
        <p>{{error()}}</p>
        <button tuiButton type="button" (click)="load(pageIndex)">Tentar novamente</button>
      </section>
    }

    @if (loading()) {
      <tui-loader />
    } @else {
      <section class="resource-table">
        <div class="resource-head">
          <span>Identificação</span><span>Contexto</span><span>Situação</span><span>Valor/Data</span><span>Ações</span>
        </div>
        @for (row of rows(); track row.id) {
          <article>
            <div>
              <strong>{{row.publicCode || row.orderCode || row.name || (row.action | displayLabel:'') || row.id}}</strong>
              <small>{{row.buyerEmail || row.attendeeEmail || row.email || (row.entityType | displayLabel:'')}}</small>
            </div>
            <div>
              <strong>{{row.eventName || row.buyerName || row.attendeeName || (row.provider | displayLabel:'') || row.reason}}</strong>
              <small>{{row.typeName || (row.method | displayLabel:'') || row.phoneMasked || row.entityId}}</small>
            </div>
            <span class="status">{{row.status | displayLabel:'Registrado'}}</span>
            <div>
              <strong>
                @if (row.totalAmount !== undefined) {
                  {{row.totalAmount | currency:'BRL'}}
                } @else if (row.amount !== undefined) {
                  {{row.amount | currency:'BRL'}}
                }
              </strong>
              <small>{{timestamp(row) | date:'dd/MM/yyyy HH:mm'}}</small>
            </div>
            <div class="button-row">
              @if (kind === 'tickets' && row.status === 'VALID') {
                <button tuiButton size="s" appearance="secondary" type="button" (click)="block(row.id)">Bloquear</button>
                <button tuiButton size="s" appearance="flat" type="button" (click)="resend(row.id)">Reenviar</button>
              }
              @if (kind === 'tickets' && row.status === 'BLOCKED') {
                <button tuiButton size="s" type="button" (click)="unblock(row.id)">Desbloquear</button>
              }
              @if (kind === 'payments' && row.status === 'PENDING') {
                <button tuiButton size="s" appearance="secondary" type="button" [disabled]="actionLoading()" (click)="synchronizePayment(row.id)">
                  Sincronizar
                </button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">Nenhum registro encontrado.</div>
        }
      </section>
      @if (totalPages() > 1) {
        <tui-pagination
          [index]="pageIndex"
          [length]="totalPages()"
          (indexChange)="changePage($event)"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcesComponent {
  private readonly api = inject(AdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly checkout = inject(CheckoutApi);
  readonly kind = this.route.snapshot.data['kind'] as AdminKind;
  readonly rows = signal<AdminRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly totalPages = signal(0);
  readonly title = signal(this.route.snapshot.data['title'] as string);
  readonly actionLoading = signal(false);
  pageIndex = 0;

  constructor() {
    this.load(0);
  }

  load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list(this.kind, page).subscribe({
      next: result => {
        this.pageIndex = result.number;
        this.rows.set(result.content);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: error => {
        this.rows.set([]);
        this.error.set(apiErrorMessage(error, `Não foi possível carregar ${this.title().toLocaleLowerCase('pt-BR')}.`));
        this.loading.set(false);
      },
    });
  }

  timestamp(row: AdminRow): string | undefined {
    return row.paidAt || row.approvedAt || row.checkedInAt || row.requestedAt || row.createdAt;
  }

  changePage(page: number): void {
    this.load(page);
  }

  block(id: string): void {
    this.api.blockTicket(id, 'Bloqueio solicitado no painel').subscribe({
      next: () => this.load(this.pageIndex),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível bloquear o ingresso.')),
    });
  }

  unblock(id: string): void {
    this.api.unblockTicket(id).subscribe({
      next: () => this.load(this.pageIndex),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível desbloquear o ingresso.')),
    });
  }

  synchronizePayment(id: string): void {
    this.actionLoading.set(true);
    this.error.set('');
    this.checkout.synchronizePayment(id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.load(this.pageIndex);
      },
      error: error => {
        this.actionLoading.set(false);
        this.error.set(apiErrorMessage(error, 'Não foi possível sincronizar o pagamento com o provedor.'));
      },
    });
  }

  resend(id: string): void {
    this.api.resendTicket(id).subscribe({
      next: () => this.load(this.pageIndex),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível reenviar o ingresso.')),
    });
  }
}
