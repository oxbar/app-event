import {TestBed} from '@angular/core/testing';
import {ThemeService} from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('aplica e persiste o tema escuro', () => {
    const service = TestBed.inject(ThemeService);

    service.set('dark');
    TestBed.flushEffects();

    expect(service.dark()).toBeTrue();
    expect(localStorage.getItem('event-access-theme')).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('alterna de escuro para claro', () => {
    localStorage.setItem('event-access-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ThemeService);

    service.toggle();
    TestBed.flushEffects();

    expect(service.mode()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
