import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { PermissionService } from './permission.service';
import { permissionGuard } from './permission.guard';

function route(data: Record<string, unknown>): ActivatedRouteSnapshot {
  return { data } as ActivatedRouteSnapshot;
}

describe('permissionGuard', () => {
  it('permite la ruta sin permiso declarado', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({}), {} as never),
    );

    expect(result).toBe(true);
  });

  it('envía a sin permiso cuando falta el permiso', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PermissionService,
          useValue: { isAllowed: () => false },
        },
      ],
    });
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({ permission: 'alerts.read' }), {} as never),
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/app/sin-permiso');
  });

  it('respeta el modo "all"', () => {
    const isAllowed = vi.fn(() => true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { isAllowed } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(
        route({ permission: ['a', 'b'], permissionMode: 'all' }),
        {} as never,
      ),
    );

    expect(result).toBe(true);
    expect(isAllowed).toHaveBeenCalledWith(['a', 'b'], 'all');
  });
});
