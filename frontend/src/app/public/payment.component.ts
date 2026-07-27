import {CurrencyPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {interval, startWith, switchMap, takeWhile} from 'rxjs';
import {apiErrorMessage} from '../core/api-error';
import {CheckoutApi} from '../core/api.services';
import {Order} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';

@Component({
  standalone: true,
  imports: [CurrencyPipe, TuiButton, TuiLoader, DisplayLabelPipe],
  template: `
    <main class="public-page narrow">
      @if (error()) {
        <section class="error-panel" role="alert">{{error()}}</section>
      } @else if (order(); as current) {
        <section class="panel payment-card">
          @if (current.status === 'PAID') {
            <div class="success-icon">✓</div>
            <h1>Pagamento confirmado</h1>
            <p>Os ingressos foram emitidos individualmente.</p>
            @for (ticket of current.tickets; track ticket.publicCode) {
              @if (ticket.qrValue) {
                <a tuiButton [href]="'/ticket/' + token(ticket.qrValue)">
                  Ver ingresso {{ticket.publicCode}}
                </a>
              }
            }
          } @else if (current.status === 'EXPIRED') {
            <h1>Pagamento expirado</h1>
            <p>O prazo do Pix terminou e a reserva foi liberada.</p>
          } @else {
            <h1>Pague com Pix</h1>
            <span class="status">{{current.status | displayLabel}}</span>
            <strong>{{current.totalAmount | currency:'BRL'}}</strong>
            @if (current.payment) {
              <img [src]="current.payment.pixQrCodeUrl" alt="QR Code Pix" />
              <textarea readonly aria-label="Código Pix copia e cola">{{current.payment.pixCopyPaste}}</textarea>
              <button tuiButton type="button" (click)="copy(current.payment.pixCopyPaste)">Copiar código Pix</button>
              <button tuiButton appearance="secondary" type="button" (click)="approve(current.payment.id)">
                Aprovar pagamento no ambiente de desenvolvimento
              </button>
            }
            <p>A situação é atualizada automaticamente até a aprovação ou expiração.</p>
          }
        </section>
      } @else {
        <tui-loader />
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentComponent {
  private readonly api = inject(CheckoutApi);
  private readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';
  private readonly destroyRef = inject(DestroyRef);
  readonly order = signal<Order | null>(null);
  readonly error = signal('');

  constructor() {
    interval(2500).pipe(
      startWith(0),
      switchMap(() => this.api.status(this.code)),
      takeWhile(value => !['PAID', 'EXPIRED', 'CANCELED', 'REFUNDED'].includes(value.status), true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: value => this.order.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível consultar a situação do pagamento.')),
    });
  }

  token(qrValue: string): string {
    return qrValue.includes('/t/') ? qrValue.substring(qrValue.lastIndexOf('/t/') + 3) : qrValue;
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value);
  }

  approve(id: string): void {
    this.error.set('');
    this.api.approve(id).subscribe({
      next: value => this.order.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível aprovar o pagamento simulado.')),
    });
  }
}
