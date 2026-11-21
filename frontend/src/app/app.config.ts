import {
  ApplicationConfig,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { errorInterceptor } from './core/api/error.interceptor';
import { requestIdInterceptor } from './core/api/request-id.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { sessionRefreshInterceptor } from './core/auth/session-refresh.interceptor';
import { APP_LOCALE } from './core/i18n/locale';
import { I18nTitleStrategy } from './layout/i18n-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: I18nTitleStrategy },
    provideHttpClient(
      withInterceptors([
        errorInterceptor,
        requestIdInterceptor,
        authInterceptor,
        sessionRefreshInterceptor,
      ]),
    ),
    { provide: LOCALE_ID, useValue: APP_LOCALE },
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
