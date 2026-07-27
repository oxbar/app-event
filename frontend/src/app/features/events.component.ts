import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiInput, TuiLoader} from '@taiga-ui/core';
import {TuiPagination} from '@taiga-ui/kit';
import {EventApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {EventModel, TicketType} from '../core/models';

@Component({
  standalone: true,
  imports: [DatePipe, CurrencyPipe, ReactiveFormsModule, TuiButton, TuiInput, TuiLoader, TuiPagination],
  template: `
    <div class="page-title">
      <div><h1>Eventos</h1><p>Crie eventos, publique vendas e configure categorias.</p></div>
      <button tuiButton type="button" (click)="toggleForm()">Novo evento</button>
    </div>

    @if (error()) {
      <section class="error-panel" role="alert">
        <p>{{error()}}</p>
        <button tuiButton type="button" (click)="load()">Tentar novamente</button>
      </section>
    }

    @if (showForm()) {
      <section class="panel">
        <h2>Novo evento</h2>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="create()">
          <tui-textfield><input tuiInput placeholder="Nome do evento" formControlName="name" /></tui-textfield>
          <tui-textfield><input tuiInput placeholder="Local" formControlName="venueName" /></tui-textfield>
          <tui-textfield><input tuiInput type="datetime-local" formControlName="startsAt" /></tui-textfield>
          <tui-textfield><input tuiInput type="datetime-local" formControlName="endsAt" /></tui-textfield>
          <tui-textfield><input tuiInput type="number" placeholder="Capacidade" formControlName="capacity" /></tui-textfield>
          <button tuiButton type="submit" [disabled]="form.invalid || saving()">
            {{saving() ? 'Criando...' : 'Criar'}}
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
              <span class="status">{{event.status}}</span>
              <h2>{{event.name}}</h2>
              <p>{{event.venueName}} · {{event.city}}/{{event.state}}</p>
              <small>{{event.startsAt | date:'dd/MM/yyyy HH:mm'}}</small>
            </div>
            <div class="button-row">
              <button tuiButton appearance="secondary" type="button" (click)="manage(event)">Ingressos</button>
              @if (event.status === 'DRAFT') {
                <button tuiButton type="button" (click)="publish(event.id)">Publicar</button>
              }
              <a tuiButton appearance="flat" [href]="'/e/' + event.slug" target="_blank">Checkout</a>
            </div>
          </article>
        } @empty {
          <div class="empty">Nenhum evento encontrado.</div>
        }
      </section>
    }

    @if (totalPages() > 1) {
      <tui-pagination [index]="pageIndex" [length]="totalPages()" (indexChange)="changePage($event)" />
    }

    @if (selected(); as event) {
      <section class="panel">
        <div class="page-title">
          <div><h2>Ingressos de {{event.name}}</h2><p>Comum, premium e outras categorias.</p></div>
          <button tuiButton appearance="flat" type="button" (click)="selected.set(null)">Fechar</button>
        </div>
        <div class="ticket-type-grid">
          @for (type of types(); track type.id) {
            <article class="ticket-type-card">
              <span class="wristband-dot" [style.background]="type.wristbandColorHex"></span>
              <div>
                <strong>{{type.name}}</strong>
                <small>{{type.wristbandLabel}} · {{type.availableQuantity}} disponíveis</small>
              </div>
              <b>{{type.price + type.serviceFee | currency:'BRL'}}</b>
            </article>
          } @empty {
            <div class="empty">Nenhum tipo de ingresso cadastrado.</div>
          }
        </div>
        <form class="form-grid" [formGroup]="ticketForm" (ngSubmit)="createType()">
          <tui-textfield><input tuiInput placeholder="Nome: Comum ou Premium" formControlName="name" /></tui-textfield>
          <tui-textfield><input tuiInput placeholder="Categoria" formControlName="category" /></tui-textfield>
          <tui-textfield><input tuiInput type="number" placeholder="Preço" formControlName="price" /></tui-textfield>
          <tui-textfield><input tuiInput type="number" placeholder="Taxa" formControlName="serviceFee" /></tui-textfield>
          <tui-textfield><input tuiInput type="number" placeholder="Quantidade" formControlName="totalQuantity" /></tui-textfield>
          <tui-textfield><input tuiInput type="number" placeholder="Máximo por pedido" formControlName="maxPerOrder" /></tui-textfield>
          <tui-textfield><input tuiInput placeholder="Nome da pulseira" formControlName="wristbandLabel" /></tui-textfield>
          <tui-textfield><input tuiInput placeholder="#FFFFFF" formControlName="wristbandColorHex" /></tui-textfield>
          <button tuiButton type="submit" [disabled]="ticketForm.invalid || saving()">
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
  pageIndex = 0;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    venueName: [''],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    capacity: [600, [Validators.required, Validators.min(1)]],
  });

  readonly ticketForm = this.fb.nonNullable.group({
    name: ['Comum', Validators.required],
    category: ['COMMON', Validators.required],
    price: [50, [Validators.required, Validators.min(0)]],
    serviceFee: [5, [Validators.required, Validators.min(0)]],
    totalQuantity: [500, [Validators.required, Validators.min(1)]],
    maxPerOrder: [5, [Validators.required, Validators.min(1)]],
    wristbandLabel: ['Pulseira Branca'],
    wristbandColorName: ['Branca'],
    wristbandColorHex: ['#FFFFFF', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    sortOrder: [1],
  });

  constructor() {
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
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api.create({
      ...value,
      startsAt: new Date(value.startsAt).toISOString(),
      endsAt: new Date(value.endsAt).toISOString(),
      country: 'Brasil',
      requireDocument: false,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset({name: '', venueName: '', startsAt: '', endsAt: '', capacity: 600});
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
    this.api.types(event.id).subscribe({
      next: types => this.types.set(types),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os tipos de ingresso.')),
    });
  }

  createType(): void {
    const event = this.selected();
    if (!event || this.ticketForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.createType(event.id, this.ticketForm.getRawValue()).subscribe({
      next: () => {
        this.api.types(event.id).subscribe({
          next: types => {
            this.types.set(types);
            this.saving.set(false);
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

  publish(id: string): void {
    this.error.set('');
    this.api.publish(id).subscribe({
      next: () => this.load(),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível publicar o evento.')),
    });
  }
}
