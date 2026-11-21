import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser, LoginCredentials } from '../../../core/auth/auth.models';
import { DEFAULT_RETURN_URL, LoginPage, sanitizeReturnUrl } from './login-page';

const USER: AuthUser = {
  id: 'user-1',
  email: 'admin@site.local',
  fullName: 'Administrador',
  roles: ['ADMIN'],
  permissions: ['dashboard.read'],
  mustChangePassword: false,
};

class AuthStub {
  login = vi.fn<(credentials: LoginCredentials) => Observable<AuthUser>>();
}

function setup(
  params: Record<string, string> = {},
): { fixture: ComponentFixture<LoginPage>; auth: AuthStub; router: Router } {
  const auth = new AuthStub();
  auth.login.mockReturnValue(of(USER));

  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
      },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();

  return { fixture, auth, router };
}

describe('LoginPage', () => {
  it('muestra el formulario y el aviso de sesión expirada', () => {
    const { fixture } = setup({ expired: 'true' });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Iniciar sesión');
    expect(text).toContain('Tu sesión expiró');
    expect(fixture.nativeElement.querySelector('input#email')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input#password')).not.toBeNull();
  });

  it('no llama a la API si el formulario es inválido', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance;
    page.form.patchValue({ email: 'no-es-correo' });

    page.submit();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('correo electrónico válido');
  });

  it('inicia sesión y vuelve a la ruta solicitada', () => {
    const { fixture, auth, router } = setup({
      returnUrl: '/app/extintores',
    });
    const page = fixture.componentInstance;
    page.form.setValue({
      email: 'admin@site.local',
      password: 'secreto-1234',
    });

    page.submit();
    fixture.detectChanges();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'admin@site.local',
      password: 'secreto-1234',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/extintores');
  });

  it('traduce el 401 sin mostrar detalles técnicos', () => {
    const { fixture, auth } = setup();
    auth.login.mockReturnValue(
      throwError(
        () =>
          new ApiClientError(
            401,
            'UNAUTHENTICATED',
            'Invalid credentials',
            undefined,
            'req-401',
          ),
      ),
    );
    const page = fixture.componentInstance;
    page.form.setValue({
      email: 'admin@site.local',
      password: 'incorrecta',
    });

    page.submit();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('El correo o la contraseña no son correctos.');
    expect(text).toContain('Referencia del error: req-401');
    expect(text).not.toContain('Invalid credentials');
  });

  it('explica cuánto esperar cuando hay demasiados intentos', () => {
    const { fixture, auth } = setup();
    auth.login.mockReturnValue(
      throwError(
        () => new ApiClientError(429, 'TOO_MANY_REQUESTS', '', undefined, null, 30),
      ),
    );
    const page = fixture.componentInstance;
    page.form.setValue({ email: 'admin@site.local', password: 'secreto-1234' });

    page.submit();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Espera 30 segundos');
  });
});

describe('sanitizeReturnUrl', () => {
  it('acepta rutas internas', () => {
    expect(sanitizeReturnUrl('/app/extintores/42')).toBe('/app/extintores/42');
  });

  it('rechaza destinos externos, protocolos y el propio login', () => {
    expect(sanitizeReturnUrl(null)).toBe(DEFAULT_RETURN_URL);
    expect(sanitizeReturnUrl('//sitio.example')).toBe(DEFAULT_RETURN_URL);
    expect(sanitizeReturnUrl('https://sitio.example')).toBe(DEFAULT_RETURN_URL);
    expect(sanitizeReturnUrl('/\\sitio.example')).toBe(DEFAULT_RETURN_URL);
    expect(sanitizeReturnUrl('/login?returnUrl=/app')).toBe(DEFAULT_RETURN_URL);
    expect(sanitizeReturnUrl('/app/\u0000')).toBe(DEFAULT_RETURN_URL);
  });
});
