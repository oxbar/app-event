import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {TuiRoot} from '@taiga-ui/core';
import {ThemeService} from './core/theme.service';

/**
 * O `ThemeService` é injetado aqui para garantir sua criação no arranque: é ele
 * quem escreve o atributo `tuiTheme` no elemento `<html>`. O mesmo atributo é
 * repetido no `<tui-root>` porque os componentes do Taiga UI o consultam a
 * partir do próprio contexto.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TuiRoot],
  template: `
    <tui-root [attr.tuiTheme]="theme.dark() ? 'dark' : null">
      <router-outlet />
    </tui-root>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly theme = inject(ThemeService);
}
