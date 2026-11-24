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
  ChangeConditionPayload,
  ExtinguisherDetail,
} from '../extinguisher.models';
import { ExtinguisherConditionPage } from './extinguisher-condition-page';

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
  manufactureDate: null,
  acquiredAt: null,
  commissionedAt: null,
  manufacturerExpiryDate: null,
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

class ApiStub {
  get = vi.fn<(id: string) => Observable<ExtinguisherDetail>>();
  changeCondition = vi.fn<
    (
      id: string,
      payload: ChangeConditionPayload,
    ) => Observable<ExtinguisherDetail>
  >();
}

function setup(detail: ExtinguisherDetail = DETAIL): {
  fixture: ComponentFixture<ExtinguisherConditionPage>;
  page: ExtinguisherConditionPage;
  api: ApiStub;
  router: Router;
} {
  const api = new ApiStub();
  api.get.mockReturnValue(of(detail));
  api.changeCondition.mockReturnValue(of(detail));

  const route = {
    snapshot: { paramMap: convertToParamMap({ id: 'ext-1' }) },
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    imports: [ExtinguisherConditionPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: ActivatedRoute, useValue: route },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ExtinguisherConditionPage);
  fixture.detectChanges();

  return { fixture, page: fixture.componentInstance, api, router };
}

function text(fixture: ComponentFixture<ExtinguisherConditionPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('ExtinguisherConditionPage', () => {
  it('muestra la condición actual del activo', () => {
    const { fixture } = setup();

    const content = text(fixture);
    expect(content).toContain('EXT-000001');
    expect(content).toContain('Operativo');
    expect(content).toContain('Cambiar condición técnica');
  });

  it('bloquea NO_OPERATIVO cuando el extintor está asignado a un área', () => {
    const { fixture, page, api } = setup();

    page.form.patchValue({
      condition: 'NO_OPERATIVO',
      reason: 'Falla detectada en inspección visual',
    });
    fixture.detectChanges();

    expect(page.isNotAssignable()).toBe(true);
    expect(text(fixture)).toContain(
      'Un extintor asignado a un área no puede marcarse como no operativo.',
    );

    page.submit();
    expect(api.changeCondition).not.toHaveBeenCalled();
  });

  it('registra el cambio con motivo, referencia y versión, y vuelve a la ficha', () => {
    const { page, api, router } = setup();

    page.form.patchValue({
      condition: 'OBSERVADO',
      reason: '  Manómetro fuera de rango  ',
      documentRef: 'ACTA-77',
    });
    page.submit();

    expect(api.changeCondition).toHaveBeenCalledWith('ext-1', {
      condition: 'OBSERVADO',
      reason: 'Manómetro fuera de rango',
      documentRef: 'ACTA-77',
      rowVersion: 3,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/app/extintores', 'ext-1'], {
      queryParams: { conditionUpdated: 'true' },
    });
  });

  it('ofrece recargar cuando el registro cambió en otro equipo', () => {
    const { page, api } = setup();
    api.changeCondition.mockReturnValue(
      throwError(
        () =>
          new ApiClientError(
            409,
            'CONCURRENCY_CONFLICT',
            'El registro cambió',
          ),
      ),
    );

    page.form.patchValue({
      condition: 'OBSERVADO',
      reason: 'Manómetro fuera de rango',
    });
    page.submit();

    expect(page.showReload()).toBe(true);
    expect(page.errorMessage()).toContain(
      'Otro usuario modificó este registro',
    );
  });
});
