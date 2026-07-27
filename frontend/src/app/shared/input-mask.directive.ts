import {Directive, ElementRef, HostListener, inject, Input} from '@angular/core';
import {NgControl} from '@angular/forms';

type InputMask = 'phone' | 'cpf' | 'cpfCnpj' | 'cep' | 'integer';

@Directive({
  selector: 'input[appInputMask]',
  standalone: true,
})
export class InputMaskDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, {optional: true, self: true});

  @Input({required: true}) appInputMask!: InputMask;

  @HostListener('input')
  onInput(): void {
    const input = this.element.nativeElement;
    const formatted = this.format(input.value);
    if (input.value === formatted) return;

    input.value = formatted;
    this.ngControl?.control?.setValue(formatted, {emitEvent: false});
  }

  private format(value: string): string {
    const digits = value.replace(/\D/g, '');
    switch (this.appInputMask) {
      case 'phone':
        return this.phone(digits.slice(0, 11));
      case 'cpf':
        return this.cpf(digits.slice(0, 11));
      case 'cpfCnpj':
        return digits.length <= 11
          ? this.cpf(digits.slice(0, 11))
          : this.cnpj(digits.slice(0, 14));
      case 'cep':
        return digits.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
      case 'integer':
        return digits;
      default:
        return value;
    }
  }

  private phone(digits: string): string {
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  private cpf(digits: string): string {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  private cnpj(digits: string): string {
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
}
