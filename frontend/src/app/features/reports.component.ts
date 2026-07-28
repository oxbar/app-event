import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {CurrencyPipe, DecimalPipe, PercentPipe} from '@angular/common';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TuiButton, TuiIcon, TuiLoader} from '@taiga-ui/core';
import {AdminApi, EventApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {EventModel, ReportSummary} from '../core/models';
import {downloadBlob, filenameFromContentDisposition} from '../shared/file-download';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

type CsvReport = 'sales' | 'checkins';
type Workbook = 'sales' | 'checkins' | 'workbook';

/**
 * Relatórios do evento.
 *
 * A tela mostra primeiro os números — é o que a maioria quer saber — e só
 * depois oferece a exportação. O CSV continua existindo para quem processa os
 * dados em outra ferramenta; o XLSX é para quem vai abrir e ler.
 */
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    TuiButton,
    TuiIcon,
    TuiLoader,
    SelectFieldComponent,
  ],
  template: `
    <div class="page-title">
      <div>
        <h1>Relatórios</h1>
        <p>Números consolidados e exportação em CSV ou Excel.</p>
      </div>
    </div>

    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}

    <section class="panel report-toolbar">
      <div class="form-field">
        <label for="report-event">Evento</label>
        <app-select-field
          [control]="eventControl"
          [options]="eventOptions()"
          placeholder="Selecione o evento"
          ariaLabel="Evento do relatório"
          inputId="report-event"
        />
      </div>
      <button
        tuiButton
        appearance="secondary"
        type="button"
        iconStart="@tui.refresh-cw"
        [disabled]="!eventControl.value || loadingSummary()"
        (click)="loadSummary()"
      >
        Atualizar números
      </button>
    </section>

    @if (loadingSummary()) {
      <div class="report-metrics" aria-hidden="true">
        <div class="skeleton skeleton--metric"></div>
        <div class="skeleton skeleton--metric"></div>
        <div class="skeleton skeleton--metric"></div>
        <div class="skeleton skeleton--metric"></div>
      </div>
    } @else if (summary(); as data) {
      <section class="report-metrics" data-testid="report-metrics">
        <article class="report-metric">
          <small>Receita paga</small>
          <strong>{{data.totalAmount | currency: 'BRL'}}</strong>
          <span>{{data.paidOrders | number}} de {{data.totalOrders | number}} pedidos pagos</span>
        </article>
        <article class="report-metric">
          <small>Taxas de serviço</small>
          <strong>{{data.serviceFees | currency: 'BRL'}}</strong>
          <span>Descontos: {{data.discounts | currency: 'BRL'}}</span>
        </article>
        <article class="report-metric">
          <small>Ingressos emitidos</small>
          <strong>{{data.issuedTickets | number}}</strong>
          <span>{{data.usedTickets | number}} utilizados · {{data.blockedTickets | number}} bloqueados</span>
        </article>
        <article class="report-metric">
          <small>Comparecimento</small>
          <strong>{{data.attendanceRate | percent: '1.0-1'}}</strong>
          <span>{{data.approvedCheckins | number}} aprovadas · {{data.deniedCheckins | number}} negadas</span>
        </article>
      </section>

      @if (data.ticketTypes.length) {
        <section class="panel">
          <h2>Vendas por tipo de ingresso</h2>
          <div class="report-types">
            <div class="report-types__row head">
              <span>Tipo</span><span>Vendidos</span><span>Disponíveis</span><span>Receita</span>
            </div>
            @for (line of data.ticketTypes; track line.ticketTypeId) {
              <div class="report-types__row">
                <span>{{line.name}}</span>
                <b>{{line.soldQuantity | number}}</b>
                <b>{{line.availableQuantity | number}}</b>
                <b>{{line.revenue | currency: 'BRL'}}</b>
              </div>
            }
          </div>
        </section>
      }
    }

    <section class="export-grid">
      <article class="export-card">
        <span class="export-card__badge">Excel</span>
        <h3>Planilha formatada</h3>
        <p>
          Abas de resumo, vendas, ingressos e entradas — com cabeçalho fixo, filtros,
          valores em moeda e datas prontas para ordenar.
        </p>
        <div class="button-row">
          <button tuiButton type="button" [disabled]="busy()" (click)="workbook('workbook')">
            Baixar pasta completa (.xlsx)
          </button>
          <button tuiButton appearance="secondary" type="button" [disabled]="busy()" (click)="workbook('sales')">
            Planilha de vendas (.xlsx)
          </button>
          <button tuiButton appearance="secondary" type="button" [disabled]="busy()" (click)="workbook('checkins')">
            Planilha de entradas (.xlsx)
          </button>
        </div>
      </article>

      <article class="export-card">
        <span class="export-card__badge">CSV</span>
        <h3>Dados brutos</h3>
        <p>Arquivo separado por vírgulas, para importar em outra ferramenta ou script.</p>
        <div class="button-row">
          <button tuiButton appearance="secondary" type="button" [disabled]="busy()" (click)="download('sales')">
            Exportar vendas
          </button>
          <button tuiButton appearance="secondary" type="button" [disabled]="busy()" (click)="download('checkins')">
            Exportar entradas
          </button>
        </div>
      </article>
    </section>

    <p class="status-line" role="status" aria-live="polite">
      @if (busy()) {
        <tui-loader size="s" />
        <span>Gerando o arquivo…</span>
      }
      @if (!busy() && status()) {
        <tui-icon icon="@tui.check" />
        <span>{{ status() }}</span>
      }
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly eventsApi = inject(EventApi);
  private readonly admin = inject(AdminApi);

  readonly events = signal<EventModel[]>([]);
  readonly eventControl = new FormControl('', {nonNullable: true});
  readonly loading = signal(false);
  readonly loadingSummary = signal(false);
  readonly summary = signal<ReportSummary | null>(null);
  readonly error = signal('');
  readonly status = signal('');
  readonly busy = computed(() => this.loading());
  readonly eventOptions = computed<readonly SelectOption[]>(() =>
    this.events().map(event => ({value: event.id, label: event.name})),
  );

  constructor() {
    this.loading.set(true);
    this.eventsApi.list().subscribe({
      next: page => {
        this.events.set(page.content);
        this.eventControl.setValue(page.content[0]?.id ?? '', {emitEvent: false});
        this.loading.set(false);
        if (this.eventControl.value) this.loadSummary();
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos.'));
        this.loading.set(false);
      },
    });

    this.eventControl.valueChanges.subscribe(() => {
      this.summary.set(null);
      this.status.set('');
      if (this.eventControl.value) this.loadSummary();
    });
  }

  loadSummary(): void {
    const eventId = this.eventControl.value;
    if (!eventId) return;
    this.loadingSummary.set(true);
    this.error.set('');
    this.admin.reportSummary(eventId).subscribe({
      next: summary => {
        this.summary.set(summary);
        this.loadingSummary.set(false);
      },
      error: error => {
        // Os números são um apoio: falhar aqui não pode impedir a exportação.
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar os números do evento.'));
        this.loadingSummary.set(false);
      },
    });
  }

  /** Exportação CSV — mantida para quem já automatizou a leitura do arquivo. */
  download(type: CsvReport): void {
    const eventId = this.eventControl.value;
    if (!eventId || this.loading()) return;
    this.start();
    this.admin.downloadReport(eventId, type).subscribe({
      next: blob => {
        downloadBlob(blob, type === 'sales' ? 'vendas.csv' : 'entradas.csv');
        this.finish(type === 'sales' ? 'Arquivo de vendas gerado.' : 'Arquivo de entradas gerado.');
      },
      error: error => this.fail(error),
    });
  }

  workbook(type: Workbook): void {
    const eventId = this.eventControl.value;
    if (!eventId || this.loading()) return;
    this.start();
    this.admin.downloadWorkbook(eventId, type).subscribe({
      next: response => {
        const blob = response.body;
        if (!blob) {
          this.fail(null, 'A planilha voltou vazia. Tente novamente.');
          return;
        }
        const filename = filenameFromContentDisposition(
          response.headers.get('Content-Disposition'),
          `${type === 'workbook' ? 'relatorio' : type === 'sales' ? 'vendas' : 'entradas'}.xlsx`,
        );
        downloadBlob(blob, filename);
        this.finish(`Planilha ${filename} gerada.`);
      },
      error: error => this.fail(error),
    });
  }

  private start(): void {
    this.loading.set(true);
    this.error.set('');
    this.status.set('');
  }

  private finish(message: string): void {
    this.status.set(message);
    this.loading.set(false);
  }

  private fail(error: unknown, fallback = 'Não foi possível gerar o relatório.'): void {
    this.error.set(apiErrorMessage(error, fallback));
    this.loading.set(false);
  }
}
