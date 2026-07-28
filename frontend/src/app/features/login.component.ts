import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiCheckbox, TuiIcon, TuiInput, TuiLoader} from '@taiga-ui/core';
import {AuthService} from '../core/auth.service';
import {FormErrorComponent} from '../shared/form-error.component';
import {ThemeToggleComponent} from '../shared/theme-toggle.component';

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TuiButton,
    TuiIcon,
    TuiLoader,
    TuiInput,
    TuiCheckbox,
    FormErrorComponent,
    ThemeToggleComponent,
  ],
  template: `
    <main class="auth-page">
      <app-theme-toggle class="auth-page__theme" [showLabel]="false" appearance="flat" />
      <section class="auth-card">
        <div class="brand-mark">EA</div>
        <h1>Event Access</h1>
        <p>Ingressos, Pix e acesso por QR Code.</p>
        @if (sessionExpired()) {
          <div class="error-panel" role="status">Sua sessão expirou. Entre novamente para continuar.</div>
        }
        @if (passwordReset()) {
          <div class="success-panel" role="status">Senha alterada com sucesso. Entre com a nova senha.</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-field">
            <label for="login-email">E-mail</label>
            <tui-textfield><input id="login-email" tuiInput type="email" formControlName="email" autocomplete="username" /></tui-textfield>
            <app-form-error [control]="form.controls.email" label="E-mail" />
          </div>
          <div class="form-field">
            <label for="login-password">Senha</label>
            <div class="password-row">
              <tui-textfield><input id="login-password" tuiInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" /></tui-textfield>
              <button
                tuiButton
                appearance="flat"
                type="button"
                [iconStart]="showPassword() ? '@tui.eye-off' : '@tui.eye'"
                [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
                [attr.aria-pressed]="showPassword()"
                (click)="togglePassword()"
              >
                {{showPassword() ? 'Ocultar' : 'Mostrar'}}
              </button>
            </div>
            <app-form-error [control]="form.controls.password" label="Senha" />
          </div>
          <label class="checkbox-row"><input tuiCheckbox type="checkbox" formControlName="remember" /> Manter sessão neste dispositivo</label>
          @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}
          <button tuiButton type="submit" [disabled]="loading()">
            @if (loading()) {<tui-loader size="s" />} @else {<tui-icon icon="@tui.log-in" />Entrar}
          </button>
        </form>
        <a routerLink="/forgot-password">Esqueci minha senha</a>
        <small>Ambiente de demonstração: organizer@eventaccess.local / Organizer@123</small>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  private readonly route = inject(ActivatedRoute);
  readonly sessionExpired = signal(this.route.snapshot.queryParamMap.get('sessionExpired') === 'true');
  /** Confirmação vinda da tela de nova senha, para fechar o ciclo do fluxo. */
  readonly passwordReset = signal(this.route.snapshot.queryParamMap.get('passwordReset') === 'true');
  readonly form = this.fb.nonNullable.group({
    email: ['organizer@eventaccess.local', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['Organizer@123', [Validators.required, Validators.minLength(8)]],
    remember: [false],
  });

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.auth.login(value.email.trim().toLocaleLowerCase('pt-BR'), value.password, value.remember).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: error => {
        this.error.set(error.error?.message ?? 'Não foi possível entrar. Verifique o e-mail e a senha.');
        this.loading.set(false);
      },
    });
  }
}
