import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {TuiButton, TuiCheckbox, TuiLoader, TuiInput} from '@taiga-ui/core';
import {AuthService} from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiLoader, TuiInput, TuiCheckbox],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <div class="brand-mark">EA</div>
        <h1>Event Access</h1>
        <p>Ingressos, Pix e acesso por QR Code.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="login-email">E-mail</label>
          <tui-textfield><input id="login-email" tuiInput type="email" formControlName="email" autocomplete="username" /></tui-textfield>
          <label for="login-password">Senha</label>
          <div class="password-row">
            <tui-textfield><input id="login-password" tuiInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" /></tui-textfield>
            <button tuiButton appearance="flat" type="button" (click)="togglePassword()">
              {{showPassword() ? 'Ocultar' : 'Mostrar'}}
            </button>
          </div>
          <label class="checkbox-row"><input tuiCheckbox type="checkbox" formControlName="remember" /> Lembrar sessão neste dispositivo</label>
          @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}
          <button tuiButton type="submit" [disabled]="form.invalid || loading()">
            @if (loading()) {<tui-loader size="s" />} @else {Entrar}
          </button>
        </form>
        <a routerLink="/forgot-password">Esqueci minha senha</a>
        <small>Demo: organizer@eventaccess.local / Organizer@123</small>
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
  readonly form = this.fb.nonNullable.group({
    email: ['organizer@eventaccess.local', [Validators.required, Validators.email]],
    password: ['Organizer@123', Validators.required],
    remember: [false],
  });

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.auth.login(value.email, value.password, value.remember).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: error => {
        this.error.set(error.error?.message ?? 'Não foi possível entrar.');
        this.loading.set(false);
      },
    });
  }
}
