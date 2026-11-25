import { Routes } from '@angular/router';
import { anonymousGuard } from './core/auth/anonymous.guard';
import { authGuard } from './core/auth/auth.guard';
import { pendingPasswordChangeGuard } from './core/auth/pending-password-change.guard';
import { permissionGuard } from './core/permissions/permission.guard';

/**
 * Rutas de la aplicación.
 *
 * Los `title` son claves de traducción: `I18nTitleStrategy` las resuelve para
 * que no haya texto visible escrito en el código de navegación (D-30).
 * Los módulos se cargan de forma diferida por sección.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app/inicio',
  },
  {
    path: 'login',
    title: 'page.title.login',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    canActivateChild: [pendingPasswordChangeGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inicio',
      },
      {
        path: 'inicio',
        title: 'page.title.home',
        canActivate: [permissionGuard],
        data: { permission: 'dashboard.read' },
        loadComponent: () =>
          import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'extintores',
        title: 'page.title.inventory',
        canActivate: [permissionGuard],
        data: { permission: 'extinguishers.read' },
        loadComponent: () =>
          import(
            './features/extinguishers/list/extinguisher-list-page'
          ).then((m) => m.ExtinguisherListPage),
      },
      {
        path: 'extintores/nuevo',
        title: 'page.title.extinguisherCreate',
        canActivate: [permissionGuard],
        data: {
          permission: [
            'extinguishers.create',
            'catalogs.read',
            'locations.read',
          ],
          permissionMode: 'all',
        },
        loadComponent: () =>
          import(
            './features/extinguishers/form/extinguisher-form-page'
          ).then((m) => m.ExtinguisherFormPage),
      },
      {
        path: 'extintores/:id/editar',
        title: 'page.title.extinguisherEdit',
        canActivate: [permissionGuard],
        data: {
          mode: 'edit',
          permission: [
            'extinguishers.update',
            'extinguishers.read',
            'catalogs.read',
          ],
          permissionMode: 'all',
        },
        loadComponent: () =>
          import(
            './features/extinguishers/form/extinguisher-form-page'
          ).then((m) => m.ExtinguisherFormPage),
      },
      {
        path: 'extintores/:id/condicion',
        title: 'page.title.extinguisherCondition',
        canActivate: [permissionGuard],
        data: {
          permission: ['extinguishers.condition', 'extinguishers.read'],
          permissionMode: 'all',
        },
        loadComponent: () =>
          import(
            './features/extinguishers/condition/extinguisher-condition-page'
          ).then((m) => m.ExtinguisherConditionPage),
      },
      {
        path: 'extintores/:id/etiqueta',
        title: 'page.title.extinguisherLabel',
        canActivate: [permissionGuard],
        data: { permission: 'extinguishers.read' },
        loadComponent: () =>
          import(
            './features/extinguishers/label/extinguisher-label-page'
          ).then((m) => m.ExtinguisherLabelPage),
      },
      {
        path: 'extintores/:id',
        title: 'page.title.extinguisherDetail',
        canActivate: [permissionGuard],
        data: { permission: 'extinguishers.read' },
        loadComponent: () =>
          import(
            './features/extinguishers/detail/extinguisher-detail-page'
          ).then((m) => m.ExtinguisherDetailPage),
      },
      {
        path: 'escanear',
        title: 'page.title.scan',
        canActivate: [permissionGuard],
        data: { permission: 'extinguishers.read' },
        loadComponent: () =>
          import('./features/scan/scan-page/scan-page').then(
            (m) => m.ScanPage,
          ),
      },
      {
        path: 'cambiar-contrasena',
        title: 'page.title.changePassword',
        loadComponent: () =>
          import('./features/auth/change-password/change-password-page').then(
            (m) => m.ChangePasswordPage,
          ),
      },
      {
        path: 'sin-permiso',
        title: 'page.title.forbidden',
        loadComponent: () =>
          import('./features/errors/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'page.title.notFound',
        loadComponent: () =>
          import('./features/errors/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
  {
    path: '**',
    title: 'page.title.notFound',
    loadComponent: () =>
      import('./features/errors/not-found-page').then((m) => m.NotFoundPage),
  },
];
