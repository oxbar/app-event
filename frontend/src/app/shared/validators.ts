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
