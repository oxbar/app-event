import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {ForgotPasswordComponent} from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('não chama a API com e-mail inválido', () => {
    component.form.controls.email.setValue('sem-arroba');

    component.submit();

    http.expectNone('/api/auth/forgot-password');
    expect(component.form.controls.email.touched).toBeTrue();
  });

  it('normaliza o e-mail antes de enviar', () => {
    component.form.controls.email.setValue('  ANA@Exemplo.COM ');

    component.submit();

    const request = http.expectOne('/api/auth/forgot-password');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({email: 'ana@exemplo.com'});
    request.flush({message: 'Se o e-mail existir…', expiresInMinutes: 30});
  });

  it('troca para o estado de envio informando o prazo do link', () => {
    component.form.controls.email.setValue('ana@exemplo.com');
    component.submit();
    http.expectOne('/api/auth/forgot-password')
      .flush({message: 'Se o e-mail existir…', expiresInMinutes: 45, emailSent: true});
    fixture.detectChanges();

    expect(component.sent()).toBeTrue();
    expect(component.expiresInMinutes()).toBe(45);
    expect(text()).toContain('ana@exemplo.com');
    expect(text()).toContain('45 minutos');
  });

  it('bloqueia o reenvio imediato para evitar clique repetido', () => {
    component.form.controls.email.setValue('ana@exemplo.com');
    component.submit();
    http.expectOne('/api/auth/forgot-password').flush({message: 'ok', expiresInMinutes: 30});

    expect(component.cooldown()).toBeGreaterThan(0);

    component.submit();
    http.expectNone('/api/auth/forgot-password');
  });

  it('mostra o token apenas quando o servidor o devolve', () => {
    component.form.controls.email.setValue('ana@exemplo.com');
    component.submit();
    http.expectOne('/api/auth/forgot-password')
      .flush({message: 'ok', developmentToken: 'token-dev-123', expiresInMinutes: 30});
    fixture.detectChanges();

    expect(text()).toContain('token-dev-123');
  });

  it('exibe uma mensagem quando a API falha', () => {
    component.form.controls.email.setValue('ana@exemplo.com');
    component.submit();
    http.expectOne('/api/auth/forgot-password')
      .flush({message: 'Serviço indisponível.'}, {status: 503, statusText: 'Service Unavailable'});
    fixture.detectChanges();

    expect(component.sent()).toBeFalse();
    expect(text()).toContain('Serviço indisponível.');
  });
});
