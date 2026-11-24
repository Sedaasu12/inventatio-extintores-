import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import { ExtinguishersApi } from '../extinguishers.api';
import {
  CreateExtinguisherPayload,
  CreateExtinguisherResponse,
  ExtinguisherDetail,
  ExtinguisherTypeListResponse,
  LocationTreeResponse,
  UpdateExtinguisherPayload,
} from '../extinguisher.models';
import { ExtinguisherFormPage } from './extinguisher-form-page';

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
    id: 'loc-3',
    code: 'UBI-000003',
    name: 'Área de Desarrollo',
    type: 'AREA',
    parentId: 'sede-1',
  },
  currentExternalParty: null,
  currentSince: '2026-11-01T12:00:00.000Z',
  retiredAt: null,
  notes: null,
  rowVersion: 3,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-02T12:00:00.000Z',
  dueDates: [],
  movementCount: 1,
  lastInspection: null,
  openMaintenanceOrder: null,
};

const TYPES_RESPONSE: ExtinguisherTypeListResponse = {
  data: [
    {
      id: 'type-1',
      code: 'PQS-6',
      name: 'Polvo químico seco 6 kg',
      nominalCapacity: '6.00',
      capacityUnit: 'KG',
      usefulLifeYears: 10,
      active: true,
    },
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
          id: 'loc-2',
          code: 'UBI-000002',
          name: 'Almacén Central',
          type: 'ALMACEN',
          parentId: 'sede-1',
          address: null,
          active: true,
          children: [],
        },
        {
          id: 'loc-3',
          code: 'UBI-000003',
          name: 'Área de Desarrollo',
          type: 'AREA',
          parentId: 'sede-1',
          address: null,
          active: true,
          children: [],
        },
        {
          id: 'loc-4',
          code: 'UBI-000004',
          name: 'Taller interno',
          type: 'TALLER',
          parentId: 'sede-1',
          address: null,
          active: true,
          children: [],
        },
      ],
    },
  ],
};

const CREATE_RESPONSE: CreateExtinguisherResponse = {
  id: 'ext-2',
  assetCode: 'EXT-000002',
  qrPayload: 'EXT-000002',
  extinguisher: { ...DETAIL, id: 'ext-2', assetCode: 'EXT-000002' },
  movement: {
    id: 'mov-1',
    type: 'INGRESO',
    assetSequence: 1,
    movedAt: '2026-11-10T12:00:00.000Z',
  },
};

class ApiStub {
  types = vi.fn<() => Observable<ExtinguisherTypeListResponse>>();
  locations = vi.fn<() => Observable<LocationTreeResponse>>();
  get = vi.fn<(id: string) => Observable<ExtinguisherDetail>>();
  create = vi.fn<
    (
      payload: CreateExtinguisherPayload,
      key: string,
    ) => Observable<CreateExtinguisherResponse>
  >();
  update = vi.fn<
    (id: string, payload: UpdateExtinguisherPayload) => Observable<ExtinguisherDetail>
  >();
}

function setup(mode: 'create' | 'edit'): {
  fixture: ComponentFixture<ExtinguisherFormPage>;
  page: ExtinguisherFormPage;
  api: ApiStub;
  router: Router;
} {
  const api = new ApiStub();
  api.types.mockReturnValue(of(TYPES_RESPONSE));
  api.locations.mockReturnValue(of(LOCATIONS_RESPONSE));
  api.get.mockReturnValue(of(DETAIL));
  api.create.mockReturnValue(of(CREATE_RESPONSE));
  api.update.mockReturnValue(of(DETAIL));

  const route = {
    snapshot: {
      data: { mode },
      paramMap: convertToParamMap({ id: 'ext-1' }),
    },
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    imports: [ExtinguisherFormPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: ActivatedRoute, useValue: route },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ExtinguisherFormPage);
  fixture.detectChanges();

  return { fixture, page: fixture.componentInstance, api, router };
}

