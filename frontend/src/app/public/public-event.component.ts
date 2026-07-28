import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiInput, TuiLoader} from '@taiga-ui/core';
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
    TuiLoader,
    TuiInput,
    RouterLink,
    FormErrorComponent,
    InputMaskDirective,
  ],
  template: `
    @if (data(); as current) {
      <main class="event-storefront">
        <header class="event-hero">
          <div class="event-hero__content">
            <span class="event-brand">EVENT ACCESS</span>
            <h1>{{current.event.name}}</h1>
            <p>{{current.event.description || 'Garanta seu ingresso com pagamento rápido e seguro via Pix.'}}</p>
            <div class="event-meta">
              <span>📅 {{current.event.startsAt | date:'dd/MM/yyyy, HH:mm'}}</span>
              <span>📍 {{location(current)}}</span>
            </div>
          </div>
        </header>

        <section class="checkout-container">
          <ol class="checkout-steps" aria-label="Etapas da compra">
            <li class="active"><b>1</b><span>Ingresso</span></li>
            <li class="active"><b>2</b><span>Identificação</span></li>
            <li><b>3</b><span>Pagamento</span></li>
          </ol>

          <div class="checkout-layout">
            <section class="ticket-selection-panel" aria-labelledby="ticket-heading">
              <div class="section-heading">
                <div>
                  <span class="eyebrow">INGRESSOS DISPONÍVEIS</span>
                  <h2 id="ticket-heading">Escolha sua experiência</h2>
                </div>
                <small>Pagamento por Pix</small>
              </div>

              <div class="ticket-options">
                @for (ticketType of current.ticketTypes; track ticketType.id) {
                  <button
                    class="ticket-option"
                    [class.selected]="selected()?.id === ticketType.id"
                    [disabled]="ticketType.availableQuantity === 0"
                    [attr.aria-pressed]="selected()?.id === ticketType.id"
                    type="button"
                    (click)="select(ticketType)"
                  >
                    <span
                      class="ticket-option__color"
                      [style.background]="ticketType.wristbandColorHex || '#6b4eff'"
                      aria-hidden="true"
                    ></span>
                    <div class="ticket-option__content">
                      <strong>{{ticketType.name}}</strong>
                      <div class="ticket-option__details">
                        <span>{{ticketType.availableQuantity}} disponíveis</span>
                        @if (ticketType.wristbandLabel) {
                          <span>{{ticketType.wristbandLabel}}</span>
                        }
                      </div>
                    </div>
                    <div class="ticket-option__price">
                      <small>por ingresso</small>
                      <b>{{ticketType.price + ticketType.serviceFee | currency:'BRL'}}</b>
                    </div>
                    <span class="ticket-option__check" aria-hidden="true">
                      @if (selected()?.id === ticketType.id) { ✓ }
                    </span>
                  </button>
                } @empty {
                  <div class="checkout-empty">Nenhum ingresso disponível para venda neste momento.</div>
                }
              </div>

              @if (selected(); as ticket) {
                <div class="purchase-summary">
                  <div>
                    <span>{{ticket.name}} × {{form.controls.quantity.value}}</span>
                    <strong>{{subtotal() | currency:'BRL'}}</strong>
                  </div>
                  <div>
                    <span>Taxa de serviço</span>
                    <strong>{{serviceFee() | currency:'BRL'}}</strong>
                  </div>
                  <div class="purchase-summary__total">
                    <span>Total</span>
                    <strong>{{total() | currency:'BRL'}}</strong>
                  </div>
                </div>
              }
            </section>

            <form class="checkout-form-card" [formGroup]="form" (ngSubmit)="buy()" novalidate>
              <div class="section-heading compact">
                <div>
                  <span class="eyebrow">DADOS DO COMPRADOR</span>
                  <h2>Identificação</h2>
                </div>
                <span class="secure-badge">🔒 Seguro</span>
              </div>

              <div class="form-field">
                <label for="checkout-name">Nome completo</label>
                <tui-textfield>
                  <input id="checkout-name" tuiInput autocomplete="name" placeholder="Nome e sobrenome" formControlName="name" />
                </tui-textfield>
                <app-form-error [control]="form.controls.name" label="Nome completo" />
              </div>
              <div class="form-field">
                <label for="checkout-email">E-mail</label>
                <tui-textfield>
                  <input id="checkout-email" tuiInput type="email" autocomplete="email" placeholder="voce@email.com" formControlName="email" />
                </tui-textfield>
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
                  <input id="checkout-quantity" tuiInput type="number" inputmode="numeric" min="1" [max]="quantityLimit()" step="1" formControlName="quantity" />
                </tui-textfield>
                <small class="form-hint">Limite por compra: {{quantityLimit()}}</small>
                <app-form-error [control]="form.controls.quantity" label="Quantidade" />
              </div>

              <div class="legal-consents">
                <div class="legal-consent">
                  <input id="accepted-terms" class="legal-consent__checkbox" type="checkbox" formControlName="acceptedTerms" />
                  <div class="legal-consent__text">
                    <label for="accepted-terms">Li e aceito os</label>
                    <a routerLink="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>.
                  </div>
                </div>
                <app-form-error [control]="form.controls.acceptedTerms" label="Aceite dos Termos de Uso" />

                <div class="legal-consent">
                  <input id="accepted-privacy" class="legal-consent__checkbox" type="checkbox" formControlName="acceptedPrivacy" />
                  <div class="legal-consent__text">
                    <label for="accepted-privacy">Li e estou ciente da</label>
                    <a routerLink="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
                  </div>
                </div>
                <app-form-error [control]="form.controls.acceptedPrivacy" label="Ciência da Política de Privacidade" />
              </div>

              @if (error()) {
                <div class="error-panel" role="alert">{{error()}}</div>
              }

              <button class="checkout-submit" tuiButton type="submit" [disabled]="loading() || !selected() || form.invalid">
                {{loading() ? 'Gerando cobrança Pix...' : 'Continuar para o Pix'}}
              </button>
              <p class="checkout-security-note">O ingresso será emitido somente após a confirmação do pagamento.</p>
            </form>
          </div>
        </section>
      </main>
    } @else if (error()) {
      <main class="auth-page"><section class="error-panel" role="alert">{{error()}}</section></main>
    } @else {
      <main class="public-loading"><tui-loader /></main>
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
    acceptedTerms: [false, Validators.requiredTrue],
    acceptedPrivacy: [false, Validators.requiredTrue],
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

  location(current: PublicEvent): string {
    return [current.event.venueName, current.event.city, current.event.state].filter(Boolean).join(' · ') || 'Local a confirmar';
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

  subtotal(): number {
    return (this.selected()?.price ?? 0) * this.form.controls.quantity.value;
  }

  serviceFee(): number {
    return (this.selected()?.serviceFee ?? 0) * this.form.controls.quantity.value;
  }

  total(): number {
    return this.subtotal() + this.serviceFee();
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
      acceptedTerms: value.acceptedTerms,
      acceptedPrivacy: value.acceptedPrivacy,
    }).subscribe({
      next: order => this.checkout.pix(order.publicCode).subscribe({
        next: () => void this.router.navigate(['/payment', order.publicCode]),
        error: response => {
          this.error.set(apiErrorMessage(response, 'Não foi possível gerar a cobrança Pix.'));
          this.loading.set(false);
        },
      }),
      error: response => {
        this.error.set(apiErrorMessage(response, 'Não foi possível criar o pedido.'));
        this.loading.set(false);
      },
    });
  }
}
