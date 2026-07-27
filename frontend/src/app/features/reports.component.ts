import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {AdminApi, EventApi} from '../core/api.services';
import {EventModel} from '../core/models';

@Component({
  standalone: true,
  imports: [TuiButton, TuiInput, TuiSelect],
  template: `
    <div class="page-title"><div><h1>Relatórios</h1><p>Exportações CSV de vendas e acessos.</p></div></div>
    <section class="panel">
      <label>Evento</label>
      <tui-textfield>
        <select tuiSelect (change)="eventId.set($any($event.target).value)">
          @for (event of events(); track event.id) {
            <option [value]="event.id">{{event.name}}</option>
          }
        </select>
      </tui-textfield>
      <div class="button-row">
        <button tuiButton type="button" (click)="download('sales')">Exportar vendas</button>
        <button tuiButton appearance="secondary" type="button" (click)="download('checkins')">Exportar check-ins</button>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly eventsApi = inject(EventApi);
  private readonly admin = inject(AdminApi);
  readonly events = signal<EventModel[]>([]);
  readonly eventId = signal('');

  constructor() {
    this.eventsApi.list().subscribe(page => {
      this.events.set(page.content);
      this.eventId.set(page.content[0]?.id ?? '');
    });
  }

  download(type: 'sales' | 'checkins'): void {
    if (!this.eventId()) return;
    this.admin.downloadReport(this.eventId(), type).subscribe(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${type}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }
}
