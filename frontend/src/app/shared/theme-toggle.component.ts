import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {TuiButton} from '@taiga-ui/core';
import {ThemeService} from '../core/theme.service';

/**
 * Botão de tema reutilizado no cabeçalho e nas telas de autenticação.
 *
 * Antes o controle existia apenas dentro do shell: quem estava na tela de login
 * — justamente onde muita gente passa mais tempo em um primeiro acesso — não
 * tinha como sair do tema padrão. O rótulo diz para onde o clique leva, e o
 * `aria-pressed` informa o estado atual a quem usa leitor de tela.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [TuiButton],
  template: `
    <button
      tuiButton
      type="button"
      size="s"
      [appearance]="appearance()"
      [iconStart]="theme.dark() ? '@tui.sun' : '@tui.moon'"
      [attr.aria-pressed]="theme.dark()"
      [attr.aria-label]="label()"
      [attr.data-theme-state]="theme.resolved()"
      data-testid="theme-toggle"
      (click)="theme.toggle()"
    >
      @if (showLabel()) {
        {{ label() }}
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
  readonly showLabel = input(true);
  readonly appearance = input('secondary');

  label(): string {
    return this.theme.dark() ? 'Tema claro' : 'Tema escuro';
  }
}
