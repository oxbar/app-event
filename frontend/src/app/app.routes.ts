import {Routes} from '@angular/router';
import {PUBLIC_ROUTES} from './routes/public.routes';

export const routes: Routes = [
  ...PUBLIC_ROUTES,
  {
    path: '',
    loadChildren: () => import('./routes/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {path: '**', redirectTo: '/login'},
];
