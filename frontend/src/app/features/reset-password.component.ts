import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiIcon, TuiInput, TuiLoader} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {AuthService} from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiIcon, TuiInput, TuiLoader],
  template: `
    <main class="auth-page">
      <section class="auth-card auth-card--wide" aria-labelledby="reset-title">
        <div class="auth-card__header">
          <div class="brand-mark">EA</div>
          <h1 id="reset-title">Crie uma nova senha</h1>
          <p>Use pelo menos 8 caracteres. O link só pode ser utilizado uma vez.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="reset-token">Token de recuperação</label>
          <tui-textfield>
            <input id="reset-token" tuiInput autocomplete="off" placeholder="Token recebido por e-mail" formControlName="token" />
          </tui-textfield>

          <label for="reset-password">Nova senha</label>
          <tui-textfield>
            <input id="reset-password" tuiInput type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres" formControlName="password" />
          </tui-textfield>

          <label for="reset-confirmation">Confirmar nova senha</label>
          <tui-textfield>
            <input id="reset-confirmation" tuiInput type="password" autocomplete="new-password" placeholder="Repita a nova senha" formControlName="confirmation" />
          </tui-textfield>

          @if (error()) {<div class="error-panel" role="alert">{{error()}}</div>}
          <button tuiButton type="submit" [disabled]="form.invalid || loading()">
            @if (loading()) {<tui-loader size="s" />} @else {<tui-icon icon="@tui.key-round" />}
            Redefinir senha
          </button>
        </form>

        <a class="auth-link" routerLink="/login"><tui-icon icon="@tui.arrow-left" /> Voltar ao login</a>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.formBuilder.nonNullable.group({
    token: [inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmation: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || this.loading()) return;
    if (value.password !== value.confirmation) {
      this.error.set('As senhas não coincidem.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.resetPassword(value.token.trim(), value.password).subscribe({
      next: () => void this.router.navigate(['/login'], {queryParams: {passwordReset: 'success'}}),
      error: response => {
        this.error.set(apiErrorMessage(response, 'Não foi possível redefinir a senha. Solicite um novo link.'));
        this.loading.set(false);
      },
    });
  }
}
