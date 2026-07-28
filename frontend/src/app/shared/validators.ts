import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export const brazilianPhoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = digits(control.value);
  if (!value) return null;
  return value.length === 10 || value.length === 11 ? null : {phone: true};
};

export const cpfValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = digits(control.value);
  if (!value) return null;
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return {cpf: true};

  const calculate = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculate(9) === Number(value[9]) && calculate(10) === Number(value[10])
    ? null
    : {cpf: true};
};

export function dateRangeValidator(startField: string, endField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = control.get(startField)?.value;
    const end = control.get(endField)?.value;
    if (!start || !end) return null;
    return new Date(end).getTime() > new Date(start).getTime() ? null : {dateRange: true};
  };
}

export const strongPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  const valid = /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
  return valid ? null : {strongPassword: true};
};

/**
 * Confirmação de senha.
 *
 * O erro é publicado no controle de confirmação — e não só no grupo — porque é
 * ali que a mensagem precisa aparecer para quem está digitando.
 */
export function passwordsMatchValidator(passwordField: string, confirmationField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordField);
    const confirmation = control.get(confirmationField);
    if (!password || !confirmation || !confirmation.value) return null;

    const mismatch = password.value !== confirmation.value;
    const errors = {...(confirmation.errors ?? {})};
    if (mismatch) {
      confirmation.setErrors({...errors, passwordMismatch: true});
    } else if (errors['passwordMismatch']) {
      delete errors['passwordMismatch'];
      confirmation.setErrors(Object.keys(errors).length ? errors : null);
    }
    return mismatch ? {passwordMismatch: true} : null;
  };
}

export interface PasswordStrength {
  /** 0 (vazia) a 4 (forte). */
  readonly level: number;
  readonly label: string;
  readonly rules: ReadonlyArray<{readonly id: string; readonly text: string; readonly met: boolean}>;
}

/**
 * Força da senha em quatro critérios objetivos. É orientação, não bloqueio: o
 * que impede o envio continua sendo a validação do formulário.
 */
export function passwordStrength(value: string): PasswordStrength {
  const password = String(value ?? '');
  const rules = [
    {id: 'length', text: 'Pelo menos 8 caracteres', met: password.length >= 8},
    {id: 'case', text: 'Maiúscula e minúscula', met: /[a-z]/.test(password) && /[A-Z]/.test(password)},
    {id: 'digit', text: 'Pelo menos um número', met: /\d/.test(password)},
    {id: 'symbol', text: 'Pelo menos um símbolo', met: /[^A-Za-z0-9]/.test(password)},
  ];
  const level = password ? rules.filter(rule => rule.met).length : 0;
  const labels = ['Vazia', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  return {level, label: labels[level] ?? 'Vazia', rules};
}
