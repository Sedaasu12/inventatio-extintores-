import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthSession } from './auth.models';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'admin@site.local',
    fullName: 'Administrador',
    roles: ['ADMIN'],
    permissions: ['dashboard.read', 'extinguishers.read'],
    mustChangePassword: false,
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const login = (session: AuthSession = SESSION): void => {
    service.login({ email: session.user.email, password: 'secreto' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(session);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    http.verify();
  });

  it('guarda la sesión en memoria y nunca en el almacenamiento del navegador', () => {
    login();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('token-1');
    expect(service.user()?.email).toBe('admin@site.local');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain('token-1');
  });

  it('comparte una sola petición de refresh entre llamadas simultáneas', () => {
    const received: AuthSession[] = [];

    service.refreshSession().subscribe((session) => received.push(session));
    service.refreshSession().subscribe((session) => received.push(session));

    const refresh = http.match('/api/v1/auth/refresh');
    expect(refresh).toHaveLength(1);

    refresh[0].flush({ ...SESSION, accessToken: 'token-2' });

    expect(received).toHaveLength(2);
    expect(received.every((session) => session.accessToken === 'token-2')).toBe(
      true,
    );
    expect(service.accessToken()).toBe('token-2');
  });

  it('vuelve a anónimo cuando el refresh falla, sin dejar token', () => {
    login();
    const errors: unknown[] = [];

    service.refreshSession().subscribe({ error: (error) => errors.push(error) });
    http
      .expectOne('/api/v1/auth/refresh')
      .flush(
        { error: { code: 'UNAUTHENTICATED', message: 'Sesión inválida' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(errors).toHaveLength(1);
    expect(service.status()).toBe('anonymous');
    expect(service.accessToken()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.sessionExpired()).toBe(true);
  });

  it('no marca caducidad cuando el arranque no tiene sesión previa', async () => {
    const restoring = service.restoreSession();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush(
        { error: { code: 'UNAUTHENTICATED', message: 'Sin cookie' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await restoring;

    expect(service.status()).toBe('anonymous');
    expect(service.sessionExpired()).toBe(false);
  });

  it('cierra la sesión local aunque el servidor falle al cerrar', () => {
    login();
    service.logout().subscribe();
    http
      .expectOne('/api/v1/auth/logout')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.status()).toBe('anonymous');
    expect(service.accessToken()).toBeNull();
  });

  it('quita el cambio obligatorio de contraseña tras cambiarla', () => {
    login({
      ...SESSION,
      user: { ...SESSION.user, mustChangePassword: true },
    });
    expect(service.mustChangePassword()).toBe(true);

    service
      .changePassword({
        currentPassword: 'temporal-1234',
        newPassword: 'nueva-clave-1234',
      })
      .subscribe();
    http.expectOne('/api/v1/auth/change-password').flush(null);

    expect(service.mustChangePassword()).toBe(false);
  });
});
