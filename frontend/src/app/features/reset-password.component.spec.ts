import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {ResetPasswordComponent} from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let http: HttpTestingController;

  async function setUp(token: string | null): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {snapshot: {queryParamMap: convertToParamMap(token ? {token} : {})}},
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  function html(): string {
    return (fixture.nativeElement as HTMLElement).innerHTML;
  }

  it('preenche o token vindo do link e esconde o campo', async () => {
    await setUp('token-do-email');

    expect(component.form.controls.token.value).toBe('token-do-email');
    expect(component.tokenFromLink()).toBe('token-do-email');
    expect(html()).not.toContain('reset-token');
    http.verify();
  });

  it('mostra o campo de token quando o link não traz nenhum', async () => {
    await setUp(null);

    expect(html()).toContain('reset-token');
    http.verify();
  });

  it('recusa o envio quando as senhas não coincidem', async () => {
    await setUp('token-do-email');
    component.form.patchValue({password: 'NovaSenha@123', confirmation: 'Outra@1234'});

    component.submit();

    expect(component.form.hasError('passwordMismatch')).toBeTrue();
    http.expectNone('/api/auth/reset-password');
    http.verify();
  });

  it('recusa senha fraca antes de chamar a API', async () => {
    await setUp('token-do-email');
    component.form.patchValue({password: 'somenteletras', confirmation: 'somenteletras'});

    component.submit();

    expect(component.form.controls.password.hasError('strongPassword')).toBeTrue();
    http.expectNone('/api/auth/reset-password');
    http.verify();
  });

  it('reflete a força da senha digitada', async () => {
    await setUp('token-do-email');

    component.form.controls.password.setValue('Abcdefg1!');
    fixture.detectChanges();

    expect(component.strength().level).toBe(4);
    expect(component.strength().label).toBe('Forte');
  });

  it('envia token e senha e confirma a troca', async () => {
    await setUp('token-do-email');
    component.form.patchValue({password: 'NovaSenha@123', confirmation: 'NovaSenha@123'});

    component.submit();

    const request = http.expectOne('/api/auth/reset-password');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({token: 'token-do-email', password: 'NovaSenha@123'});
    request.flush(null);
    fixture.detectChanges();

    expect(component.done()).toBeTrue();
    http.verify();
  });

  it('explica que o link expirou quando a API recusa o token', async () => {
    await setUp('token-vencido');
    component.form.patchValue({password: 'NovaSenha@123', confirmation: 'NovaSenha@123'});

    component.submit();
    http.expectOne('/api/auth/reset-password').flush(
      {code: 'INVALID_RESET_TOKEN', message: 'Token de recuperação inválido ou expirado.'},
      {status: 400, statusText: 'Bad Request'},
    );
    fixture.detectChanges();

    expect(component.done()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('inválido ou expirado');
    http.verify();
  });
});
