import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { ExtinguishersApi } from './extinguishers.api';
import {
  ExtinguisherFilters,
  defaultExtinguisherFilters,
} from './extinguisher.models';

function filters(
  overrides: Partial<ExtinguisherFilters> = {},
): ExtinguisherFilters {
  return { ...defaultExtinguisherFilters(), ...overrides };
}

function setup(): {
  service: ExtinguishersApi;
  get: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn(() => of({ data: [], meta: {} }));
  TestBed.configureTestingModule({
    providers: [
      ExtinguishersApi,
      { provide: ApiClient, useValue: { get } },
    ],
  });
  return { service: TestBed.inject(ExtinguishersApi), get };
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
});
