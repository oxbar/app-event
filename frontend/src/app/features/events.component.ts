import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiCheckbox, TuiInput, TuiLoader} from '@taiga-ui/core';
import {TuiInputColor, TuiPagination} from '@taiga-ui/kit';
import {apiErrorCode, apiErrorMessage} from '../core/api-error';
import {EventApi} from '../core/api.services';
import {EventModel, TicketType} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {FormErrorComponent} from '../shared/form-error.component';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';
import {dateRangeValidator} from '../shared/validators';

@Component({
  standalone: true,
  imports: [
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    TuiButton,
    TuiCheckbox,
    TuiInput,
    TuiLoader,
    TuiPagination,
    TuiInputColor,
    SelectFieldComponent,
    DisplayLabelPipe,
    FormErrorComponent,
  ],
  template: `
    <div class="page-title">
      <div><h1>Eventos</h1><p>Crie eventos, publique vendas e configure categorias.</p></div>
      <button tuiButton type="button" (click)="toggleForm()">
        {{showForm() ? 'Fechar cadastro' : 'Novo evento'}}
      </button>
    </div>

    @if (error()) {
      <section class="error-panel" role="alert">
        <p>{{error()}}</p>
        <button tuiButton type="button" (click)="load()">Tentar novamente</button>
      </section>
    }
    @if (success()) {
      <section class="success-panel" role="status">{{success()}}</section>
    }

    @if (showForm()) {
      <section class="panel">
        <h2>Novo evento</h2>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="create()" novalidate>
          <div class="form-field">
            <label for="event-name">Nome do evento</label>
            <tui-textfield><input id="event-name" tuiInput placeholder="Ex.: Festa de Verão" formControlName="name" /></tui-textfield>
            <app-form-error [control]="form.controls.name" label="Nome do evento" />
          </div>
          <div class="form-field">
            <label for="event-venue">Local</label>
            <tui-textfield><input id="event-venue" tuiInput placeholder="Ex.: Centro de Eventos" formControlName="venueName" /></tui-textfield>
            <app-form-error [control]="form.controls.venueName" label="Local" />
          </div>
          <div class="form-field">
            <label for="event-start">Início</label>
            <tui-textfield><input id="event-start" tuiInput type="datetime-local" formControlName="startsAt" /></tui-textfield>
            <app-form-error [control]="form.controls.startsAt" label="Data de início" />
          </div>
          <div class="form-field">
            <label for="event-end">Término</label>
            <tui-textfield><input id="event-end" tuiInput type="datetime-local" formControlName="endsAt" /></tui-textfield>
            <app-form-error [control]="form.controls.endsAt" label="Data de término" />
          </div>
          <div class="form-field">
            <label for="event-capacity">Capacidade</label>
            <tui-textfield>
              <input id="event-capacity" tuiInput type="number" inputmode="numeric" min="1" max="1000000" step="1" formControlName="capacity" />
            </tui-textfield>
            <app-form-error [control]="form.controls.capacity" label="Capacidade" />
          </div>
          <label class="checkbox-row">
            <input tuiCheckbox type="checkbox" formControlName="requireDocument" />
            Exigir CPF no checkout
          </label>
          @if (form.hasError('dateRange') && (form.controls.startsAt.touched || form.controls.endsAt.touched)) {
            <p class="form-error-summary" role="alert">A data de término deve ser posterior à data de início.</p>
          }
          <button tuiButton type="submit" [disabled]="saving()">
            {{saving() ? 'Criando...' : 'Criar evento'}}
          </button>
        </form>
      </section>
    }

    @if (loading()) {
      <tui-loader />
    } @else {
      <section class="card-list">
        @for (event of events(); track event.id) {
          <article class="event-card">
            <div>
              <span class="status">{{event.status | displayLabel}}</span>
              <h2>{{event.name}}</h2>
              <p>{{event.venueName || 'Local não informado'}} @if (event.city) {· {{event.city}}/{{event.state}}}</p>
              <small>{{event.startsAt | date:'dd/MM/yyyy HH:mm'}}</small>
            </div>
            <div class="button-row">
              <button tuiButton appearance="secondary" type="button" (click)="manage(event)">Configurar ingressos</button>
              @if (event.status === 'DRAFT') {
                <button tuiButton type="button" [disabled]="publishingId() === event.id" (click)="publish(event)">
                  {{publishingId() === event.id ? 'Publicando...' : 'Publicar'}}
                </button>
              }
              <a tuiButton appearance="flat" [href]="'/e/' + event.slug" target="_blank" rel="noopener">Abrir checkout</a>
            </div>
          </article>
        } @empty {
          <div class="empty">Nenhum evento encontrado. Crie seu primeiro evento para começar.</div>
        }
      </section>
    }

    @if (totalPages() > 1) {
      <tui-pagination [index]="pageIndex" [length]="totalPages()" (indexChange)="changePage($event)" />
    }

    @if (selected(); as event) {
      <section class="panel ticket-config-panel">
        <div class="page-title">
          <div><h2>Ingressos de {{event.name}}</h2><p>Configure categoria, valores, estoque e pulseira.</p></div>
          <button tuiButton appearance="flat" type="button" (click)="selected.set(null)">Fechar</button>
        </div>
        <div class="ticket-type-grid">
          @for (type of types(); track type.id) {
            <article class="ticket-type-card">
              <span class="wristband-dot" [style.background]="type.wristbandColorHex"></span>
              <div>
                <strong>{{type.name}} · {{type.category | displayLabel}}</strong>
                <small>{{type.wristbandLabel}} · {{type.availableQuantity}} disponíveis · {{type.status | displayLabel}}</small>
              </div>
              <b>{{type.price + type.serviceFee | currency:'BRL'}}</b>
            </article>
          } @empty {
            <div class="empty">Nenhum tipo de ingresso cadastrado.</div>
          }
        </div>
        <form class="form-grid" [formGroup]="ticketForm" (ngSubmit)="createType()" novalidate>
          <div class="form-field">
            <label for="ticket-name">Nome</label>
            <tui-textfield><input id="ticket-name" tuiInput placeholder="Ex.: Premium" formControlName="name" /></tui-textfield>
            <app-form-error [control]="ticketForm.controls.name" label="Nome do ingresso" />
          </div>
          <div class="form-field">
            <label for="ticket-category">Categoria</label>
            <app-select-field
              [control]="ticketForm.controls.category"
              [options]="categoryOptions"
              placeholder="Selecione a categoria"
              ariaLabel="Categoria do ingresso"
              inputId="ticket-category"
            />
            <app-form-error [control]="ticketForm.controls.category" label="Categoria" />
            <p class="form-hint">A categoria define um padrão inicial de nome e pulseira, que pode ser personalizado.</p>
          </div>
          <div class="form-field">
            <label for="ticket-price">Preço</label>
            <tui-textfield><input id="ticket-price" tuiInput type="number" inputmode="decimal" min="0" step="0.01" formControlName="price" /></tui-textfield>
            <app-form-error [control]="ticketForm.controls.price" label="Preço" />
          </div>
          <div class="form-field">
            <label for="ticket-fee">Taxa de serviço</label>
            <tui-textfield><input id="ticket-fee" tuiInput type="number" inputmode="decimal" min="0" step="0.01" formControlName="serviceFee" /></tui-textfield>
            <app-form-error [control]="ticketForm.controls.serviceFee" label="Taxa de serviço" />
          </div>
          <div class="form-field">
            <label for="ticket-quantity">Quantidade total</label>
            <tui-textfield><input id="ticket-quantity" tuiInput type="number" inputmode="numeric" min="1" step="1" formControlName="totalQuantity" /></tui-textfield>
            <app-form-error [control]="ticketForm.controls.totalQuantity" label="Quantidade" />
          </div>
          <div class="form-field">
            <label for="ticket-max">Máximo por pedido</label>
            <tui-textfield><input id="ticket-max" tuiInput type="number" inputmode="numeric" min="1" step="1" formControlName="maxPerOrder" /></tui-textfield>
            <app-form-error [control]="ticketForm.controls.maxPerOrder" label="Máximo por pedido" />
          </div>
          <div class="form-field">
            <label for="wristband-label">Identificação da pulseira</label>
            <tui-textfield><input id="wristband-label" tuiInput placeholder="Ex.: Pulseira preta" formControlName="wristbandLabel" /></tui-textfield>
          </div>
          <div class="form-field">
            <label for="wristband-color-name">Nome da cor</label>
            <tui-textfield><input id="wristband-color-name" tuiInput placeholder="Ex.: Preta" formControlName="wristbandColorName" /></tui-textfield>
          </div>
          <div class="form-field">
            <label for="wristband-color">Cor da pulseira</label>
            <tui-textfield iconStart=" ">
              <input
                id="wristband-color"
                tuiInputColor
                list="wristband-colors"
                placeholder="#000000"
                formControlName="wristbandColorHex"
              />
            </tui-textfield>
            <datalist id="wristband-colors">
              @for (color of suggestedColors; track color) {<option [value]="color"></option>}
            </datalist>
            <div class="color-preview-row">
              <span class="color-preview" [style.background]="ticketForm.controls.wristbandColorHex.value"></span>
              <small>{{ticketForm.controls.wristbandColorHex.value}} · prévia da pulseira</small>
            </div>
            <app-form-error [control]="ticketForm.controls.wristbandColorHex" label="Cor da pulseira" />
          </div>
          <button tuiButton type="submit" [disabled]="saving()">
            {{saving() ? 'Salvando...' : 'Adicionar ingresso'}}
          </button>
        </form>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsComponent {
  private readonly api = inject(EventApi);
  private readonly fb = inject(FormBuilder);
  readonly showForm = signal(false);
  readonly events = signal<EventModel[]>([]);
  readonly selected = signal<EventModel | null>(null);
  readonly types = signal<TicketType[]>([]);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly publishingId = signal('');
  pageIndex = 0;

  readonly categoryOptions: readonly SelectOption[] = [
    {value: 'COMMON', label: 'Comum'},
    {value: 'PREMIUM', label: 'Premium'},
    {value: 'VIP', label: 'VIP'},
    {value: 'CABIN', label: 'Camarote'},
    {value: 'BACKSTAGE', label: 'Backstage'},
    {value: 'COURTESY', label: 'Cortesia'},
  ];

  readonly suggestedColors = ['#FFFFFF', '#111111', '#D4AF37', '#7C3AED', '#DC2626', '#2563EB'];

  private readonly categoryPresets: Record<string, {name: string; wristbandLabel: string; wristbandColorName: string; wristbandColorHex: string}> = {
    COMMON: {name: 'Comum', wristbandLabel: 'Pulseira branca', wristbandColorName: 'Branca', wristbandColorHex: '#FFFFFF'},
    PREMIUM: {name: 'Premium', wristbandLabel: 'Pulseira preta', wristbandColorName: 'Preta', wristbandColorHex: '#111111'},
    VIP: {name: 'VIP', wristbandLabel: 'Pulseira dourada', wristbandColorName: 'Dourada', wristbandColorHex: '#D4AF37'},
    CABIN: {name: 'Camarote', wristbandLabel: 'Pulseira roxa', wristbandColorName: 'Roxa', wristbandColorHex: '#7C3AED'},
    BACKSTAGE: {name: 'Backstage', wristbandLabel: 'Pulseira vermelha', wristbandColorName: 'Vermelha', wristbandColorHex: '#DC2626'},
    COURTESY: {name: 'Cortesia', wristbandLabel: 'Pulseira azul', wristbandColorName: 'Azul', wristbandColorHex: '#2563EB'},
  };

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    venueName: ['', [Validators.maxLength(200)]],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    capacity: [600, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    requireDocument: [false],
  }, {validators: dateRangeValidator('startsAt', 'endsAt')});

  readonly ticketForm = this.fb.nonNullable.group({
    name: ['Comum', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    category: ['COMMON', Validators.required],
    price: [50, [Validators.required, Validators.min(0)]],
    serviceFee: [5, [Validators.required, Validators.min(0)]],
    totalQuantity: [500, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    maxPerOrder: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
    wristbandLabel: ['Pulseira branca', Validators.maxLength(100)],
    wristbandColorName: ['Branca', Validators.maxLength(50)],
    wristbandColorHex: ['#FFFFFF', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    sortOrder: [1],
  });

  constructor() {
    this.ticketForm.controls.category.valueChanges.subscribe(category => this.applyCategoryPreset(category));
    this.load();
  }

  load(pageIndex = this.pageIndex): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list(pageIndex).subscribe({
      next: page => {
        this.pageIndex = page.number;
        this.events.set(page.content);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
      },
      error: error => {
        this.events.set([]);
        this.totalPages.set(0);
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos.'));
        this.loading.set(false);
      },
    });
  }

  toggleForm(): void {
    this.showForm.update(value => !value);
  }

  changePage(pageIndex: number): void {
    this.load(pageIndex);
  }

  create(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api.create({
      ...value,
      startsAt: new Date(value.startsAt).toISOString(),
      endsAt: new Date(value.endsAt).toISOString(),
      country: 'Brasil',
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset({name: '', venueName: '', startsAt: '', endsAt: '', capacity: 600, requireDocument: false});
        this.load();
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível criar o evento.'));
        this.saving.set(false);
      },
    });
  }

  manage(event: EventModel): void {
    this.selected.set(event);
    this.error.set('');
    this.success.set('');
    this.api.types(event.id).subscribe({
      next: types => this.types.set(types),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os tipos de ingresso.')),
    });
  }

  createType(): void {
    const event = this.selected();
    if (!event || this.ticketForm.invalid || this.saving()) {
      this.ticketForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.createType(event.id, this.ticketForm.getRawValue()).subscribe({
      next: () => {
        this.api.types(event.id).subscribe({
          next: types => {
            this.types.set(types);
            this.saving.set(false);
            this.success.set('Ingresso cadastrado com sucesso. O evento já pode ser publicado.');
            const category = this.ticketForm.controls.category.value;
            this.ticketForm.reset({
              category,
              price: 50,
              serviceFee: 5,
              totalQuantity: 500,
              maxPerOrder: 5,
              sortOrder: types.length + 1,
              ...this.categoryPresets[category],
            });
          },
          error: error => {
            this.error.set(apiErrorMessage(error, 'O ingresso foi criado, mas a lista não pôde ser atualizada.'));
            this.saving.set(false);
          },
        });
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível criar o tipo de ingresso.'));
        this.saving.set(false);
      },
    });
  }

  private applyCategoryPreset(category: string): void {
    const preset = this.categoryPresets[category];
    if (!preset) return;

    const controls = this.ticketForm.controls;
    if (controls.name.pristine) controls.name.setValue(preset.name);
    if (controls.wristbandLabel.pristine) controls.wristbandLabel.setValue(preset.wristbandLabel);
    if (controls.wristbandColorName.pristine) controls.wristbandColorName.setValue(preset.wristbandColorName);
    if (controls.wristbandColorHex.pristine) controls.wristbandColorHex.setValue(preset.wristbandColorHex);
  }

  publish(event: EventModel): void {
    if (this.publishingId()) return;

    this.error.set('');
    this.success.set('');
    this.publishingId.set(event.id);
    this.api.publish(event.id).subscribe({
      next: () => {
        this.publishingId.set('');
        this.success.set(`Evento “${event.name}” publicado. O checkout está disponível.`);
        this.load();
      },
      error: error => {
        this.publishingId.set('');
        const message = apiErrorMessage(error, 'Não foi possível publicar o evento.');
        if (apiErrorCode(error) === 'TICKET_TYPE_REQUIRED') {
          this.manage(event);
          this.error.set(message);
          queueMicrotask(() => document.querySelector('.ticket-config-panel')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
          return;
        }
        this.error.set(message);
      },
    });
  }
}
