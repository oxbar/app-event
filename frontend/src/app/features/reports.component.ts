import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TuiButton, TuiInput, TuiLoader} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {AdminApi, EventApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {EventModel} from '../core/models';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiInput, TuiLoader, TuiSelect],
  template: `
    <div class="page-title"><div><h1>Relatórios</h1><p>Exportações CSV de vendas e acessos.</p></div></div>
    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}
    <section class="panel">
      <label>Evento</label>
      <tui-textfield>
        <select tuiSelect [formControl]="eventControl">
          @for (event of events(); track event.id) {
            <option [value]="event.id">{{event.name}}</option>
          }
        </select>
      </tui-textfield>
      <div class="button-row">
        <button tuiButton type="button" (click)="download('sales')" [disabled]="loading() || !eventControl.value">
          Exportar vendas
        </button>
        <button tuiButton appearance="secondary" type="button" (click)="download('checkins')" [disabled]="loading() || !eventControl.value">
          Exportar check-ins
        </button>
        @if (loading()) {<tui-loader size="s" />}
      </div>
    </section>
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

  constructor() {
    this.loading.set(true);
    this.eventsApi.list().subscribe({
      next: page => {
        this.events.set(page.content);
        this.eventControl.setValue(page.content[0]?.id ?? '', {emitEvent: false});
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos.'));
        this.loading.set(false);
      },
    });
  }

  download(type: 'sales' | 'checkins'): void {
    const eventId = this.eventControl.value;
    if (!eventId || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.admin.downloadReport(eventId, type).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível gerar o relatório.'));
        this.loading.set(false);
      },
    });
  }
}
