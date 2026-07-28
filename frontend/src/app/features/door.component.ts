import {ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {BrowserQRCodeReader} from '@zxing/browser';
import {apiErrorMessage} from '../core/api-error';
import {CheckinApi, EventApi} from '../core/api.services';
import {AccessPoint, CheckinResult, EventModel} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {FormErrorComponent} from '../shared/form-error.component';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiInput, SelectFieldComponent, DisplayLabelPipe, FormErrorComponent],
  template: `
    <div class="page-title"><div><h1>Portaria</h1><p>Leitura rápida com prevenção de acesso duplicado.</p></div></div>
    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}
    <section class="door-layout">
      <div class="panel">
        <form [formGroup]="form" novalidate>
          <label for="door-event">Evento</label>
          <app-select-field
            [control]="form.controls.eventId"
            [options]="eventOptions()"
            placeholder="Selecione o evento"
            ariaLabel="Evento"
            inputId="door-event"
          />

          <label for="door-point">Portaria</label>
          <app-select-field
            [control]="form.controls.pointId"
            [options]="pointOptions()"
            placeholder="Selecione a portaria"
            ariaLabel="Portaria"
            inputId="door-point"
          />

          <video #video playsinline aria-label="Visualização da câmera para leitura do QR Code"></video>
          <div class="button-row">
            <button tuiButton type="button" (click)="start()" [disabled]="cameraActive() || !form.controls.eventId.value || !form.controls.pointId.value">Iniciar câmera</button>
            <button tuiButton appearance="secondary" type="button" (click)="stop()" [disabled]="!cameraActive()">Parar câmera</button>
          </div>

          <div class="form-field">
            <label for="door-token">Código do ingresso</label>
            <tui-textfield><input id="door-token" tuiInput autocomplete="off" placeholder="TKT-..., link do ingresso ou token do QR Code" formControlName="token" /></tui-textfield>
            <small class="form-hint">Aceita o código TKT-, o link completo do ingresso ou o conteúdo do QR Code.</small>
            <app-form-error [control]="form.controls.token" label="Código do ingresso" />
          </div>
          <button tuiButton type="button" (click)="manual()" [disabled]="submitting()">
            {{submitting() ? 'Validando...' : 'Validar manualmente'}}
          </button>
        </form>
      </div>

      @if (result(); as current) {
        <article class="scan-result" [class.approved]="current.approved" role="status" aria-live="assertive">
          <strong>{{current.approved ? 'ENTRADA LIBERADA' : 'ENTRADA NEGADA'}}</strong>
          <h2>{{current.attendeeName || 'Participante não identificado'}}</h2>
          <p>{{current.ticketType}} @if (current.wristbandLabel) {· {{current.wristbandLabel}}}</p>
          <p>{{current.message || (current.result | displayLabel)}}</p>
          @if (current.accessPoint) {<small>Portaria: {{current.accessPoint}}</small>}
        </article>
      } @else {
        <article class="panel empty">Aguardando a leitura de um ingresso.</article>
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
  readonly eventOptions = computed<readonly SelectOption[]>(() => [
    {value: '', label: 'Selecione o evento'},
    ...this.events().map(event => ({value: event.id, label: event.name})),
  ]);
  readonly pointOptions = computed<readonly SelectOption[]>(() => [
    {value: '', label: 'Selecione a portaria'},
    ...this.points().map(point => ({value: point.id, label: point.name})),
  ]);
  readonly form = this.fb.nonNullable.group({
    eventId: ['', Validators.required],
    pointId: ['', Validators.required],
    token: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.form.controls.eventId.valueChanges.subscribe(eventId => {
      this.points.set([]);
      this.form.controls.pointId.setValue('', {emitEvent: false});
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
    if (!this.video || this.cameraActive() || this.form.controls.eventId.invalid || this.form.controls.pointId.invalid) return;
    this.error.set('');
    try {
      this.cameraActive.set(true);
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined,
        this.video.nativeElement,
        result => {
          if (result) {
            this.form.controls.token.setValue(result.getText());
            this.scan(result.getText(), false);
            this.stop();
          }
        },
      );
    } catch {
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.scan(this.form.controls.token.value.trim(), true);
  }

  private scan(token: string, manual: boolean): void {
    const eventId = this.form.controls.eventId.value;
    const pointId = this.form.controls.pointId.value;
    if (!eventId || !pointId || !token || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.result.set(null);
    (manual ? this.api.manual(eventId, token, pointId) : this.api.scan(eventId, token, pointId)).subscribe({
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
