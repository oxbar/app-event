import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {AbstractControl} from '@angular/forms';

@Component({
  selector: 'app-form-error',
  standalone: true,
  template: `
    @if (control && control.invalid && (control.dirty || control.touched)) {
      <small class="field-error" role="alert">{{message()}}</small>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormErrorComponent {
  @Input({required: true}) control: AbstractControl | null = null;
  @Input() label = 'Este campo';

  message(): string {
    const errors = this.control?.errors;
    if (!errors) return '';
    if (errors['required']) return `${this.label} é obrigatório.`;
    if (errors['email']) return 'Informe um e-mail válido.';
    if (errors['minlength']) return `${this.label} deve ter pelo menos ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return `${this.label} deve ter no máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['min']) return `${this.label} deve ser maior ou igual a ${errors['min'].min}.`;
    if (errors['max']) return `${this.label} deve ser menor ou igual a ${errors['max'].max}.`;
    if (errors['pattern']) return `${this.label} está em um formato inválido.`;
    if (errors['phone']) return 'Informe um telefone brasileiro com DDD.';
    if (errors['cpf']) return 'Informe um CPF válido.';
    if (errors['strongPassword']) return 'Use maiúscula, minúscula, número e caractere especial.';
    if (errors['passwordMismatch']) return 'As senhas não coincidem.';
    return `${this.label} está inválido.`;
  }
}
