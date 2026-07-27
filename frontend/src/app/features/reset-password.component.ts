import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {AuthService} from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiInput],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <div class="brand-mark">EA</div>
        <h1>Nova senha</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <tui-textfield><input tuiInput placeholder="Token" formControlName="token" /></tui-textfield>
          <tui-textfield><input tuiInput type="password" placeholder="Nova senha" formControlName="password" /></tui-textfield>
          <tui-textfield><input tuiInput type="password" placeholder="Confirmar senha" formControlName="confirmation" /></tui-textfield>
          @if (error()) {<div class="error-panel">{{error()}}</div>}
          <button tuiButton type="submit" [disabled]="form.invalid">Redefinir senha</button>
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
  readonly error = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    token: [inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid) return;
    if (value.password !== value.confirmation) {
      this.error.set('As senhas não coincidem.');
      return;
    }
    this.auth.resetPassword(value.token, value.password).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: response => this.error.set(response.error?.message ?? 'Não foi possível redefinir a senha.'),
    });
  }
}
