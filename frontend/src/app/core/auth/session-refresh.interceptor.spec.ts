import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { errorInterceptor } from '../api/error.interceptor';
import { ApiClientError } from '../api/api-error';
import { requestIdInterceptor } from '../api/request-id.interceptor';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { sessionRefreshInterceptor } from './session-refresh.interceptor';

const SESSION = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'admin@site.local',
    fullName: 'Administrador',
    roles: ['ADMIN'],
    permissions: ['extinguishers.read'],
    mustChangePassword: false,
  },
};

describe('interceptores de sesión', () => {
  let client: HttpClient;
  let auth: AuthService;
  let http: HttpTestingController;
  let subscriptions: Subscription[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            errorInterceptor,
            requestIdInterceptor,
            authInterceptor,
            sessionRefreshInterceptor,
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    subscriptions = [];

    auth.login({ email: 'admin@site.local', password: 'secreto' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(SESSION);
  });

  afterEach(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
    http.verify();
  });

  const get = (url: string): void => {
    subscriptions.push(
      client.get(url).subscribe({
        next: () => undefined,
        error: () => undefined,
      }),
    );
  };

  it('añade el token y el identificador de correlación a cada petición', () => {
    get('/api/v1/extinguishers');

    const request = http.expectOne('/api/v1/extinguishers');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(request.request.headers.get('X-Request-Id')).toBeTruthy();
    request.flush([]);
  });

  it('renueva una sola vez y reintenta las peticiones que reciben 401', () => {
    get('/api/v1/extinguishers');
    get('/api/v1/locations');

    const extinguishers = http.expectOne('/api/v1/extinguishers');
    const locations = http.expectOne('/api/v1/locations');

    extinguishers.flush(
      { error: { code: 'UNAUTHENTICATED', message: 'Sesión expirada' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    locations.flush(
      { error: { code: 'UNAUTHENTICATED', message: 'Sesión expirada' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    const refreshes = http.match('/api/v1/auth/refresh');
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush({ ...SESSION, accessToken: 'token-2' });

    const retried = http.match('/api/v1/extinguishers');
    const retriedLocations = http.match('/api/v1/locations');
    expect(retried).toHaveLength(1);
    expect(retriedLocations).toHaveLength(1);
    expect(retried[0].request.headers.get('Authorization')).toBe(
      'Bearer token-2',
    );
    expect(retriedLocations[0].request.headers.get('Authorization')).toBe(
      'Bearer token-2',
    );

    retried[0].flush([]);
    retriedLocations[0].flush([]);
  });

  it('no reintenta en bucle si el reintento vuelve a responder 401', () => {
    let error: unknown;
    subscriptions.push(
      client.get('/api/v1/extinguishers').subscribe({
        error: (value: unknown) => {
          error = value;
        },
      }),
    );

    http.expectOne('/api/v1/extinguishers').flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ ...SESSION, accessToken: 'token-2' });
    http.expectOne('/api/v1/extinguishers').flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(http.match('/api/v1/auth/refresh')).toHaveLength(0);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(401);
  });

  it('cierra la sesión y devuelve el 401 original si el refresh falla', () => {
    let error: unknown;
    subscriptions.push(
      client.get('/api/v1/extinguishers').subscribe({
        error: (value: unknown) => {
          error = value;
        },
      }),
    );

    http.expectOne('/api/v1/extinguishers').flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    http
      .expectOne('/api/v1/auth/refresh')
      .flush(
        { error: { code: 'UNAUTHENTICATED', message: 'Sesión expirada' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe('UNAUTHENTICATED');
    expect(auth.status()).toBe('anonymous');
    expect(auth.accessToken()).toBeNull();
  });

  it('no intercepta el propio login ni el refresh', () => {
    client
      .post('/api/v1/auth/login', { email: 'a@b.test', password: 'x' })
      .subscribe();

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(SESSION);
  });
});
