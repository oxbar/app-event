import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {CheckoutApi} from '../core/api.services';
import {Ticket} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';

@Component({
  standalone: true,
  imports: [TuiButton, TuiLoader, DisplayLabelPipe],
  template: `
    <main class="ticket-page">
      @if (error()) {
        <section class="error-panel" role="alert">{{error()}}</section>
      } @else if (ticket(); as current) {
        <article class="digital-ticket">
          <header><span>EVENT ACCESS</span><b>{{current.status | displayLabel}}</b></header>
          <h1>{{current.ticketType}}</h1>
          <p>{{current.attendeeName}}</p>
          @if (current.qrCodeDataUrl) {
            <img [src]="current.qrCodeDataUrl" alt="QR Code do ingresso" />
          }
          <code>{{current.publicCode}}</code>
          <div class="wristband">
            <span [style.background]="current.wristbandColorHex"></span>
            {{current.wristbandLabel}}
          </div>
          <button tuiButton type="button" (click)="fullscreen()">Exibir em tela cheia</button>
          <button tuiButton appearance="secondary" type="button" (click)="copy(current.publicCode)">
            Copiar código
          </button>
        </article>
      } @else {
        <tui-loader />
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketComponent {
  private readonly api = inject(CheckoutApi);
  readonly ticket = signal<Ticket | null>(null);
  readonly error = signal('');

  constructor() {
    const token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';
    this.api.ticket(token).subscribe({
      next: value => this.ticket.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar o ingresso.')),
    });
  }

  fullscreen(): void {
    void document.documentElement.requestFullscreen?.();
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value);
  }
}