function fillCreateForm(
  page: ExtinguisherFormPage,
  overrides: Record<string, unknown> = {},
): void {
  page.form.patchValue({
    typeId: 'type-1',
    capacityValue: '6',
    capacityUnit: 'KG',
    serialNumber: 'SN-100',
    brand: '',
    model: '',
    manufactureDate: '',
    acquiredAt: '',
    commissionedAt: '',
    manufacturerExpiryDate: '',
    initialLocationId: 'loc-2',
    entrySource: 'COMPRA_LOCAL',
    initialReason: 'Ingreso inicial de prueba',
    receivedBy: 'Recepción',
    documentRef: 'ACTA-100',
    technicalCondition: 'OPERATIVO',
    notes: '',
    ...overrides,
  });
}

describe('ExtinguisherFormPage', () => {
  it('carga catálogos y solo ofrece almacenes y áreas como ubicación', () => {
    const { page } = setup('create');

    const groups = page.locationGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].options.map((option) => option.type)).toEqual([
      'ALMACEN',
      'AREA',
    ]);
  });

  it('completa capacidad y unidad al elegir el tipo', () => {
    const { page } = setup('create');

    page.onTypeChange({
      target: { value: 'type-1' },
    } as unknown as Event);

    expect(page.form.controls.capacityValue.value).toBe('6.00');
    expect(page.form.controls.capacityUnit.value).toBe('KG');
  });

  it('registra el alta con la clave de idempotencia y navega a la ficha', () => {
    const { page, api, router } = setup('create');
    fillCreateForm(page);

    page.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    const [payload, key] = api.create.mock.calls[0];
    expect(payload).toMatchObject({
      serialNumber: 'SN-100',
      typeId: 'type-1',
      capacityValue: 6,
      capacityUnit: 'KG',
      initialLocationId: 'loc-2',
      entrySource: 'COMPRA_LOCAL',
      initialReason: 'Ingreso inicial de prueba',
      receivedBy: 'Recepción',
      documentRef: 'ACTA-100',
      technicalCondition: 'OPERATIVO',
      notes: null,
    });
    expect(key).not.toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/app/extintores', 'ext-2'], {
      queryParams: { created: 'true' },
    });
  });

  it('reutiliza la clave al reintentar sin cambios y la renueva si cambia el alta', () => {
    const { page, api } = setup('create');
    api.create.mockReturnValue(
      throwError(
        () => new ApiClientError(500, 'INTERNAL_ERROR', 'Fallo interno'),
      ),
    );
    fillCreateForm(page);

    page.submit();
    page.submit();
    page.form.patchValue({ serialNumber: 'SN-101' });
    page.submit();

    const keys = api.create.mock.calls.map(([, key]) => key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('impide dar de alta un extintor no operativo en un área', () => {
    const { page, api } = setup('create');
    fillCreateForm(page, {
      initialLocationId: 'loc-3',
      technicalCondition: 'NO_OPERATIVO',
    });

    expect(page.isCreateConditionNotAssignable()).toBe(true);
    page.submit();

    expect(api.create).not.toHaveBeenCalled();
  });

  it('en edición deshabilita los campos de ingreso y envía rowVersion', () => {
    const { page, api } = setup('edit');

    expect(page.form.controls.initialLocationId.disabled).toBe(true);
    expect(page.form.controls.entrySource.disabled).toBe(true);
    expect(page.form.controls.technicalCondition.disabled).toBe(true);

    page.submit();

    expect(api.update).toHaveBeenCalledTimes(1);
    const [id, payload] = api.update.mock.calls[0];
    expect(id).toBe('ext-1');
    expect(payload).toMatchObject({
      typeId: 'type-1',
      capacityValue: 6,
      capacityUnit: 'KG',
      rowVersion: 3,
    });
    expect(payload).not.toHaveProperty('initialLocationId');
  });

  it('en edición ofrece recargar cuando otro usuario cambió el registro', () => {
    const { page, api } = setup('edit');
    api.update.mockReturnValue(
      throwError(
        () =>
          new ApiClientError(
            409,
            'CONCURRENCY_CONFLICT',
            'El registro cambió',
          ),
      ),
    );

    page.submit();

    expect(page.showReload()).toBe(true);
    expect(page.errorMessage()).toContain(
      'Otro usuario modificó este registro',
    );
  });
});
