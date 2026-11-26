import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiClientError } from '../../core/api/api-error';
import { PermissionService } from '../../core/permissions/permission.service';
import { DashboardApi } from './dashboard.api';
import { DashboardPage } from './dashboard-page';
import type { DashboardSummary } from './dashboard.models';

const SUMMARY: DashboardSummary = {
  generatedAt: '2026-11-25T10:30:00.000Z',
  assets: {
    operationalTotal: 12,
    retiredTotal: 2,
    byLogisticsStatus: {
      EN_ALMACEN: 5,
      ASIGNADO: 6,
      EN_MANTENIMIENTO: 1,
      DADO_DE_BAJA: 2,
    },
    byTechnicalCondition: {
      OPERATIVO: 9,
      OBSERVADO: 2,
      NO_OPERATIVO: 1,
      PENDIENTE_INSPECCION: 2,
    },
    byPlacement: { INTERNAL: 8, EXTERNAL: 4, NONE: 2 },
    byLocation: [
      {
        id: 'loc-1',
        code: 'UBI-000003',
        name: 'Área de Desarrollo',
        type: 'AREA',
        count: 4,
      },
    ],
    withoutLocation: 2,
  },
  maintenance: {
    openOrders: 3,
    byStatus: { ABIERTA: 2, EN_PROVEEDOR: 1, CERRADA: 4, CANCELADA: 1 },
    overdueReturns: 1,
  },
  alerts: {
    totals: {
      VENCIDO: 2,
      POR_VENCER: 3,
      VIGENTE: 5,
      SIN_FECHA_CONFIGURADA: 1,
    },
    byEventType: [
      {
        eventType: 'INSPECCION',
        counts: {
          VENCIDO: 1,
          POR_VENCER: 2,
          VIGENTE: 3,
          SIN_FECHA_CONFIGURADA: 0,
        },
        total: 6,
      },
      {
        eventType: 'RECARGA',
        counts: {
          VENCIDO: 1,
          POR_VENCER: 1,
          VIGENTE: 2,
          SIN_FECHA_CONFIGURADA: 1,
        },
        total: 5,
      },
    ],
  },
};

function emptySummary(): DashboardSummary {
  return {
    generatedAt: '2026-11-25T10:30:00.000Z',
    assets: {
      operationalTotal: 0,
      retiredTotal: 0,
      byLogisticsStatus: {
        EN_ALMACEN: 0,
        ASIGNADO: 0,
        EN_MANTENIMIENTO: 0,
        DADO_DE_BAJA: 0,
      },
      byTechnicalCondition: {
        OPERATIVO: 0,
        OBSERVADO: 0,
        NO_OPERATIVO: 0,
        PENDIENTE_INSPECCION: 0,
      },
      byPlacement: { INTERNAL: 0, EXTERNAL: 0, NONE: 0 },
      byLocation: [],
      withoutLocation: 0,
    },
    maintenance: {
      openOrders: 0,
      byStatus: { ABIERTA: 0, EN_PROVEEDOR: 0, CERRADA: 0, CANCELADA: 0 },
      overdueReturns: 0,
    },
    alerts: {
      totals: {
        VENCIDO: 0,
        POR_VENCER: 0,
        VIGENTE: 0,
        SIN_FECHA_CONFIGURADA: 0,
      },
      byEventType: [],
    },
  };
}

class ApiStub {
  summary = vi.fn<() => Observable<DashboardSummary>>();
}

class PermissionsStub {
  allowed = new Set<string>([
    'extinguishers.read',
    'extinguishers.create',
  ]);
  has = vi.fn((permission: string) => this.allowed.has(permission));
}

function setup(
  summary: DashboardSummary = SUMMARY,
  allowed: readonly string[] = [
    'extinguishers.read',
    'extinguishers.create',
  ],
): {
  fixture: ComponentFixture<DashboardPage>;
  page: DashboardPage;
  api: ApiStub;
} {
  const api = new ApiStub();
  api.summary.mockReturnValue(of(summary));
  const permissions = new PermissionsStub();
  permissions.allowed = new Set(allowed);

  TestBed.configureTestingModule({
    imports: [DashboardPage],
    providers: [
      provideRouter([]),
      { provide: DashboardApi, useValue: api },
      { provide: PermissionService, useValue: permissions },
    ],
  });

  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();

  return { fixture, page: fixture.componentInstance, api };
}

function text(fixture: ComponentFixture<DashboardPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('DashboardPage', () => {
  it('muestra los indicadores que devuelve el servidor', () => {
    const { fixture, api } = setup();

    expect(api.summary).toHaveBeenCalledTimes(1);

    const content = text(fixture);
    expect(content).toContain('Bienvenido a SITE');
    expect(content).toContain('Extintores operativos');
    expect(content).toContain('Dados de baja');
    expect(content).toContain('Órdenes abiertas');
    expect(content).toContain('Retornos vencidos');
    expect(content).toContain('En almacén');
    expect(content).toContain('Pendiente de inspección');
    expect(content).toContain('Sin ubicación');
    expect(content).toContain('25/11/2026');
  });

  it('presenta las ubicaciones y las alertas por categoría', () => {
    const { fixture } = setup();

    const content = text(fixture);
    expect(content).toContain('UBI-000003');
    expect(content).toContain('Área de Desarrollo');
    expect(content).toContain('Sin ubicación asignada: 2');
    expect(content).toContain('Próxima inspección');
    expect(content).toContain('Próxima recarga');
    expect(content).toContain('Por vencer');
    expect(content).toContain('Los estados se calculan en el servidor');
  });

  it('muestra el estado vacío sin acciones si faltan permisos', () => {
    const { fixture } = setup(emptySummary(), []);

    const host = fixture.nativeElement as HTMLElement;
    expect(text(fixture)).toContain('Aún no hay extintores');
    expect(host.querySelector('a[href="/app/extintores"]')).toBeNull();
    expect(host.querySelector('a[href="/app/extintores/nuevo"]')).toBeNull();
  });

  it('condiciona los accesos del encabezado a los permisos', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('a[href="/app/extintores"]')).not.toBeNull();
    expect(
      host.querySelector('a[href="/app/extintores/nuevo"]'),
    ).not.toBeNull();
  });

  it('oculta el alta cuando falta el permiso de creación', () => {
    const { fixture } = setup(SUMMARY, ['extinguishers.read']);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('a[href="/app/extintores"]')).not.toBeNull();
    expect(
      host.querySelector('a[href="/app/extintores/nuevo"]'),
    ).toBeNull();
  });

  it('muestra el error traducido y permite reintentar', () => {
    const { fixture, page, api } = setup();
    api.summary.mockReturnValue(
      throwError(
        () => new ApiClientError(500, 'INTERNAL_ERROR', 'Fallo interno'),
      ),
    );

    page.retry();
    fixture.detectChanges();

    expect(text(fixture)).toContain(
      'El servidor no pudo completar la operación',
    );

    api.summary.mockReturnValue(of(SUMMARY));
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button.site-button--secondary',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button?.click();
    fixture.detectChanges();

    expect(api.summary).toHaveBeenCalledTimes(3);
    expect(text(fixture)).toContain('Extintores operativos');
  });
});
