import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {AuthService} from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiInput],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <div class="brand-mark">EA</div>
        <h1>Recuperar senha</h1>
        <p>Informe o e-mail da sua conta.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <tui-textfield><input tuiInput type="email" placeholder="E-mail" formControlName="email" /></tui-textfield>
          <button tuiButton type="submit" [disabled]="form.invalid">Gerar instruções</button>
        </form>
        @if (message()) {<div class="success-panel">{{message()}}</div>}
        @if (developmentToken()) {
          <div class="dev-token">
            <small>Token DEV</small><code>{{developmentToken()}}</code>
            <a tuiButton [routerLink]="['/reset-password']" [queryParams]="{token: developmentToken()}">Redefinir agora</a>
          </div>
        }
        <a routerLink="/login">Voltar ao login</a>
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
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe(result => {
      this.message.set(result.message);
      this.developmentToken.set(result.developmentToken ?? '');
    });
  }
}
