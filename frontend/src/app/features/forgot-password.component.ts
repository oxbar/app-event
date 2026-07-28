import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TuiButton, TuiIcon, TuiInput, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiIcon, TuiInput, TuiLoader],
  template: `
    <main class="auth-page">
      <section class="auth-card auth-card--wide" aria-labelledby="forgot-title">
        <div class="auth-card__header">
          <div class="brand-mark">EA</div>
          <h1 id="forgot-title">Esqueci minha senha</h1>
          <p>Digite o e-mail da sua conta. Enviaremos um link seguro, válido por 30 minutos.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="forgot-email">E-mail</label>
          <tui-textfield>
            <input
              id="forgot-email"
              tuiInput
              type="email"
              autocomplete="email"
              placeholder="nome@empresa.com"
              formControlName="email"
            />
          </tui-textfield>
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <small class="field-error">Informe um e-mail válido.</small>
          }

          @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}

          <button tuiButton type="submit" [disabled]="form.invalid || loading()">
            @if (loading()) {<tui-loader size="s" />} @else {<tui-icon icon="@tui.mail" />}
            Enviar instruções
          </button>
        </form>

        @if (message()) {
          <div class="success-panel email-sent" role="status">
            <tui-icon icon="@tui.circle-check" />
            <div>
              <strong>Verifique sua caixa de entrada</strong><br />
              <span>{{message()}}</span>
            </div>
          </div>
          <p class="auth-meta">Confira também as pastas de spam e promoções. Por segurança, a mensagem é a mesma para contas existentes ou não.</p>
        }

        @if (developmentToken()) {
          <div class="dev-token">
            <small>Ambiente de desenvolvimento — token temporário</small>
            <code data-testid="development-token">{{developmentToken()}}</code>
            <a tuiButton [routerLink]="['/reset-password']" [queryParams]="{token: developmentToken()}">Redefinir agora</a>
          </div>
        }

        <a class="auth-link" routerLink="/login"><tui-icon icon="@tui.arrow-left" /> Voltar ao login</a>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  readonly message = signal('');
  readonly developmentToken = signal('');
  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.developmentToken.set('');
    this.auth.forgotPassword(this.form.getRawValue().email.trim()).subscribe({
      next: result => {
        this.message.set(result.message);
        this.developmentToken.set(result.developmentToken ?? '');
        this.loading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível solicitar a recuperação agora. Tente novamente.'));
        this.loading.set(false);
      },
    });
  }
}
