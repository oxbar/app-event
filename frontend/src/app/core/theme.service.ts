import {DOCUMENT} from '@angular/common';
import {computed, inject, Injectable, signal} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'event-access-theme';
const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Tema claro/escuro da área administrativa.
 *
 * O atributo `tuiTheme` é aplicado no elemento `<html>`, e não no `<tui-root>`.
 * Essa é a correção central: as variáveis de cor são declaradas em `:root` e o
 * `body` consome `var(--bg)`. Com o atributo preso a um elemento interno, o
 * fundo da página ficava fora do escopo do override e o tema escuro pintava
 * apenas parte da tela.
 *
 * A preferência aceita três estados. `system` acompanha o sistema operacional
 * em tempo real; `light` e `dark` são escolhas explícitas e vencem o sistema.
 */
@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.matchMedia();
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.readPreference());

  /** Tema efetivamente aplicado, já resolvendo `system`. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const preference = this.preference();
    if (preference === 'system') return this.systemDark() ? 'dark' : 'light';
    return preference;
  });

  readonly dark = computed(() => this.resolved() === 'dark');

  constructor() {
    this.listenToSystem();
    this.apply();
  }

  /** Alterna entre claro e escuro assumindo o controle explícito. */
  toggle(): void {
    this.set(this.dark() ? 'light' : 'dark');
  }

  set(preference: ThemePreference): void {
    if (!PREFERENCES.includes(preference)) return;
    this.preference.set(preference);
    this.persist(preference);
    this.apply();
  }

  private apply(): void {
    const theme = this.resolved();
    const root = this.document.documentElement;
    const body = this.document.body;

    // `tuiTheme` é o gancho do Taiga UI; `data-theme` serve às regras próprias.
    if (theme === 'dark') {
      root.setAttribute('tuiTheme', 'dark');
      body?.setAttribute('tuiTheme', 'dark');
    } else {
      root.removeAttribute('tuiTheme');
      body?.removeAttribute('tuiTheme');
    }
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    // A barra do navegador no celular acompanha o tema da aplicação.
    const meta = this.document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#0e0e12' : '#6b4eff');
  }

  private listenToSystem(): void {
    const media = this.media;
    if (!media) return;
    const handler = (event: MediaQueryListEvent): void => {
      this.systemDark.set(event.matches);
      if (this.preference() === 'system') this.apply();
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
    } else if (typeof media.addListener === 'function') {
      // Safari antigo continua no caminho legado.
      media.addListener(handler);
    }
  }

  private matchMedia(): MediaQueryList | null {
    const view = this.document.defaultView;
    if (!view || typeof view.matchMedia !== 'function') return null;
    try {
      return view.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return null;
    }
  }

  private readPreference(): ThemePreference {
    try {
      const stored = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (stored && PREFERENCES.includes(stored as ThemePreference)) return stored as ThemePreference;
    } catch {
      // Armazenamento bloqueado (modo privado, por exemplo): segue o sistema.
    }
    return 'system';
  }

  private persist(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, preference);
    } catch {
      // Sem persistência a escolha continua valendo nesta sessão.
    }
  }
}
