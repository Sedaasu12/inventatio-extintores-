import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { ExtinguishersApi } from './extinguishers.api';
import {
  ChangeConditionPayload,
  CreateExtinguisherPayload,
  ExtinguisherFilters,
  UpdateExtinguisherPayload,
  defaultExtinguisherFilters,
} from './extinguisher.models';

const CREATE_PAYLOAD: CreateExtinguisherPayload = {
  serialNumber: 'SN-001',
  typeId: 'type-1',
  brand: 'Marca',
  model: 'Modelo',
  capacityValue: 6,
  capacityUnit: 'KG',
  manufactureDate: null,
  acquiredAt: null,
  commissionedAt: null,
  manufacturerExpiryDate: null,
  initialLocationId: 'loc-1',
  entrySource: 'COMPRA_LOCAL',
  initialReason: 'Ingreso inicial de prueba',
  receivedBy: 'Recepción',
  documentRef: 'ACTA-1',
  technicalCondition: 'OPERATIVO',
  notes: null,
};

const UPDATE_PAYLOAD: UpdateExtinguisherPayload = {
  serialNumber: 'SN-002',
  typeId: 'type-1',
  brand: 'Marca',
  model: 'Modelo',
  capacityValue: 6,
  capacityUnit: 'KG',
  manufactureDate: null,
  acquiredAt: null,
  commissionedAt: null,
  manufacturerExpiryDate: null,
  notes: null,
  rowVersion: 2,
};

const CONDITION_PAYLOAD: ChangeConditionPayload = {
  condition: 'OBSERVADO',
  reason: 'Hallazgo en inspección visual',
  documentRef: null,
  rowVersion: 2,
};

function filters(
  overrides: Partial<ExtinguisherFilters> = {},
): ExtinguisherFilters {
  return { ...defaultExtinguisherFilters(), ...overrides };
}

function setup(): {
  service: ExtinguishersApi;
  get: ReturnType<typeof vi.fn>;
  getBlob: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn(() => of({ data: [], meta: {} }));
  const getBlob = vi.fn(() => of(new Blob(['qr'])));
  const post = vi.fn(() => of({}));
  const patch = vi.fn(() => of({}));
  TestBed.configureTestingModule({
    providers: [
      ExtinguishersApi,
      { provide: ApiClient, useValue: { get, getBlob, post, patch } },
    ],
  });
  return { service: TestBed.inject(ExtinguishersApi), get, getBlob, post, patch };
}

function subscribe(observable: Observable<unknown>): void {
  observable.subscribe();
}

describe('ExtinguishersApi', () => {
  it('envía la paginación y solo los filtros informados', () => {
    const { service, get } = setup();

    subscribe(service.list(filters({ q: 'EXT-1', page: 2 }), false));

    expect(get).toHaveBeenCalledWith('/extinguishers', {
      params: {
        page: 2,
        pageSize: 20,
        q: 'EXT-1',
        typeId: undefined,
        locationId: undefined,
        includeDescendants: undefined,
        logisticsStatus: undefined,
        technicalCondition: undefined,
        includeRetired: undefined,
        sort: 'assetCode',
      },
    });
  });

  it('pide descendientes al filtrar por ubicación', () => {
    const { service, get } = setup();

    subscribe(
      service.list(
        filters({
          locationId: 'sede-1',
          logisticsStatus: 'ASIGNADO',
          technicalCondition: 'OPERATIVO',
          includeRetired: true,
          sort: '-assetCode',
        }),
        true,
      ),
    );

    expect(get).toHaveBeenCalledWith('/extinguishers', {
      params: expect.objectContaining({
        locationId: 'sede-1',
        includeDescendants: true,
        logisticsStatus: 'ASIGNADO',
        technicalCondition: 'OPERATIVO',
        includeRetired: true,
        sort: '-assetCode',
      }),
    });
  });

  it('consulta solo catálogos activos', () => {
    const { service, get } = setup();

    subscribe(service.types());
    expect(get).toHaveBeenCalledWith('/extinguisher-types', {
      params: { active: 'true', pageSize: 100 },
    });

    subscribe(service.locations());
    expect(get).toHaveBeenCalledWith('/locations', {
      params: { tree: true, active: 'true' },
    });
  });

  it('consulta la ficha por identificador', () => {
    const { service, get } = setup();

    subscribe(service.get('ext-1'));

    expect(get).toHaveBeenCalledWith('/extinguishers/ext-1');
  });

  it('resuelve el código escaneado o escrito', () => {
    const { service, get } = setup();

    subscribe(service.getByCode('EXT-000001'));

    expect(get).toHaveBeenCalledWith('/extinguishers/by-code/EXT-000001');
  });

  it('descarga el PNG del QR del activo', () => {
    const { service, getBlob } = setup();

    subscribe(service.qrImage('ext-1'));

    expect(getBlob).toHaveBeenCalledWith('/extinguishers/ext-1/qr', {
      params: { format: 'png', size: 512 },
    });
  });

  it('envía el alta con la clave de idempotencia', () => {
    const { service, post } = setup();

    subscribe(service.create(CREATE_PAYLOAD, 'idem-1'));

    expect(post).toHaveBeenCalledWith('/extinguishers', CREATE_PAYLOAD, {
      headers: { 'Idempotency-Key': 'idem-1' },
    });
  });

  it('actualiza solo los datos técnicos con rowVersion', () => {
    const { service, patch } = setup();

    subscribe(service.update('ext-1', UPDATE_PAYLOAD));

    expect(patch).toHaveBeenCalledWith(
      '/extinguishers/ext-1',
      UPDATE_PAYLOAD,
    );
  });

  it('cambia la condición con motivo y versión', () => {
    const { service, post } = setup();

    subscribe(service.changeCondition('ext-1', CONDITION_PAYLOAD));

    expect(post).toHaveBeenCalledWith(
      '/extinguishers/ext-1/condition',
      CONDITION_PAYLOAD,
    );
  });
});
