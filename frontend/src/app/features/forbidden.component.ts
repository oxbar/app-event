import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TuiButton} from '@taiga-ui/core';

@Component({
  standalone: true,
  imports: [RouterLink, TuiButton],
  template: `<main class="center-state"><h1>403</h1><p>Você não possui permissão para acessar esta página.</p><a tuiButton routerLink="/dashboard">Voltar ao dashboard</a></main>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {}
