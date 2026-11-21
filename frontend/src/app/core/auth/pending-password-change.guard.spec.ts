import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from './auth.service';
import { pendingPasswordChangeGuard } from './pending-password-change.guard';

function setup(mustChangePassword: boolean): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { mustChangePassword: () => mustChangePassword },
      },
    ],
  });
}

function run(url: string): boolean | UrlTree {
  return TestBed.runInInjectionContext(() =>
    pendingPasswordChangeGuard(
      {} as ActivatedRouteSnapshot,
      { url } as RouterStateSnapshot,
    ),
  ) as boolean | UrlTree;
}

describe('pendingPasswordChangeGuard', () => {
  it('desvía al cambio de contraseña mientras está pendiente', () => {
    setup(true);
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(run('/app/inicio') as UrlTree)).toBe(
      '/app/cambiar-contrasena',
    );
  });

  it('permite la propia pantalla de cambio', () => {
    setup(true);

    expect(run('/app/cambiar-contrasena')).toBe(true);
  });

  it('no interviene cuando ya no hay cambio pendiente', () => {
    setup(false);

    expect(run('/app/inicio')).toBe(true);
  });
});
