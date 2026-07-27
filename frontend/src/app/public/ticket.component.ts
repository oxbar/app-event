import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiLoader} from '@taiga-ui/core';
import {CheckoutApi} from '../core/api.services';
import {Ticket} from '../core/models';

@Component({
  standalone: true,
  imports: [TuiButton, TuiLoader],
  template: `
    <main class="ticket-page">
      @if (ticket(); as current) {
        <article class="digital-ticket">
          <header><span>EVENT ACCESS</span><b>{{current.status}}</b></header>
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

  constructor() {
    const token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';
    this.api.ticket(token).subscribe(value => this.ticket.set(value));
  }

  fullscreen(): void {
    void document.documentElement.requestFullscreen?.();
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value);
  }
}
