import {Routes} from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {path: 'login', loadComponent: () => import('../features/login.component').then(m => m.LoginComponent)},
  {path: 'forgot-password', loadComponent: () => import('../features/forgot-password.component').then(m => m.ForgotPasswordComponent)},
  {path: 'reset-password', loadComponent: () => import('../features/reset-password.component').then(m => m.ResetPasswordComponent)},
  {path: 'e/:slug', loadComponent: () => import('../public/public-event.component').then(m => m.PublicEventComponent)},
  {path: 'payment/:code', loadComponent: () => import('../public/payment.component').then(m => m.PaymentComponent)},
  {path: 'ticket/:token', loadComponent: () => import('../public/ticket.component').then(m => m.TicketComponent)},
  {path: 't/:token', loadComponent: () => import('../public/ticket.component').then(m => m.TicketComponent)},
  {path: 'forbidden', loadComponent: () => import('../features/forbidden.component').then(m => m.ForbiddenComponent)},
];
