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
