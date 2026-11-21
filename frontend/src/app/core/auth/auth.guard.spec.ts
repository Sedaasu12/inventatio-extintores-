import { TestBed } from '@angular/core/testing';
import {
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

function setup(authenticated: boolean): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { isAuthenticated: () => authenticated },
      },
    ],
  });
}

function run(url: string): boolean | UrlTree {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as never, { url } as RouterStateSnapshot),
  ) as boolean | UrlTree;
}

describe('authGuard', () => {
  it('envía al login conservando la ruta solicitada', () => {
    setup(false);
    const router = TestBed.inject(Router);

    const result = run('/app/extintores');

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fapp%2Fextintores',
    );
  });

  it('deja pasar a una sesión válida', () => {
    setup(true);

    expect(run('/app/inicio')).toBe(true);
  });
});
