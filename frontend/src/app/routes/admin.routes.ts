import {Routes} from '@angular/router';
import {authGuard, roleGuard} from '../core/guards';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('../layout/shell.component').then(m => m.ShellComponent),
    children: [
      {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
      {path: 'dashboard', loadComponent: () => import('../features/dashboard.component').then(m => m.DashboardComponent)},
      {path: 'events', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('../features/events.component').then(m => m.EventsComponent)},
      {path: 'orders', canActivate: [roleGuard], data: {kind: 'orders', title: 'Pedidos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'payments', canActivate: [roleGuard], data: {kind: 'payments', title: 'Pagamentos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'tickets', canActivate: [roleGuard], data: {kind: 'tickets', title: 'Ingressos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'attendees', canActivate: [roleGuard], data: {kind: 'attendees', title: 'Participantes', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'VIEWER']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'refunds', canActivate: [roleGuard], data: {kind: 'refunds', title: 'Reembolsos', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'audit', canActivate: [roleGuard], data: {kind: 'audit', title: 'Auditoria', roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN']}, loadComponent: () => import('../features/resources.component').then(m => m.ResourcesComponent)},
      {path: 'operations', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN']}, loadComponent: () => import('../features/operations.component').then(m => m.OperationsComponent)},
      {path: 'reports', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'FINANCE', 'VIEWER']}, loadComponent: () => import('../features/reports.component').then(m => m.ReportsComponent)},
      {path: 'door', canActivate: [roleGuard], data: {roles: ['SUPER_ADMIN', 'ORGANIZER_ADMIN', 'EVENT_MANAGER', 'DOOR_STAFF']}, loadComponent: () => import('../features/door.component').then(m => m.DoorComponent)},
      {path: '**', loadComponent: () => import('../features/not-found.component').then(m => m.NotFoundComponent)},
    ],
  },
];
