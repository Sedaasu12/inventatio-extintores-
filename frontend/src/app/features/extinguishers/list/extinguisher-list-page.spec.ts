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
import {
  ExtinguisherFilters,
  ExtinguisherListResponse,
  ExtinguisherSummary,
  ExtinguisherTypeListResponse,
  LocationTreeResponse,
} from '../extinguisher.models';
import { ExtinguisherListPage } from './extinguisher-list-page';

const ITEM: ExtinguisherSummary = {
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
  manufactureDate: null,
  acquiredAt: null,
  commissionedAt: null,
  manufacturerExpiryDate: null,
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
  notes: null,
  rowVersion: 1,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-02T12:00:00.000Z',
};

const LIST_RESPONSE: ExtinguisherListResponse = {
  data: [ITEM],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const TYPES_RESPONSE: ExtinguisherTypeListResponse = {
  data: [
    { id: 'type-1', code: 'PQS-6', name: 'Polvo químico seco 6 kg', active: true },
  ],
  meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
};

const LOCATIONS_RESPONSE: LocationTreeResponse = {
  data: [
    {
      id: 'sede-1',
      code: 'UBI-000001',
      name: 'Sede Central',
      type: 'SEDE',
      parentId: null,
      address: null,
      active: true,
      children: [
        {
          id: 'loc-1',
          code: 'UBI-000003',
          name: 'Área de Desarrollo',
          type: 'AREA',
          parentId: 'sede-1',
          address: null,
          active: true,
          children: [],
        },
      ],
    },
  ],
};

class ApiStub {
  list = vi.fn<
    (
      filters: ExtinguisherFilters,
      includeDescendants: boolean,
    ) => Observable<ExtinguisherListResponse>
  >();
  types = vi.fn<() => Observable<ExtinguisherTypeListResponse>>();
  locations = vi.fn<() => Observable<LocationTreeResponse>>();
}

class PermissionsStub {
  has = vi.fn(() => true);
}

function setup(
  params: Record<string, string> = {},
): {
  fixture: ComponentFixture<ExtinguisherListPage>;
  page: ExtinguisherListPage;
  api: ApiStub;
  router: Router;
} {
  const api = new ApiStub();
  api.list.mockReturnValue(of(LIST_RESPONSE));
  api.types.mockReturnValue(of(TYPES_RESPONSE));
  api.locations.mockReturnValue(of(LOCATIONS_RESPONSE));

  const route = {
    queryParamMap: of(convertToParamMap(params)),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    imports: [ExtinguisherListPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: PermissionService, useValue: new PermissionsStub() },
      { provide: ActivatedRoute, useValue: route },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ExtinguisherListPage);
  fixture.detectChanges();

  return {
    fixture,
    page: fixture.componentInstance,
    api,
    router,
  };
}

function text(fixture: ComponentFixture<ExtinguisherListPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('ExtinguisherListPage', () => {
  it('lee los filtros de la URL y muestra los activos con su estado', () => {
    const { fixture, api } = setup({
      page: '2',
      logisticsStatus: 'ASIGNADO',
      includeRetired: 'true',
    });

    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        logisticsStatus: 'ASIGNADO',
        includeRetired: true,
      }),
      false,
    );

    const content = text(fixture);
    expect(content).toContain('EXT-000001');
    expect(content).toContain('Asignado');
    expect(content).toContain('Operativo');
    expect(content).toContain('Mostrando 1 de 1 extintores.');
  });

  it('aplica los filtros del formulario y vuelve a la primera página', () => {
    const { page, router, api } = setup({ page: '3' });

    page.form.setValue({
      q: '  ext-9 ',
      typeId: 'type-1',
      locationId: '',
      logisticsStatus: 'EN_MANTENIMIENTO',
      technicalCondition: '',
      includeRetired: false,
      sort: 'assetCode',
    });
    page.applyFilters();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          q: 'ext-9',
          typeId: 'type-1',
          logisticsStatus: 'EN_MANTENIMIENTO',
        },
      }),
    );
    expect(api.types).toHaveBeenCalled();
    expect(api.locations).toHaveBeenCalled();
  });

  it('muestra el error traducido y permite reintentar', () => {
    const { fixture, page, api } = setup();
    api.list.mockReturnValue(
      throwError(
        () => new ApiClientError(500, 'INTERNAL_ERROR', 'Fallo interno'),
      ),
    );

    page.retry();
    fixture.detectChanges();

    expect(text(fixture)).toContain(
      'El servidor no pudo completar la operación',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'button.site-button--secondary',
      ),
    ).not.toBeNull();
  });
});
