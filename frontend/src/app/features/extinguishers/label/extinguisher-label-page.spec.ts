import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import { ExtinguishersApi } from '../extinguishers.api';
import { ExtinguisherDetail } from '../extinguisher.models';
import { ExtinguisherLabelPage } from './extinguisher-label-page';

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
  notes: null,
  rowVersion: 3,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-02T12:00:00.000Z',
  dueDates: [],
  movementCount: 4,
  lastInspection: null,
  openMaintenanceOrder: null,
};

class ApiStub {
  get = vi.fn<(id: string) => Observable<ExtinguisherDetail>>();
  qrImage = vi.fn<(id: string) => Observable<Blob>>();
}

function setup(
  options: { id?: string; detail?: ExtinguisherDetail } = {},
): {
  fixture: ComponentFixture<ExtinguisherLabelPage>;
  page: ExtinguisherLabelPage;
  api: ApiStub;
  createObjectUrl: ReturnType<typeof vi.fn>;
  revokeObjectUrl: ReturnType<typeof vi.fn>;
} {
  const api = new ApiStub();
  api.get.mockReturnValue(of(options.detail ?? DETAIL));
  api.qrImage.mockReturnValue(of(new Blob(['qr'], { type: 'image/png' })));

  const createObjectUrl = vi.fn(() => 'blob:qr-ext-1');
  const revokeObjectUrl = vi.fn();
  URL.createObjectURL = createObjectUrl;
  URL.revokeObjectURL = revokeObjectUrl;

  const route = {
    snapshot: {
      paramMap: convertToParamMap({ id: options.id ?? 'ext-1' }),
    },
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    imports: [ExtinguisherLabelPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: ActivatedRoute, useValue: route },
    ],
  });

  const fixture = TestBed.createComponent(ExtinguisherLabelPage);
  fixture.detectChanges();

  return {
    fixture,
    page: fixture.componentInstance,
    api,
    createObjectUrl,
    revokeObjectUrl,
  };
}

function element(fixture: ComponentFixture<ExtinguisherLabelPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function text(fixture: ComponentFixture<ExtinguisherLabelPage>): string {
  return element(fixture).textContent ?? '';
}

describe('ExtinguisherLabelPage', () => {
  it('muestra el código y el tipo, y pinta el QR descargado', () => {
    const { fixture, api, createObjectUrl } = setup();

    expect(api.get).toHaveBeenCalledWith('ext-1');
    expect(api.qrImage).toHaveBeenCalledWith('ext-1');
    expect(createObjectUrl).toHaveBeenCalled();

    const content = text(fixture);
    expect(content).toContain('EXT-000001');
    expect(content).toContain('Polvo químico seco 6 kg (PQS-6)');
    expect(content).toContain('Escanee para identificar el extintor');

    const image = element(fixture).querySelector<HTMLImageElement>(
      'img.label-card__qr',
    );
    expect(image).not.toBeNull();
    expect(image?.src).toContain('blob:qr-ext-1');
    expect(image?.alt).toBe('Código QR del extintor EXT-000001');
  });

  it('no expone ubicación, fechas ni datos del responsable en la etiqueta', () => {
    const { fixture } = setup();

    const content = text(fixture);
    expect(content).not.toContain('Área de Desarrollo');
    expect(content).not.toContain('UBI-000003');
    expect(content).not.toContain('2024-01-15');
  });

  it('imprime con el botón de la etiqueta', () => {
    const { fixture } = setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const button = Array.from(
      element(fixture).querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => candidate.textContent?.includes('Imprimir etiqueta'));
    button?.click();

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('muestra el error traducido y reintenta la carga', () => {
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

    expect(text(fixture)).toContain(
      'El servidor no pudo completar la operación',
    );

    api.get.mockReturnValue(of(DETAIL));
    const retry = element(fixture).querySelector<HTMLButtonElement>(
      'button.site-button--secondary',
    );
    retry?.click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('EXT-000001');
  });

  it('libera el object URL al destruir la página', () => {
    const { fixture, revokeObjectUrl } = setup();

    fixture.destroy();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:qr-ext-1');
  });
});
