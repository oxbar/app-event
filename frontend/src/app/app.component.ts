import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {TuiRoot} from '@taiga-ui/core';
import {ThemeService} from './core/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TuiRoot],
  template: `
    <tui-root
      [attr.tuiTheme]="theme.dark() ? 'dark' : null"
      [attr.data-theme]="theme.mode()"
    >
      <router-outlet />
    </tui-root>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly theme = inject(ThemeService);
}
