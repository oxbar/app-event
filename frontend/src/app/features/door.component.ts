import {ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {TuiButton, TuiIcon, TuiInput} from '@taiga-ui/core';
import {BrowserQRCodeReader} from '@zxing/browser';
import {apiErrorMessage} from '../core/api-error';
import {CheckinApi, EventApi} from '../core/api.services';
import {AccessPoint, CheckinResult, EventModel} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {FormErrorComponent} from '../shared/form-error.component';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TuiButton, TuiIcon, TuiInput, SelectFieldComponent, DisplayLabelPipe, FormErrorComponent],
  template: `
    <div class="page-title">
      <div><h1>Portaria</h1><p>Leitura contínua com prevenção de acesso duplicado.</p></div>
      <div class="door-tally" aria-live="polite">
        <span class="door-tally__item door-tally__item--ok">
          <tui-icon icon="@tui.check" /><strong>{{approvedCount()}}</strong> liberadas
        </span>
        <span class="door-tally__item door-tally__item--deny">
          <tui-icon icon="@tui.x" /><strong>{{deniedCount()}}</strong> negadas
        </span>
      </div>
    </div>
    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}
    <section class="door-layout">
      <div class="panel">
        <form [formGroup]="form" novalidate (ngSubmit)="manual()">
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
            <button
              tuiButton
              type="button"
              iconStart="@tui.camera"
              (click)="start()"
              [disabled]="cameraActive() || !form.controls.eventId.value || !form.controls.pointId.value"
            >
              Iniciar câmera
            </button>
            <button tuiButton appearance="secondary" type="button" iconStart="@tui.camera-off" (click)="stop()" [disabled]="!cameraActive()">
              Parar câmera
            </button>
          </div>
          @if (cameraActive()) {
            <p class="camera-hint" role="status">
              <tui-icon icon="@tui.scan-line" />
              Leitura contínua ligada — aponte para o próximo ingresso sem tocar na tela.
            </p>
          }

          <div class="form-field">
            <label for="door-token">Código do ingresso</label>
            <tui-textfield><input id="door-token" tuiInput autocomplete="off" placeholder="TKT-..., link do ingresso ou token do QR Code" formControlName="token" /></tui-textfield>
            <small class="form-hint">Aceita o código TKT-, o link completo do ingresso ou o conteúdo do QR Code.</small>
            <app-form-error [control]="form.controls.token" label="Código do ingresso" />
          </div>
          <button tuiButton type="submit" iconStart="@tui.keyboard" [disabled]="submitting()">
            {{submitting() ? 'Validando...' : 'Validar manualmente'}}
          </button>
        </form>
      </div>

      @if (result(); as current) {
        <article class="scan-result" [class.approved]="current.approved" role="status" aria-live="assertive">
          <tui-icon class="scan-result__icon" [icon]="current.approved ? '@tui.circle-check-big' : '@tui.circle-x'" />
          <strong>{{current.approved ? 'ENTRADA LIBERADA' : 'ENTRADA NEGADA'}}</strong>
          <h2>{{current.attendeeName || 'Participante não identificado'}}</h2>
          <p>{{current.ticketType}}</p>

          <!-- A cor da pulseira é a ação que a portaria executa depois de liberar.
               Merece o mesmo destaque do veredito, não uma linha de texto. -->
          @if (current.approved && (current.wristbandLabel || current.wristbandColorName)) {
            <div class="scan-result__wristband">
              <span class="scan-result__swatch" [style.background]="current.wristbandColorHex || 'transparent'"></span>
              {{current.wristbandLabel || current.wristbandColorName}}
            </div>
          }

          @if (!current.approved) {
            <p class="scan-result__reason">{{current.message || (current.result | displayLabel)}}</p>
          }

          <div class="scan-result__meta">
            @if (current.checkedInAt) {
              <span><tui-icon icon="@tui.clock" />{{current.checkedInAt | date:'HH:mm:ss'}}</span>
            }
            @if (current.accessPoint) {<span>{{current.accessPoint}}</span>}
          </div>
        </article>
      } @else {
        <article class="panel empty">
          <tui-icon icon="@tui.scan-line" />
          <p>Aguardando a leitura de um ingresso.</p>
          <small>Ligue a câmera e aponte para o QR Code, ou digite o código TKT-.</small>
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly reader = new BrowserQRCodeReader();
  private controls?: {stop(): void};
  private wakeLock: {release(): Promise<void>} | null = null;
  private lastToken = '';
  private lastTokenAt = 0;
  private clearTimer?: ReturnType<typeof setTimeout>;

  readonly events = signal<EventModel[]>([]);
  readonly points = signal<AccessPoint[]>([]);
  readonly result = signal<CheckinResult | null>(null);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly cameraActive = signal(false);
  readonly approvedCount = signal(0);
  readonly deniedCount = signal(0);
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

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.clearTimer);
      this.stop();
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
          if (!result) return;
          const text = result.getText();
          const now = Date.now();
          // O zxing dispara várias vezes por segundo sobre o mesmo código.
          // Sem esta guarda, um ingresso viraria dezenas de requisições.
          if (text === this.lastToken && now - this.lastTokenAt < 3000) return;
          this.lastToken = text;
          this.lastTokenAt = now;
          this.scan(text, false);
        },
      );
      this.requestWakeLock();
    } catch {
      this.cameraActive.set(false);
      this.error.set('Não foi possível acessar a câmera. Verifique a permissão do navegador.');
    }
  }

  /** A tela apagar no meio da fila é falha de produto, não do operador. */
  private requestWakeLock(): void {
    const api = (navigator as unknown as {
      wakeLock?: {request(type: 'screen'): Promise<{release(): Promise<void>}>};
    }).wakeLock;
    api?.request('screen').then(lock => (this.wakeLock = lock)).catch(() => undefined);
  }

  /**
   * Retorno sonoro. Na porta de um evento ninguém olha a tela o tempo todo:
   * agudo curto para liberado, dois graves para negado.
   */
  private beep(approved: boolean): void {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Ctor) return;
      const context = new Ctor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = approved ? 'sine' : 'square';
      oscillator.frequency.value = approved ? 880 : 200;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (approved ? 0.18 : 0.5));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (approved ? 0.2 : 0.55));
      oscillator.onended = () => void context.close().catch(() => undefined);
    } catch {
      // Sem áudio disponível a cor e a vibração já comunicam o veredito.
    }
  }

  stop(): void {
    this.controls?.stop();
    this.controls = undefined;
    this.cameraActive.set(false);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
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
    clearTimeout(this.clearTimer);
    (manual ? this.api.manual(eventId, token, pointId) : this.api.scan(eventId, token, pointId)).subscribe({
      next: result => {
        this.result.set(result);
        this.submitting.set(false);
        this.form.controls.token.setValue('');
        if (result.approved) {
          this.approvedCount.update(value => value + 1);
          navigator.vibrate?.(150);
        } else {
          this.deniedCount.update(value => value + 1);
          navigator.vibrate?.([100, 80, 100]);
        }
        this.beep(result.approved);
        // A recusa fica mais tempo na tela: exige leitura, não só o sinal de cor.
        this.clearTimer = setTimeout(() => this.result.set(null), result.approved ? 4000 : 8000);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível validar o ingresso.'));
        this.submitting.set(false);
      },
    });
  }
}
