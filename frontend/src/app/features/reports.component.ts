import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {toSignal} from '@angular/core/rxjs-interop';
import {TuiButton, TuiIcon, TuiLoader} from '@taiga-ui/core';
import {AdminApi, EventApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {EventModel} from '../core/models';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

type ReportKind = 'sales' | 'checkins';
type ReportFormat = 'csv' | 'xlsx';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiIcon, TuiLoader, SelectFieldComponent],
  template: `
    <div class="page-title">
      <div>
        <h1>Relatórios</h1>
        <p>Exporte vendas e entradas em CSV ou Excel, prontos para análise e prestação de contas.</p>
      </div>
    </div>

    <div class="report-shell">
      @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}
      @if (success()) {<section class="success-panel report-feedback" role="status">{{success()}}</section>}

      <section class="panel report-toolbar" aria-label="Configuração do relatório">
        <div class="report-event-field">
          <label for="report-event">Evento</label>
          <app-select-field
            [control]="eventControl"
            [options]="eventOptions()"
            placeholder="Selecione o evento"
            ariaLabel="Evento do relatório"
            inputId="report-event"
          />
        </div>
        <div class="report-event-summary">
          @if (selectedEvent()) {
            <strong>{{selectedEvent()?.name}}</strong><br />
            <span>Os arquivos incluem somente os dados deste evento.</span>
          } @else if (!loading()) {
            <span>Nenhum evento disponível.</span>
          }
        </div>
      </section>

      <section class="report-grid" aria-label="Formatos de exportação">
        <article class="report-card">
          <div class="report-card__icon"><tui-icon icon="@tui.badge-dollar-sign" /></div>
          <div class="report-card__body">
            <h2>Vendas e pagamentos</h2>
            <p>Pedidos, compradores, status, subtotal, taxa, valor total e data de pagamento.</p>
            <div class="report-actions">
              <button tuiButton type="button" (click)="download('sales', 'csv')" [disabled]="isDisabled()">
                Exportar vendas CSV
              </button>
              <button tuiButton appearance="secondary" type="button" (click)="download('sales', 'xlsx')" [disabled]="isDisabled()">
                Exportar vendas Excel
              </button>
            </div>
          </div>
        </article>

        <article class="report-card">
          <div class="report-card__icon"><tui-icon icon="@tui.scan-line" /></div>
          <div class="report-card__body">
            <h2>Entradas e check-ins</h2>
            <p>Resultado da leitura, participante, ingresso, portaria, funcionário, horário e motivo.</p>
            <div class="report-actions">
              <button tuiButton type="button" (click)="download('checkins', 'csv')" [disabled]="isDisabled()">
                Exportar entradas CSV
              </button>
              <button tuiButton appearance="secondary" type="button" (click)="download('checkins', 'xlsx')" [disabled]="isDisabled()">
                Exportar entradas Excel
              </button>
            </div>
          </div>
        </article>
      </section>

      @if (loading()) {
        <div class="button-row" role="status" aria-live="polite">
          <tui-loader size="s" /> <span>Preparando arquivo...</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly eventsApi = inject(EventApi);
  private readonly admin = inject(AdminApi);
  readonly events = signal<EventModel[]>([]);
  readonly eventControl = new FormControl('', {nonNullable: true});
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly selectedEventId = toSignal(this.eventControl.valueChanges, {initialValue: this.eventControl.value});
  readonly eventOptions = computed<readonly SelectOption[]>(() =>
    this.events().map(event => ({value: event.id, label: event.name})),
  );
  readonly selectedEvent = computed(() =>
    this.events().find(event => event.id === this.selectedEventId()) ?? null,
  );

  constructor() {
    this.loading.set(true);
    this.eventsApi.list().subscribe({
      next: page => {
        this.events.set(page.content);
        this.eventControl.setValue(page.content[0]?.id ?? '');
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos.'));
        this.loading.set(false);
      },
    });
  }

  isDisabled(): boolean {
    return this.loading() || !this.eventControl.value;
  }

  download(type: ReportKind, format: ReportFormat): void {
    const eventId = this.eventControl.value;
    if (!eventId || this.loading()) return;

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.admin.downloadReport(eventId, type, format).subscribe({
      next: blob => {
        this.save(blob, this.filename(type, format));
        this.success.set(`${format === 'xlsx' ? 'Planilha Excel' : 'Arquivo CSV'} gerado com sucesso.`);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível gerar o relatório.'));
        this.loading.set(false);
      },
    });
  }

  private filename(type: ReportKind, format: ReportFormat): string {
    const event = this.selectedEvent()?.name ?? 'evento';
    const safeEvent = event
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const name = type === 'sales' ? 'vendas' : 'entradas';
    return `${name}-${safeEvent || 'evento'}.${format}`;
  }

  private save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
