import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TuiButton, TuiIcon, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {CheckoutApi} from '../core/api.services';
import {Ticket} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {TicketDownloadService} from '../shared/ticket-download.service';

@Component({
  standalone: true,
  imports: [DatePipe, TuiButton, TuiIcon, TuiLoader, DisplayLabelPipe],
  template: `
    <main class="ticket-page">
      @if (error()) {
        <section class="error-panel" role="alert">{{error()}}</section>
      } @else if (ticket(); as current) {
        <article class="digital-ticket">
          <header>
            <div><span>EVENT ACCESS</span><small>Ingresso digital</small></div>
            <b>{{current.status | displayLabel}}</b>
          </header>

          <section class="digital-ticket__event">
            <small>{{current.eventName}}</small>
            <h1>{{current.ticketType}}</h1>
            <p>{{current.attendeeName}}</p>
            <div class="digital-ticket__meta">
              <span>{{current.eventStartsAt | date:'dd/MM/yyyy, HH:mm'}}</span>
              @if (current.venueName) {<span>{{current.venueName}}</span>}
            </div>
          </section>

          @if (current.qrCodeDataUrl) {
            <div class="digital-ticket__qr">
              <img [src]="current.qrCodeDataUrl" alt="QR Code do ingresso" />
            </div>
          }

          <code>{{current.publicCode}}</code>
          <div class="wristband">
            <span [style.background]="current.wristbandColorHex"></span>
            <small>Pulseira</small>
            {{current.wristbandLabel || current.wristbandColorName}}
          </div>

          <div class="ticket-actions">
            <button tuiButton type="button" iconStart="@tui.maximize" (click)="fullscreen()">Exibir em tela cheia</button>
            <button tuiButton appearance="secondary" type="button" iconStart="@tui.download" (click)="downloadTicket(current)">
              Baixar ingresso em PNG
            </button>
            <button tuiButton appearance="secondary" type="button" iconStart="@tui.download" (click)="downloadQr(current)">
              Baixar QR Code
            </button>
            <button tuiButton appearance="flat" type="button" [iconStart]="copied() ? '@tui.check' : '@tui.copy'" (click)="copy(current.publicCode)">
              {{copied() ? 'Código copiado' : 'Copiar código TKT'}}
            </button>
          </div>
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
  private readonly downloads = inject(TicketDownloadService);
  readonly ticket = signal<Ticket | null>(null);
  readonly error = signal('');
  readonly copied = signal(false);

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

  downloadTicket(ticket: Ticket): void {
    void this.downloads.downloadTicket(ticket).catch(() => {
      this.error.set('Não foi possível gerar a imagem do ingresso.');
    });
  }

  downloadQr(ticket: Ticket): void {
    this.downloads.downloadQr(ticket);
  }

  copy(value: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1800);
    });
  }
}
