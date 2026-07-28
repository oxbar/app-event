import {TestBed} from '@angular/core/testing';
import {ThemeService} from './theme.service';

/**
 * O tema escuro só funciona se o atributo chegar ao elemento <html>: é lá que
 * as variáveis de cor precisam ser sobrescritas para alcançar o body. Estes
 * testes protegem exatamente esse contrato — foi a sua ausência que deixou o
 * tema pela metade.
 */
describe('ThemeService', () => {
  const STORAGE_KEY = 'event-access-theme';

  function build(): ThemeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  function fakeMedia(matches: boolean): MediaQueryList {
    return {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('tuiTheme');
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('tuiTheme');
  });

  afterAll(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('tuiTheme');
    document.body.removeAttribute('tuiTheme');
  });

  it('segue o sistema quando não há preferência salva', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));

    const service = build();

    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('light');
  });

  it('acompanha o sistema em modo escuro', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(true));

    const service = build();

    expect(service.dark()).toBeTrue();
    expect(document.documentElement.getAttribute('tuiTheme')).toBe('dark');
  });

  it('aplica o atributo no elemento html e no body ao alternar', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));
    const service = build();

    service.toggle();

    expect(service.dark()).toBeTrue();
    expect(document.documentElement.getAttribute('tuiTheme')).toBe('dark');
    expect(document.body.getAttribute('tuiTheme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('remove o atributo ao voltar para o tema claro', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(true));
    const service = build();

    service.set('light');

    expect(service.dark()).toBeFalse();
    expect(document.documentElement.hasAttribute('tuiTheme')).toBeFalse();
    expect(document.body.hasAttribute('tuiTheme')).toBeFalse();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('guarda a escolha e a recupera na próxima sessão', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));
    build().set('dark');

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(build().resolved()).toBe('dark');
  });

  it('aceita o valor legado gravado pela versão anterior', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));

    expect(build().dark()).toBeTrue();
  });

  it('ignora valores inválidos no armazenamento', () => {
    localStorage.setItem(STORAGE_KEY, 'arco-iris');
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));

    expect(build().preference()).toBe('system');
  });

  it('mantém a cor da barra do navegador em sintonia com o tema', () => {
    spyOn(window, 'matchMedia').and.returnValue(fakeMedia(false));
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#6b4eff');
    document.head.appendChild(meta);

    try {
      build().set('dark');
      expect(meta.getAttribute('content')).toBe('#0e0e12');
    } finally {
      meta.remove();
    }
  });
});
