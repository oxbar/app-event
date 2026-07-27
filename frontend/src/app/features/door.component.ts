import {ChangeDetectionStrategy, Component, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {BrowserQRCodeReader} from '@zxing/browser';
import {CheckinApi, EventApi} from '../core/api.services';
import {apiErrorMessage} from '../core/api-error';
import {AccessPoint, CheckinResult, EventModel} from '../core/models';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiInput, TuiSelect],
  template: `
    <div class="page-title"><div><h1>Portaria</h1><p>Leitura mobile-first com prevenção de acesso duplicado.</p></div></div>
    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}
    <section class="door-layout">
      <div class="panel">
        <form [formGroup]="form">
          <label>Evento</label>
          <tui-textfield>
            <select tuiSelect formControlName="eventId">
              @for (event of events(); track event.id) {
                <option [value]="event.id">{{event.name}}</option>
              }
            </select>
          </tui-textfield>

          <label>Portaria</label>
          <tui-textfield>
            <select tuiSelect formControlName="pointId">
              @for (point of points(); track point.id) {
                <option [value]="point.id">{{point.name}}</option>
              }
            </select>
          </tui-textfield>

          <video #video playsinline></video>
          <div class="button-row">
            <button tuiButton type="button" (click)="start()" [disabled]="cameraActive()">Iniciar câmera</button>
            <button tuiButton appearance="secondary" type="button" (click)="stop()" [disabled]="!cameraActive()">Parar</button>
          </div>

          <tui-textfield><input tuiInput placeholder="Cole ou digite o código" formControlName="token" /></tui-textfield>
          <button tuiButton type="button" (click)="manual()" [disabled]="form.controls.token.invalid || submitting()">
            {{submitting() ? 'Validando...' : 'Validar manualmente'}}
          </button>
        </form>
      </div>

      @if (result(); as current) {
        <article class="scan-result" [class.approved]="current.approved">
          <strong>{{current.approved ? 'ENTRADA LIBERADA' : 'ENTRADA NEGADA'}}</strong>
          <h2>{{current.attendeeName}}</h2>
          <p>{{current.ticketType}} · {{current.wristbandLabel}}</p>
          <p>{{current.message}}</p>
        </article>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoorComponent {
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;
  private readonly eventsApi = inject(EventApi);
  private readonly api = inject(CheckinApi);
  private readonly fb = inject(FormBuilder);
  private readonly reader = new BrowserQRCodeReader();
  private controls?: {stop(): void};

  readonly events = signal<EventModel[]>([]);
  readonly points = signal<AccessPoint[]>([]);
  readonly result = signal<CheckinResult | null>(null);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly cameraActive = signal(false);
  readonly form = this.fb.nonNullable.group({
    eventId: ['', Validators.required],
    pointId: ['', Validators.required],
    token: ['', Validators.required],
  });

  constructor() {
    this.form.controls.eventId.valueChanges.subscribe(eventId => {
      if (eventId) this.loadPoints(eventId);
    });
    this.eventsApi.list(0, 100).subscribe({
      next: page => {
        this.events.set(page.content);
        this.form.controls.eventId.setValue(page.content[0]?.id ?? '');
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos da portaria.')),
    });
  }

  private loadPoints(eventId: string): void {
    this.error.set('');
    this.api.points(eventId).subscribe({
      next: points => {
        this.points.set(points);
        this.form.controls.pointId.setValue(points[0]?.id ?? '', {emitEvent: false});
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar as portarias.')),
    });
  }

  async start(): Promise<void> {
    if (!this.video || this.cameraActive()) return;
    this.error.set('');
    try {
      this.cameraActive.set(true);
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined,
        this.video.nativeElement,
        result => {
          if (result) {
            this.form.controls.token.setValue(result.getText());
            this.scan(result.getText());
            this.stop();
          }
        },
      );
    } catch (error) {
      this.cameraActive.set(false);
      this.error.set('Não foi possível acessar a câmera. Verifique a permissão do navegador.');
    }
  }

  stop(): void {
    this.controls?.stop();
    this.controls = undefined;
    this.cameraActive.set(false);
  }

  manual(): void {
    if (this.form.controls.token.invalid) return;
    this.scan(this.form.controls.token.value.trim());
  }

  private scan(token: string): void {
    const eventId = this.form.controls.eventId.value;
    const pointId = this.form.controls.pointId.value;
    if (!eventId || !pointId || !token || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.api.scan(eventId, token, pointId).subscribe({
      next: result => {
        this.result.set(result);
        this.submitting.set(false);
        this.form.controls.token.setValue('');
        if (result.approved) navigator.vibrate?.(150);
        else navigator.vibrate?.([100, 80, 100]);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível validar o ingresso.'));
        this.submitting.set(false);
      },
    });
  }
}
