import {Routes} from '@angular/router';
import {authGuard, roleGuard} from './core/guards';

export const routes: Routes = [
  {path: 'login', loadComponent: () => import('./features/login.component').then(m => m.LoginComponent)},
  {path: 'forgot-password', loadComponent: () => import('./features/forgot-password.component').then(m => m.ForgotPasswordComponent)},
  {path: 'reset-password', loadComponent: () => import('./features/reset-password.component').then(m => m.ResetPasswordComponent)},
  {path: 'e/:slug', loadComponent: () => import('./public/public-event.component').then(m => m.PublicEventComponent)},
  {path: 'payment/:code', loadComponent: () => import('./public/payment.component').then(m => m.PaymentComponent)},
  {path: 'ticket/:token', loadComponent: () => import('./public/ticket.component').then(m => m.TicketComponent)},
  {path: 't/:token', loadComponent: () => import('./public/ticket.component').then(m => m.TicketComponent)},
  {path: 'forbidden', loadComponent: () => import('./features/forbidden.component').then(m => m.ForbiddenComponent)},
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
      {path: 'dashboard', loadComponent: () => import('./features/dashboard.component').then(m => m.DashboardComponent)},
      {path: 'events', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('./features/events.component').then(m => m.EventsComponent)},
      {path: 'orders', canActivate: [roleGuard], data: {kind: 'orders', title: 'Pedidos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'payments', canActivate: [roleGuard], data: {kind: 'payments', title: 'Pagamentos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'tickets', canActivate: [roleGuard], data: {kind: 'tickets', title: 'Ingressos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'attendees', canActivate: [roleGuard], data: {kind: 'attendees', title: 'Participantes', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'refunds', canActivate: [roleGuard], data: {kind: 'refunds', title: 'Reembolsos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'audit', canActivate: [roleGuard], data: {kind: 'audit', title: 'Auditoria', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN']}, loadComponent: () => import('./features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'operations', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN']}, loadComponent: () => import('./features/operations.component').then(m => m.OperationsComponent)},
      {path: 'reports', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER']}, loadComponent: () => import('./features/reports.component').then(m => m.ReportsComponent)},
      {path: 'door', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'DOOR_STAFF']}, loadComponent: () => import('./features/door.component').then(m => m.DoorComponent)},
      {path: '**', loadComponent: () => import('./features/not-found.component').then(m => m.NotFoundComponent)},
    ],
  },
  {path: '**', redirectTo: '/login'},
];
