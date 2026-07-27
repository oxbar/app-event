import {CurrencyPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {interval, startWith, switchMap, takeWhile} from 'rxjs';
import {CheckoutApi} from '../core/api.services';
import {Order} from '../core/models';

@Component({
  standalone: true,
  imports: [CurrencyPipe, TuiButton, TuiLoader],
  template: `
    <main class="public-page narrow">
      @if (order(); as current) {
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
            <strong>{{current.totalAmount | currency:'BRL'}}</strong>
            @if (current.payment) {
              <img [src]="current.payment.pixQrCodeUrl" alt="QR Code Pix" />
              <textarea readonly>{{current.payment.pixCopyPaste}}</textarea>
              <button tuiButton type="button" (click)="copy(current.payment.pixCopyPaste)">Copiar Pix</button>
              <button tuiButton appearance="secondary" type="button" (click)="approve(current.payment.id)">
                Aprovar pagamento (DEV)
              </button>
            }
            <p>O status é atualizado automaticamente até a aprovação ou expiração.</p>
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

  constructor() {
    interval(2500).pipe(
      startWith(0),
      switchMap(() => this.api.status(this.code)),
      takeWhile(value => !['PAID', 'EXPIRED', 'CANCELED', 'REFUNDED'].includes(value.status), true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(value => this.order.set(value));
  }

  token(qrValue: string): string {
    return qrValue.includes('/t/') ? qrValue.substring(qrValue.lastIndexOf('/t/') + 3) : qrValue;
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value);
  }

  approve(id: string): void {
    this.api.approve(id).subscribe(value => this.order.set(value));
  }
}
