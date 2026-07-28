import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {finalize, interval, startWith, switchMap, takeWhile} from 'rxjs';
import {apiErrorMessage} from '../core/api-error';
import {CheckoutApi} from '../core/api.services';
import {AuthService} from '../core/auth.service';
import {Order, Ticket} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {TicketDownloadService} from '../shared/ticket-download.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, TuiButton, TuiLoader, DisplayLabelPipe],
  template: `
    <main class="payment-page">
      <header class="payment-header">
        <a href="/" class="payment-brand"><span>EA</span><b>Event Access</b></a>
        <small>Pedido {{code}}</small>
      </header>

      @if (order(); as current) {
        @if (current.status === 'PAID') {
          <section class="payment-success-card">
            <div class="success-icon">✓</div>
            <span class="eyebrow">PAGAMENTO CONFIRMADO</span>
            <h1>Seu ingresso está pronto</h1>
            <p>O Asaas confirmou o recebimento e os ingressos foram emitidos.</p>
            <div class="success-tickets">
              @for (ticket of current.tickets; track ticket.publicCode) {
                @if (ticket.qrValue) {
                  <article class="success-ticket-item">
                    <div>
                      <b>{{ticket.ticketType}}</b>
                      <small>{{ticket.publicCode}} · {{ticket.attendeeName}}</small>
                    </div>
                    <div class="success-ticket-actions">
                      <a tuiButton [href]="'/ticket/' + token(ticket.qrValue)">Abrir ingresso</a>
                      <button tuiButton appearance="secondary" type="button" (click)="downloadTicket(ticket)">
                        Baixar PNG
                      </button>
                      <button tuiButton appearance="flat" type="button" (click)="downloadQr(ticket)">
                        Baixar QR Code
                      </button>
                    </div>
                  </article>
                }
              }
            </div>
            <a class="text-link" href="/">Voltar para a página inicial</a>
          </section>
        } @else if (['EXPIRED', 'CANCELED', 'REFUNDED'].includes(current.status)) {
          <section class="payment-success-card expired">
            <div class="payment-state-icon">!</div>
            <h1>{{current.status | displayLabel}}</h1>
            <p>Esta cobrança não pode mais ser utilizada. Volte ao evento para gerar um novo pedido.</p>
          </section>
        } @else {
          <section class="payment-container">
            <div class="payment-title">
              <div>
                <span class="eyebrow">PAGAMENTO SEGURO</span>
                <h1>Finalize sua compra com Pix</h1>
                <p>Escaneie o QR Code no aplicativo do banco ou use o Pix Copia e Cola.</p>
              </div>
              <span class="status">{{current.status | displayLabel}}</span>
            </div>

            @if (error()) {
              <div class="error-panel" role="alert">{{error()}}</div>
            }

            <div class="payment-layout">
              <section class="pix-card">
                @if (current.payment; as payment) {
                  <div class="pix-provider">
                    <span class="pix-logo">Pix</span>
                    <div>
                      <b>{{providerLabel(payment.provider)}}</b>
                      <small>Ambiente {{payment.sandbox ? 'Sandbox' : 'de produção'}}</small>
                    </div>
                  </div>

                  <div class="qr-frame">
                    <img [src]="payment.pixQrCodeUrl" alt="QR Code para pagamento via Pix" />
                  </div>

                  <div class="pix-copy-block">
                    <label for="pix-code">Pix Copia e Cola</label>
                    <textarea id="pix-code" readonly>{{payment.pixCopyPaste}}</textarea>
                    <button tuiButton type="button" (click)="copy(payment.pixCopyPaste)">
                      {{copied() ? 'Código copiado' : 'Copiar código Pix'}}
                    </button>
                  </div>

                  @if (payment.invoiceUrl) {
                    <a class="provider-link" [href]="payment.invoiceUrl" target="_blank" rel="noopener noreferrer">
                      Abrir cobrança no Asaas
                    </a>
                  }
                } @else {
                  <tui-loader />
                }
              </section>

              <aside class="payment-summary-card">
                <span class="eyebrow">RESUMO DO PEDIDO</span>
                <h2>{{current.tickets.length}} ingresso(s)</h2>
                <div class="payment-summary-row">
                  <span>Ingressos</span>
                  <strong>{{current.subtotal | currency:'BRL'}}</strong>
                </div>
                <div class="payment-summary-row">
                  <span>Taxa de serviço</span>
                  <strong>{{current.serviceFee | currency:'BRL'}}</strong>
                </div>
                <div class="payment-summary-total">
                  <span>Total</span>
                  <strong>{{current.totalAmount | currency:'BRL'}}</strong>
                </div>

                @if (current.payment?.expiresAt) {
                  <div class="payment-expiration">
                    <b>Prazo para pagamento</b>
                    <span>{{current.payment?.expiresAt | date:'dd/MM/yyyy HH:mm:ss'}}</span>
                  </div>
                }

                <div class="payment-waiting">
                  <span class="pulse-dot"></span>
                  <div>
                    <b>Aguardando confirmação</b>
                    <small>O status é atualizado automaticamente por webhook.</small>
                  </div>
                </div>

                @if (current.payment?.provider === 'ASAAS' && current.payment?.sandbox) {
                  <div class="sandbox-guide">
                    <b>Como confirmar no Sandbox</b>
                    <ol>
                      <li>Entre no painel Sandbox do Asaas.</li>
                      <li>Abra esta cobrança e clique em <strong>CONFIRMAR PAGAMENTO</strong>.</li>
                      <li>Aguarde o webhook ou use “Sincronizar” abaixo.</li>
                    </ol>
                  </div>
                }

                @if (current.payment && auth.authenticated()) {
                  <div class="sandbox-tools">
                    <small>Ferramentas de homologação</small>
                    @if (current.payment.provider === 'FAKE') {
                      <button tuiButton appearance="secondary" type="button" [disabled]="actionLoading()" (click)="approveFake(current.payment.id)">
                        Aprovar pagamento simulado
                      </button>
                    } @else {
                      <button tuiButton appearance="secondary" type="button" [disabled]="actionLoading()" (click)="synchronize(current.payment.id)">
                        Sincronizar com o Asaas
                      </button>
                    }
                  </div>
                }
              </aside>
            </div>
          </section>
        }
      } @else if (error()) {
        <section class="payment-success-card expired"><div class="error-panel">{{error()}}</div></section>
      } @else {
        <div class="public-loading"><tui-loader /></div>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentComponent {
  private readonly api = inject(CheckoutApi);
  private readonly downloads = inject(TicketDownloadService);
  readonly auth = inject(AuthService);
  readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';
  private readonly destroyRef = inject(DestroyRef);
  readonly order = signal<Order | null>(null);
  readonly error = signal('');
  readonly copied = signal(false);
  readonly actionLoading = signal(false);

  constructor() {
    interval(3000).pipe(
      startWith(0),
      switchMap(() => this.api.status(this.code)),
      takeWhile(value => !['PAID', 'EXPIRED', 'CANCELED', 'REFUNDED'].includes(value.status), true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: value => {
        this.order.set(value);
        this.error.set('');
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível consultar a situação do pagamento.')),
    });
  }

  providerLabel(provider: string): string {
    return provider === 'ASAAS' ? 'Processado pelo Asaas' : 'Provedor de demonstração';
  }

  token(qrValue: string): string {
    return qrValue.includes('/t/') ? qrValue.substring(qrValue.lastIndexOf('/t/') + 3) : qrValue;
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1800);
    });
  }


  downloadTicket(ticket: Ticket): void {
    void this.downloads.downloadTicket(ticket).catch(() => {
      this.error.set('Não foi possível gerar a imagem do ingresso.');
    });
  }

  downloadQr(ticket: Ticket): void {
    this.downloads.downloadQr(ticket);
  }

  approveFake(id: string): void {
    this.actionLoading.set(true);
    this.error.set('');
    this.api.approveFake(id).pipe(finalize(() => this.actionLoading.set(false))).subscribe({
      next: value => this.order.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível aprovar o pagamento simulado.')),
    });
  }

  synchronize(id: string): void {
    this.actionLoading.set(true);
    this.error.set('');
    this.api.synchronizePayment(id).pipe(finalize(() => this.actionLoading.set(false))).subscribe({
      next: value => this.order.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível sincronizar a cobrança com o Asaas.')),
    });
  }
}
