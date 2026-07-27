import {FormControl, FormGroup} from '@angular/forms';
import {brazilianPhoneValidator, cpfValidator, dateRangeValidator, strongPasswordValidator} from './validators';

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
