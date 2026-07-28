import {FormControl, FormGroup} from '@angular/forms';
import {
  brazilianPhoneValidator,
  cpfValidator,
  dateRangeValidator,
  passwordStrength,
  passwordsMatchValidator,
  strongPasswordValidator,
} from './validators';

describe('validadores pt-BR', () => {
  it('valida telefone brasileiro com DDD', () => {
    expect(brazilianPhoneValidator(new FormControl('(47) 99999-9999'))).toBeNull();
    expect(brazilianPhoneValidator(new FormControl('123'))).toEqual({phone: true});
  });

  it('valida CPF pelo dígito verificador', () => {
    expect(cpfValidator(new FormControl('529.982.247-25'))).toBeNull();
    expect(cpfValidator(new FormControl('111.111.111-11'))).toEqual({cpf: true});
  });

  it('exige término posterior ao início', () => {
    const form = new FormGroup({
      start: new FormControl('2026-07-27T20:00'),
      end: new FormControl('2026-07-27T19:00'),
    }, dateRangeValidator('start', 'end'));
    expect(form.hasError('dateRange')).toBeTrue();
  });

  it('exige senha com classes de caracteres distintas', () => {
    expect(strongPasswordValidator(new FormControl('Senha@123'))).toBeNull();
    expect(strongPasswordValidator(new FormControl('senha123'))).toEqual({strongPassword: true});
  });
});

describe('confirmação e força de senha', () => {
  function group(password: string, confirmation: string): FormGroup {
    return new FormGroup(
      {
        password: new FormControl(password),
        confirmation: new FormControl(confirmation),
      },
      passwordsMatchValidator('password', 'confirmation'),
    );
  }

  it('acusa divergência no campo de confirmação', () => {
    const form = group('Senha@123', 'Senha@124');

    expect(form.hasError('passwordMismatch')).toBeTrue();
    expect(form.controls['confirmation'].hasError('passwordMismatch')).toBeTrue();
  });

  it('libera quando as senhas coincidem', () => {
    const form = group('Senha@123', 'Senha@123');

    expect(form.hasError('passwordMismatch')).toBeFalse();
    expect(form.controls['confirmation'].hasError('passwordMismatch')).toBeFalse();
  });

  it('limpa o erro sem apagar as demais validações do campo', () => {
    const form = group('Senha@123', 'Senha@124');
    form.controls['confirmation'].setErrors({required: true, passwordMismatch: true});

    form.controls['confirmation'].setValue('Senha@123');
    form.updateValueAndValidity();

    expect(form.controls['confirmation'].hasError('passwordMismatch')).toBeFalse();
  });

  it('não reclama enquanto a confirmação está vazia', () => {
    expect(group('Senha@123', '').hasError('passwordMismatch')).toBeFalse();
  });

  it('mede a força pelos quatro critérios', () => {
    expect(passwordStrength('').level).toBe(0);
    expect(passwordStrength('abcdefgh').level).toBe(1);
    expect(passwordStrength('Abcdefgh').level).toBe(2);
    expect(passwordStrength('Abcdefg1').level).toBe(3);
    expect(passwordStrength('Abcdefg1!').level).toBe(4);
    expect(passwordStrength('Abcdefg1!').label).toBe('Forte');
  });

  it('descreve cada regra para orientar quem digita', () => {
    const rules = passwordStrength('abc').rules;

    expect(rules.length).toBe(4);
    expect(rules.every(rule => typeof rule.text === 'string' && rule.text.length > 0)).toBeTrue();
    expect(rules.find(rule => rule.id === 'length')?.met).toBeFalse();
  });

  it('a força não substitui o validador que bloqueia o envio', () => {
    expect(strongPasswordValidator(new FormControl('Abcdefg1!'))).toBeNull();
    expect(strongPasswordValidator(new FormControl('abcdefgh'))).toEqual({strongPassword: true});
  });
});
