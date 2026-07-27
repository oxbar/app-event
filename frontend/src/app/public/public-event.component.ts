import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiButton, TuiCheckbox, TuiInput, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {CheckoutApi, EventApi} from '../core/api.services';
import {PublicEvent, TicketType} from '../core/models';
import {FormErrorComponent} from '../shared/form-error.component';
import {InputMaskDirective} from '../shared/input-mask.directive';
import {brazilianPhoneValidator, cpfValidator} from '../shared/validators';

@Component({
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    TuiButton,
    TuiCheckbox,
    TuiLoader,
    TuiInput,
    FormErrorComponent,
    InputMaskDirective,
  ],
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
          <form class="panel stack" [formGroup]="form" (ngSubmit)="buy()" novalidate>
            <h2>Identificação</h2>
            <div class="form-field">
              <label for="checkout-name">Nome completo</label>
              <tui-textfield><input id="checkout-name" tuiInput autocomplete="name" placeholder="Nome e sobrenome" formControlName="name" /></tui-textfield>
              <app-form-error [control]="form.controls.name" label="Nome completo" />
            </div>
            <div class="form-field">
              <label for="checkout-email">E-mail</label>
              <tui-textfield><input id="checkout-email" tuiInput type="email" autocomplete="email" placeholder="voce@email.com" formControlName="email" /></tui-textfield>
              <app-form-error [control]="form.controls.email" label="E-mail" />
            </div>
            <div class="form-field">
              <label for="checkout-phone">Telefone</label>
              <tui-textfield>
                <input id="checkout-phone" tuiInput inputmode="tel" autocomplete="tel" placeholder="(47) 99999-9999" appInputMask="phone" formControlName="phone" />
              </tui-textfield>
              <app-form-error [control]="form.controls.phone" label="Telefone" />
            </div>
            @if (current.event.requireDocument) {
              <div class="form-field">
                <label for="checkout-document">CPF</label>
                <tui-textfield>
                  <input id="checkout-document" tuiInput inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" appInputMask="cpf" formControlName="documentNumber" />
                </tui-textfield>
                <app-form-error [control]="form.controls.documentNumber" label="CPF" />
              </div>
            }
            <div class="form-field">
              <label for="checkout-quantity">Quantidade</label>
              <tui-textfield>
                <input
                  id="checkout-quantity"
                  tuiInput
                  type="number"
                  inputmode="numeric"
                  min="1"
                  [max]="quantityLimit()"
                  step="1"
                  formControlName="quantity"
                />
              </tui-textfield>
              <small class="form-hint">Máximo permitido: {{quantityLimit()}}</small>
              <app-form-error [control]="form.controls.quantity" label="Quantidade" />
            </div>
            <label class="check">
              <input tuiCheckbox type="checkbox" formControlName="accepted" />
              Aceito os termos de uso e a política de privacidade.
            </label>
            @if (error()) {
              <div class="error-panel" role="alert">{{error()}}</div>
            }
            <button tuiButton type="submit" [disabled]="loading() || !selected()">
              {{loading() ? 'Criando pedido...' : 'Ir para o Pix'}}
            </button>
          </form>
        </section>
      </main>
    } @else if (error()) {
      <main class="auth-page"><section class="error-panel" role="alert">{{error()}}</section></main>
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
  readonly quantityLimit = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    phone: ['', [Validators.required, brazilianPhoneValidator]],
    documentNumber: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    accepted: [false, Validators.requiredTrue],
  });

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.events.public(slug).subscribe({
      next: value => {
        this.data.set(value);
        if (value.event.requireDocument) {
          this.form.controls.documentNumber.setValidators([Validators.required, cpfValidator]);
          this.form.controls.documentNumber.updateValueAndValidity({emitEvent: false});
        }
        const firstAvailable = value.ticketTypes.find(type => type.availableQuantity > 0) ?? null;
        if (firstAvailable) this.select(firstAvailable);
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar o evento.')),
    });
  }

  select(ticketType: TicketType): void {
    if (ticketType.availableQuantity <= 0) return;
    this.selected.set(ticketType);
    const limit = Math.max(1, Math.min(ticketType.maxPerOrder, ticketType.availableQuantity));
    this.quantityLimit.set(limit);
    this.form.controls.quantity.setValidators([Validators.required, Validators.min(1), Validators.max(limit)]);
    if (this.form.controls.quantity.value > limit) this.form.controls.quantity.setValue(limit);
    this.form.controls.quantity.updateValueAndValidity({emitEvent: false});
  }

  buy(): void {
    const ticketType = this.selected();
    const event = this.data();
    if (!ticketType || !event || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.checkout.checkout(event.event.id, {
      buyer: {
        name: value.name.trim(),
        email: value.email.trim().toLocaleLowerCase('pt-BR'),
        phone: value.phone,
        documentType: event.event.requireDocument ? 'CPF' : undefined,
        documentNumber: event.event.requireDocument ? value.documentNumber : undefined,
      },
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
