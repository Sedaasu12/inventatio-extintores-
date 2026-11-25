import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import {
  QR_SCANNER_PORT,
  QrScannerError,
  QrScannerPort,
} from '../../../core/qr/qr-scanner.port';
import { ExtinguishersApi } from '../../extinguishers/extinguishers.api';
import { ExtinguisherDetail } from '../../extinguishers/extinguisher.models';
import { ScanPage } from './scan-page';

const DETAIL: ExtinguisherDetail = {
  id: 'ext-1',
  assetCode: 'EXT-000001',
  serialNumber: null,
  type: {
    id: 'type-1',
    code: 'PQS-6',
    name: 'Polvo químico seco 6 kg',
    agent: 'PQS',
    nominalCapacity: '6.00',
    capacityUnit: 'KG',
    usefulLifeYears: 10,
  },
  brand: null,
  model: null,
  capacityValue: '6.00',
  capacityUnit: 'KG',
  manufactureDate: null,
  acquiredAt: null,
  commissionedAt: null,
  manufacturerExpiryDate: null,
  logisticsStatus: 'EN_ALMACEN',
  technicalCondition: 'OPERATIVO',
  placementType: 'INTERNAL',
  currentLocation: null,
  currentExternalParty: null,
  currentSince: null,
  retiredAt: null,
  notes: null,
  rowVersion: 1,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  dueDates: [],
  movementCount: 1,
  lastInspection: null,
  openMaintenanceOrder: null,
};

class ApiStub {
  getByCode = vi.fn<(assetCode: string) => Observable<ExtinguisherDetail>>();
}

class ScannerStub implements QrScannerPort {
  private readonly subject = new Subject<string>();
  readonly results$ = this.subject.asObservable();
  start = vi.fn<(video: HTMLVideoElement) => Promise<void>>(
    async () => undefined,
  );
  stop = vi.fn();

  emit(code: string): void {
    this.subject.next(code);
  }
}

function setup(): {
  fixture: ComponentFixture<ScanPage>;
  page: ScanPage;
  api: ApiStub;
  scanner: ScannerStub;
  router: Router;
} {
  const api = new ApiStub();
  api.getByCode.mockReturnValue(of(DETAIL));
  const scanner = new ScannerStub();

  TestBed.configureTestingModule({
    imports: [ScanPage],
    providers: [
      provideRouter([]),
      { provide: ExtinguishersApi, useValue: api },
      { provide: QR_SCANNER_PORT, useValue: scanner },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ScanPage);
  fixture.detectChanges();

  return { fixture, page: fixture.componentInstance, api, scanner, router };
}

function text(fixture: ComponentFixture<ScanPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('ScanPage', () => {
  it('busca el código manual y navega a la ficha', () => {
    const { page, api, router } = setup();

    page.form.patchValue({ assetCode: '  ext-000001 ' });
    page.submitManual();

    expect(api.getByCode).toHaveBeenCalledWith('EXT-000001');
    expect(router.navigate).toHaveBeenCalledWith(['/app/extintores', 'ext-1']);
  });

  it('informa cuando el código no existe y no navega', () => {
    const { fixture, page, api, router } = setup();
    api.getByCode.mockReturnValue(
      throwError(
        () => new ApiClientError(404, 'ASSET_NOT_FOUND', 'No existe'),
      ),
    );

    page.form.patchValue({ assetCode: 'EXT-999999' });
    page.submitManual();
    fixture.detectChanges();

    expect(page.errorMessage()).toContain(
      'No existe un extintor con el código EXT-999999.',
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Escanear otro');
  });

  it('exige un código antes de consultar', () => {
    const { page, api } = setup();

    page.submitManual();

    expect(page.showError()).toBe(true);
    expect(api.getByCode).not.toHaveBeenCalled();
  });

  it('resuelve el texto decodificado por la cámara y la detiene', async () => {
    const { page, api, scanner, router } = setup();

    await page.startCamera();
    expect(page.cameraState()).toBe('scanning');

    scanner.emit('ext-000001');

    expect(scanner.stop).toHaveBeenCalled();
    expect(api.getByCode).toHaveBeenCalledWith('EXT-000001');
    expect(router.navigate).toHaveBeenCalledWith(['/app/extintores', 'ext-1']);
  });

  it('explica que la cámara fue denegada', async () => {
    const { fixture, page, scanner } = setup();
    scanner.start.mockRejectedValue(new QrScannerError('denied'));

    await page.startCamera();
    fixture.detectChanges();

    expect(page.cameraState()).toBe('denied');
    expect(page.cameraWarning()).toBe(true);
    expect(text(fixture)).toContain('Revisa el permiso del navegador');
  });
});
