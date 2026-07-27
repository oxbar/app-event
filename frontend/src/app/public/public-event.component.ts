import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiButton, TuiCheckbox, TuiLoader, TuiInput} from '@taiga-ui/core';
import {CheckoutApi, EventApi} from '../core/api.services';
import {PublicEvent, TicketType} from '../core/models';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, TuiButton, TuiCheckbox, TuiLoader, TuiInput],
  template: `
    @if (data(); as current) {
      <main class="public-page">
        <section class="hero">
          <div>
            <span>EVENT ACCESS</span>
            <h1>{{current.event.name}}</h1>
            <p>{{current.event.description}}</p>
            <strong>{{current.event.startsAt | date:'dd/MM/yyyy HH:mm'}} · {{current.event.venueName}}</strong>
          </div>
        </section>
        <section class="checkout-grid">
          <div>
            <h2>Escolha seu ingresso</h2>
            @for (ticketType of current.ticketTypes; track ticketType.id) {
              <button
                class="ticket-option"
                [class.selected]="selected()?.id === ticketType.id"
                [disabled]="ticketType.availableQuantity === 0"
                type="button"
                (click)="select(ticketType)"
              >
                <span [style.background]="ticketType.wristbandColorHex"></span>
                <div>
                  <strong>{{ticketType.name}}</strong>
                  <small>{{ticketType.availableQuantity}} disponíveis · {{ticketType.wristbandLabel}}</small>
                </div>
                <b>{{ticketType.price + ticketType.serviceFee | currency:'BRL'}}</b>
              </button>
            }
          </div>
          <form class="panel" [formGroup]="form" (ngSubmit)="buy()">
            <h2>Identificação</h2>
            <tui-textfield><input tuiInput placeholder="Nome completo" formControlName="name" /></tui-textfield>
            <tui-textfield><input tuiInput type="email" placeholder="E-mail" formControlName="email" /></tui-textfield>
            <tui-textfield><input tuiInput placeholder="Telefone" formControlName="phone" /></tui-textfield>
            <tui-textfield><input tuiInput type="number" placeholder="Quantidade" formControlName="quantity" /></tui-textfield>
            <label class="check">
              <input tuiCheckbox type="checkbox" formControlName="accepted" />
              Aceito os termos e a política de privacidade.
            </label>
            @if (error()) {
              <div class="error-panel">{{error()}}</div>
            }
            <button tuiButton type="submit" [disabled]="form.invalid || !selected() || loading()">
              {{loading() ? 'Criando pedido...' : 'Ir para o Pix'}}
            </button>
          </form>
        </section>
      </main>
    } @else {
      <tui-loader />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicEventComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventApi);
  private readonly checkout = inject(CheckoutApi);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly data = signal<PublicEvent | null>(null);
  readonly selected = signal<TicketType | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    accepted: [false, Validators.requiredTrue],
  });

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.events.public(slug).subscribe(value => {
      this.data.set(value);
      this.selected.set(value.ticketTypes.find(type => type.availableQuantity > 0) ?? null);
    });
  }

  select(ticketType: TicketType): void {
    if (ticketType.availableQuantity > 0) this.selected.set(ticketType);
  }

  buy(): void {
    const ticketType = this.selected();
    const event = this.data();
    if (!ticketType || !event || this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.checkout.checkout(event.event.id, {
      buyer: {name: value.name, email: value.email, phone: value.phone},
      items: [{ticketTypeId: ticketType.id, quantity: value.quantity}],
      acceptedTerms: value.accepted,
      acceptedPrivacy: value.accepted,
    }).subscribe({
      next: order => this.checkout.pix(order.publicCode).subscribe({
        next: () => void this.router.navigate(['/payment', order.publicCode]),
        error: response => {
          this.error.set(response.error?.message ?? 'Não foi possível criar o Pix.');
          this.loading.set(false);
        },
      }),
      error: response => {
        this.error.set(response.error?.message ?? 'Não foi possível criar o pedido.');
        this.loading.set(false);
      },
    });
  }
}
