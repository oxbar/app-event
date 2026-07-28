import {DOCUMENT} from '@angular/common';
import {computed, effect, inject, Injectable, signal} from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'event-access-theme';
  readonly mode = signal<ThemeMode>(this.readInitialMode());
  readonly dark = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => this.apply(this.mode()));
  }

  toggle(): void {
    this.set(this.dark() ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.document.defaultView?.localStorage.setItem(this.storageKey, mode);
    } catch {
      // O tema continua funcionando mesmo quando o navegador bloqueia storage.
    }
  }

  private readInitialMode(): ThemeMode {
    const view = this.document.defaultView;
    let stored: string | null = null;
    try {
      stored = view?.localStorage.getItem(this.storageKey) ?? null;
    } catch {
      // Usa a preferência do sistema quando storage não está disponível.
    }
    if (stored === 'light' || stored === 'dark') return stored;
    return view?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = mode;
    root.style.colorScheme = mode;
  }
}
