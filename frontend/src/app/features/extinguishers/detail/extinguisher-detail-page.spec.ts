import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import { PermissionService } from '../../../core/permissions/permission.service';
import { ExtinguishersApi } from '../extinguishers.api';
import { ExtinguisherDetail } from '../extinguisher.models';
import { ExtinguisherDetailPage } from './extinguisher-detail-page';

const DETAIL: ExtinguisherDetail = {
  id: 'ext-1',
  assetCode: 'EXT-000001',
  serialNumber: 'SN-001',
  type: {
    id: 'type-1',
    code: 'PQS-6',
    name: 'Polvo químico seco 6 kg',
    agent: 'PQS',
    nominalCapacity: '6.00',
    capacityUnit: 'KG',
    usefulLifeYears: 10,
  },
  brand: 'Marca',
  model: 'Modelo',
  capacityValue: '6.00',
  capacityUnit: 'KG',
  manufactureDate: '2024-01-15',
  acquiredAt: '2024-02-01',
  commissionedAt: '2024-02-10',
  manufacturerExpiryDate: '2034-01-15',
  logisticsStatus: 'ASIGNADO',
  technicalCondition: 'OPERATIVO',
  placementType: 'INTERNAL',
  currentLocation: {
    id: 'loc-1',
    code: 'UBI-000003',
    name: 'Área de Desarrollo',
    type: 'AREA',
    parentId: 'sede-1',
  },
  currentExternalParty: null,
  currentSince: '2026-11-01T12:00:00.000Z',
  retiredAt: null,
  notes: 'Revisar señalización del gabinete.',
  rowVersion: 3,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-02T12:00:00.000Z',
  dueDates: [
    {
      eventType: 'INSPECCION',
      dueDate: '2027-01-15',
      sourceType: 'INSPECTION',
      sourceId: 'insp-1',
      updatedAt: '2026-11-02T12:00:00.000Z',
    },
    {
      eventType: 'RECARGA',
      dueDate: '2027-03-01',
      sourceType: 'MAINTENANCE_SERVICE',
      sourceId: 'svc-1',
      updatedAt: '2026-11-02T12:00:00.000Z',
    },
  ],
  movementCount: 4,
  lastInspection: {
    id: 'insp-1',
    inspectedAt: '2026-11-01T15:00:00.000Z',
    inspectedOn: '2026-11-01',
    inspectorName: 'Ana Torres',
    result: 'APROBADO_CON_OBSERVACIONES',
    nextDueDate: '2027-01-15',
  },
  openMaintenanceOrder: {
    id: 'order-1',
    status: 'EN_PROVEEDOR',
    providerId: 'provider-1',
    workshopLocationId: null,
    openedAt: '2026-11-05T09:00:00.000Z',
    expectedReturnDate: '2026-11-20',
  },
};

class ApiStub {
  get = vi.fn<(id: string) => Observable<ExtinguisherDetail>>();
}

class PermissionsStub {
  has = vi.fn<(permission: string) => boolean>(() => false);
}

function setup(
  options: {
    permissions?: string[];
    query?: Record<string, string>;
    detail?: ExtinguisherDetail;
  } = {},
): {
  fixture: ComponentFixture<ExtinguisherDetailPage>;
  page: ExtinguisherDetailPage;
  api: ApiStub;
  router: Router;
} {
  const api = new ApiStub();
  api.get.mockReturnValue(of(options.detail ?? DETAIL));

  const allowed = new Set(options.permissions ?? []);
  const permissions = new PermissionsStub();
  permissions.has.mockImplementation((permission: string) =>
    allowed.has(permission),
  );

  const route = {
    snapshot: {
      paramMap: convertToParamMap({ id: 'ext-1' }),
      queryParamMap: convertToParamMap(options.query ?? {}),
    },
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    imports: [ExtinguisherDetailPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: PermissionService, useValue: permissions },
      { provide: ActivatedRoute, useValue: route },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ExtinguisherDetailPage);
  fixture.detectChanges();

  return { fixture, page: fixture.componentInstance, api, router };
}

function text(fixture: ComponentFixture<ExtinguisherDetailPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('ExtinguisherDetailPage', () => {
  it('muestra la ficha completa con fechas, inspección y orden abierta', () => {
    const { fixture } = setup();

    const content = text(fixture);
    expect(content).toContain('EXT-000001');
    expect(content).toContain('Asignado');
    expect(content).toContain('Operativo');
    expect(content).toContain('Área de Desarrollo (UBI-000003)');
    expect(content).toContain('4 movimientos registrados.');
    expect(content).toContain('Ana Torres');
    expect(content).toContain('Aprobado con observaciones');
    expect(content).toContain('En proveedor');
    expect(content).toContain('Revisar señalización del gabinete.');
    expect(content).toContain('Próxima inspección');
  });

  it('solo ofrece acciones para las que hay permiso', () => {
    const { fixture, page } = setup({
      permissions: ['extinguishers.read'],
    });

    expect(page.canEdit()).toBe(false);
    expect(page.canChangeCondition()).toBe(false);
    expect(text(fixture)).not.toContain('Editar datos');
    expect(text(fixture)).not.toContain('Cambiar condición');
  });

  it('muestra las acciones y el aviso de alta reciente', () => {
    const { fixture, router } = setup({
      permissions: ['extinguishers.update', 'extinguishers.condition'],
      query: { created: 'true' },
    });

    const content = text(fixture);
    expect(content).toContain('Editar datos');
    expect(content).toContain('Cambiar condición');
    expect(content).toContain('Extintor registrado correctamente.');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ replaceUrl: true, queryParams: {} }),
    );
  });

  it('muestra el error traducido y permite reintentar', () => {
    const { fixture, page, api } = setup();
    api.get.mockReturnValue(
      throwError(
        () =>
          new ApiClientError(
            500,
            'INTERNAL_ERROR',
            'Fallo interno',
            undefined,
            'req-9',
          ),
      ),
    );

    page.retry();
    fixture.detectChanges();

    const content = text(fixture);
    expect(content).toContain('El servidor no pudo completar la operación');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'button.site-button--secondary',
      ),
    ).not.toBeNull();
  });
});
