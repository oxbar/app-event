import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TuiButton, TuiIcon, TuiInput, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';
import {FormErrorComponent} from '../shared/form-error.component';
import {ThemeToggleComponent} from '../shared/theme-toggle.component';

/**
 * "Esqueci minha senha".
 *
 * A resposta do servidor é sempre a mesma, exista ou não a conta — então a tela
 * também precisa ser: qualquer diferença visual devolveria a quem tenta
 * adivinhar exatamente a informação que o backend esconde.
 *
 * Depois do envio a tela troca de estado em vez de só exibir um aviso: mostra
 * para onde o e-mail foi, quanto tempo o link vale e o que fazer se ele não
 * chegar. O reenvio fica em espera por alguns segundos para evitar o clique
 * repetido por ansiedade.
 */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiIcon, TuiInput, TuiLoader, FormErrorComponent, ThemeToggleComponent],
  template: `
    <main class="auth-page">
      <app-theme-toggle class="auth-page__theme" [showLabel]="false" appearance="flat" />
      <section class="auth-card">
        <div class="brand-mark">EA</div>

        @if (sent()) {
          <h1>Verifique seu e-mail</h1>
          <div class="auth-sent" data-testid="reset-sent">
            <span class="auth-sent__icon" aria-hidden="true"><tui-icon icon="@tui.mail-check" /></span>
            <p>Se houver uma conta para</p>
            <strong>{{submittedEmail()}}</strong>
            <p>enviamos um link para criar uma nova senha.</p>
            <p class="auth-sent__hint">
              O link vale por {{expiresInMinutes()}} minutos e só pode ser usado uma vez.
              Não encontrou? Procure na caixa de spam antes de pedir outro.
            </p>
          </div>

          <div class="button-row">
            <button
              tuiButton
              appearance="secondary"
              type="button"
              iconStart="@tui.rotate-ccw"
              [disabled]="cooldown() > 0 || loading()"
              (click)="submit()"
            >
              @if (cooldown() > 0) {
                Reenviar em {{cooldown()}}s
              } @else {
                Reenviar e-mail
              }
            </button>
            <a tuiButton appearance="flat" routerLink="/login">Voltar ao login</a>
          </div>
        } @else {
          <h1>Recuperar senha</h1>
          <p>Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-field">
              <label for="forgot-email">E-mail</label>
              <tui-textfield>
                <input
                  id="forgot-email"
                  tuiInput
                  type="email"
                  formControlName="email"
                  autocomplete="username"
                  placeholder="voce@exemplo.com"
                />
              </tui-textfield>
              <app-form-error [control]="form.controls.email" label="E-mail" />
            </div>

            @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}

            <button tuiButton type="submit" [disabled]="loading()">
              @if (loading()) {
                <tui-loader size="s" />
              } @else {
                Enviar link de recuperação
              }
            </button>
          </form>

          <a routerLink="/login">Voltar ao login</a>
        }

        @if (developmentToken()) {
          <div class="dev-token">
            <small>Token de desenvolvimento (visível apenas fora de produção)</small>
            <code>{{developmentToken()}}</code>
            <a tuiButton [routerLink]="['/reset-password']" [queryParams]="{token: developmentToken()}">
              Redefinir agora
            </a>
          </div>
        }
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');
  readonly developmentToken = signal('');
  readonly submittedEmail = signal('');
  readonly expiresInMinutes = signal(30);
  readonly cooldown = signal(0);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  submit(): void {
    if (this.loading() || this.cooldown() > 0) return;

    const emailControl = this.form.controls.email;
    const email = emailControl.value.trim().toLocaleLowerCase('pt-BR');
    if (email !== emailControl.value) {
      emailControl.setValue(email);
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.forgotPassword(email).subscribe({
      next: result => {
        this.submittedEmail.set(email);
        this.developmentToken.set(result.developmentToken ?? '');
        this.expiresInMinutes.set(result.expiresInMinutes ?? 30);
        this.sent.set(true);
        this.loading.set(false);
        this.startCooldown();
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível enviar o e-mail agora. Tente novamente.'));
        this.loading.set(false);
      },
    });
  }

  private startCooldown(seconds = 30): void {
    this.stopTimer();
    this.cooldown.set(seconds);
    this.timer = setInterval(() => {
      const remaining = this.cooldown() - 1;
      this.cooldown.set(Math.max(0, remaining));
      if (remaining <= 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
