import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {TuiPagination} from '@taiga-ui/kit';
import {AdminApi, AdminKind} from '../core/api.services';
import {AdminRow} from '../core/models';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, TuiButton, TuiLoader, TuiPagination],
  template: `
    <div class="page-title">
      <div><h1>{{title()}}</h1><p>Dados reais da organização autenticada.</p></div>
      <button tuiButton appearance="secondary" type="button" (click)="load(pageIndex)">Atualizar</button>
    </div>
    @if (loading()) {
      <tui-loader />
    } @else {
      <section class="resource-table">
        <div class="resource-head">
          <span>Identificação</span><span>Contexto</span><span>Status</span><span>Valor/Data</span><span>Ações</span>
        </div>
        @for (row of rows(); track row.id) {
          <article>
            <div>
              <strong>{{row.publicCode || row.orderCode || row.action || row.name || row.id}}</strong>
              <small>{{row.buyerEmail || row.attendeeEmail || row.email || row.entityType}}</small>
            </div>
            <div>
              <strong>{{row.eventName || row.buyerName || row.attendeeName || row.provider || row.reason}}</strong>
              <small>{{row.typeName || row.method || row.phoneMasked || row.entityId}}</small>
            </div>
            <span class="status">{{row.status || 'REGISTRADO'}}</span>
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
  readonly kind = this.route.snapshot.data['kind'] as AdminKind;
  readonly rows = signal<AdminRow[]>([]);
  readonly loading = signal(true);
  readonly totalPages = signal(0);
  readonly title = signal(this.route.snapshot.data['title'] as string);
  pageIndex = 0;

  constructor() {
    this.load(0);
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list(this.kind, page).subscribe({
      next: result => {
        this.pageIndex = result.number;
        this.rows.set(result.content);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  timestamp(row: AdminRow): string | undefined {
    return row.paidAt || row.approvedAt || row.checkedInAt || row.requestedAt || row.createdAt;
  }

  changePage(page: number): void {
    this.load(page);
  }

  block(id: string): void {
    this.api.blockTicket(id, 'Bloqueio solicitado no painel').subscribe(() => this.load(this.pageIndex));
  }

  unblock(id: string): void {
    this.api.unblockTicket(id).subscribe(() => this.load(this.pageIndex));
  }

  resend(id: string): void {
    this.api.resendTicket(id).subscribe(() => this.load(this.pageIndex));
  }
}
