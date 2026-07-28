import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiIcon, TuiInput, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';
import {FormErrorComponent} from '../shared/form-error.component';
import {ThemeToggleComponent} from '../shared/theme-toggle.component';
import {passwordsMatchValidator, passwordStrength, strongPasswordValidator} from '../shared/validators';

/**
 * Definição da nova senha.
 *
 * O token chega pela URL do e-mail; quando está presente, o campo some da tela
 * — pedir que a pessoa confira um token que o sistema já tem é ruído. Quando
 * falta, o campo aparece para quem prefere colar manualmente.
 */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiIcon, TuiInput, TuiLoader, FormErrorComponent, ThemeToggleComponent],
  template: `
    <main class="auth-page">
      <app-theme-toggle class="auth-page__theme" [showLabel]="false" appearance="flat" />
      <section class="auth-card">
        <div class="brand-mark">EA</div>
        <h1>Criar nova senha</h1>
        <p>Escolha uma senha que você não use em outro serviço.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (!tokenFromLink()) {
            <div class="form-field">
              <label for="reset-token">Token recebido por e-mail</label>
              <tui-textfield><input id="reset-token" tuiInput formControlName="token" /></tui-textfield>
              <app-form-error [control]="form.controls.token" label="Token" />
            </div>
          }

          <div class="form-field">
            <label for="reset-password">Nova senha</label>
            <div class="password-row">
              <tui-textfield>
                <input
                  id="reset-password"
                  tuiInput
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="new-password"
                />
              </tui-textfield>
              <button
                tuiButton
                appearance="flat"
                type="button"
                [iconStart]="showPassword() ? '@tui.eye-off' : '@tui.eye'"
                [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
                [attr.aria-pressed]="showPassword()"
                (click)="showPassword.set(!showPassword())"
              >
                {{showPassword() ? 'Ocultar' : 'Mostrar'}}
              </button>
            </div>

            <div class="password-strength" [attr.data-level]="strength().level">
              <span class="password-strength__track">
                <span
                  class="password-strength__bar"
                  [style.inline-size.%]="strength().level * 25"
                ></span>
              </span>
              <small role="status" aria-live="polite">Força da senha: {{strength().label}}</small>
            </div>
            <ul class="password-rules">
              @for (rule of strength().rules; track rule.id) {
                <li [class.met]="rule.met">{{rule.text}}</li>
              }
            </ul>
            <app-form-error [control]="form.controls.password" label="Senha" />
          </div>

          <div class="form-field">
            <label for="reset-confirmation">Confirmar senha</label>
            <tui-textfield>
              <input
                id="reset-confirmation"
                tuiInput
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmation"
                autocomplete="new-password"
              />
            </tui-textfield>
            <app-form-error [control]="form.controls.confirmation" label="Confirmação" />
          </div>

          @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}
          @if (done()) {
            <div class="success-panel" role="status">
              <tui-icon icon="@tui.check" /> Senha alterada. Redirecionando para o login…
            </div>
          }

          <button tuiButton type="submit" [disabled]="loading() || done()">
            @if (loading()) {
              <tui-loader size="s" />
            } @else {
              Redefinir senha
            }
          </button>
        </form>

        <a routerLink="/login">Voltar ao login</a>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly tokenFromLink = signal(this.route.snapshot.queryParamMap.get('token') ?? '');

  readonly form = this.formBuilder.nonNullable.group(
    {
      token: [this.route.snapshot.queryParamMap.get('token') ?? '', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8), strongPasswordValidator]],
      confirmation: ['', [Validators.required]],
    },
    {validators: passwordsMatchValidator('password', 'confirmation')},
  );

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {initialValue: ''});
  readonly strength = computed(() => passwordStrength(this.passwordValue()));

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.loading()) return;

    const value = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');

    this.auth.resetPassword(value.token, value.password).subscribe({
      next: () => {
        this.done.set(true);
        this.loading.set(false);
        setTimeout(() => void this.router.navigate(['/login'], {queryParams: {passwordReset: 'true'}}), 1200);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Não foi possível redefinir a senha. Peça um novo link.'));
        this.loading.set(false);
      },
    });
  }
}
