import { TestBed } from '@angular/core/testing';
import {
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from './auth.service';
import { anonymousGuard } from './anonymous.guard';

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

function run(): boolean | UrlTree {
  return TestBed.runInInjectionContext(() =>
    anonymousGuard({} as never, { url: '/login' } as RouterStateSnapshot),
  ) as boolean | UrlTree;
}

describe('anonymousGuard', () => {
  it('deja ver el login a quien no tiene sesión', () => {
    setup(false);

    expect(run()).toBe(true);
  });

  it('lleva al inicio a quien ya inició sesión', () => {
    setup(true);
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(run() as UrlTree)).toBe('/app/inicio');
  });
});
