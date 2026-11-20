import { Inject, Injectable } from '@nestjs/common';
import {
  DueDateEventType,
  LocationType,
  LogisticsStatus,
  MaintenanceOrderStatus,
  PlacementType,
  TechnicalCondition,
} from '@prisma/client';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertStatusCounts, localToday } from '../alerts/alert-policy';

const OPERATIONAL_STATUSES: readonly LogisticsStatus[] = [
  'EN_ALMACEN',
  'ASIGNADO',
  'EN_MANTENIMIENTO',
];

const ALL_STATUSES: readonly LogisticsStatus[] = [
  ...OPERATIONAL_STATUSES,
  'DADO_DE_BAJA',
];

const ALL_CONDITIONS: readonly TechnicalCondition[] = [
  'OPERATIVO',
  'OBSERVADO',
  'NO_OPERATIVO',
  'PENDIENTE_INSPECCION',
];

const ALL_PLACEMENTS: readonly PlacementType[] = [
  'INTERNAL',
  'EXTERNAL',
  'NONE',
];

const OPEN_ORDER_STATUSES: readonly MaintenanceOrderStatus[] = [
  'ABIERTA',
  'EN_PROVEEDOR',
];

export interface DashboardLocationCount {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  count: number;
}

export interface DashboardSummary {
  generatedAt: string;
  assets: {
    operationalTotal: number;
    retiredTotal: number;
    byLogisticsStatus: Record<LogisticsStatus, number>;
    byTechnicalCondition: Record<TechnicalCondition, number>;
    byPlacement: Record<PlacementType, number>;
    byLocation: DashboardLocationCount[];
    withoutLocation: number;
  };
  maintenance: {
    openOrders: number;
    byStatus: Record<MaintenanceOrderStatus, number>;
    overdueReturns: number;
  };
  alerts: {
    totals: AlertStatusCounts;
    byEventType: Array<{
      eventType: DueDateEventType;
      counts: AlertStatusCounts;
      total: number;
    }>;
  };
}

function zeroFilled<T extends string>(keys: readonly T[]): Record<T, number> {
  return keys.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<T, number>,
  );
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async summary(): Promise<DashboardSummary> {
    const operationalWhere = {
      logisticsStatus: { not: 'DADO_DE_BAJA' as const },
    };
    const today = localToday(new Date(), this.env.timezone);

    const [
      statusGroups,
      conditionGroups,
      placementGroups,
      locationGroups,
      withoutLocation,
      retiredTotal,
      orderGroups,
      overdueReturns,
      alerts,
    ] = await Promise.all([
      this.prisma.extinguisher.groupBy({
        by: ['logisticsStatus'],
        where: operationalWhere,
        _count: { _all: true },
      }),
      this.prisma.extinguisher.groupBy({
        by: ['technicalCondition'],
        where: operationalWhere,
        _count: { _all: true },
      }),
      this.prisma.extinguisher.groupBy({
        by: ['placementType'],
        where: operationalWhere,
        _count: { _all: true },
      }),
      this.prisma.extinguisher.groupBy({
        by: ['currentLocationId'],
        where: {
          ...operationalWhere,
          currentLocationId: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.extinguisher.count({
        where: {
          ...operationalWhere,
          currentLocationId: null,
        },
      }),
      this.prisma.extinguisher.count({
        where: { logisticsStatus: 'DADO_DE_BAJA' },
      }),
      this.prisma.maintenanceOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.maintenanceOrder.count({
        where: {
          status: { in: [...OPEN_ORDER_STATUSES] },
          expectedReturnDate: { lt: today },
        },
      }),
      this.alertsService.summary({}),
    ]);

    const byLogisticsStatus = zeroFilled(ALL_STATUSES);
    for (const group of statusGroups) {
      byLogisticsStatus[group.logisticsStatus] = group._count._all;
    }
    byLogisticsStatus.DADO_DE_BAJA = retiredTotal;

    const byTechnicalCondition = zeroFilled(ALL_CONDITIONS);
    for (const group of conditionGroups) {
      byTechnicalCondition[group.technicalCondition] = group._count._all;
    }

    const byPlacement = zeroFilled(ALL_PLACEMENTS);
    for (const group of placementGroups) {
      byPlacement[group.placementType] = group._count._all;
    }

    const locationIds = locationGroups
      .map((group) => group.currentLocationId)
      .filter((id): id is string => id !== null);
    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, code: true, name: true, type: true },
    });
    const locationById = new Map(locations.map((row) => [row.id, row]));
    const byLocation: DashboardLocationCount[] = [];
    for (const group of locationGroups) {
      const location =
        group.currentLocationId === null
          ? undefined
          : locationById.get(group.currentLocationId);
      if (location === undefined) {
        continue;
      }
      byLocation.push({
        id: location.id,
        code: location.code,
        name: location.name,
        type: location.type,
        count: group._count._all,
      });
    }
    byLocation.sort(
      (left, right) =>
        right.count - left.count || left.code.localeCompare(right.code),
    );

    const byStatus = zeroFilled([
      ...OPEN_ORDER_STATUSES,
      'CERRADA',
      'CANCELADA',
    ] as const);
    for (const group of orderGroups) {
      byStatus[group.status] = group._count._all;
    }

    const operationalTotal = OPERATIONAL_STATUSES.reduce(
      (total, status) => total + byLogisticsStatus[status],
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      assets: {
        operationalTotal,
        retiredTotal,
        byLogisticsStatus,
        byTechnicalCondition,
        byPlacement,
        byLocation,
        withoutLocation,
      },
      maintenance: {
        openOrders: OPEN_ORDER_STATUSES.reduce(
          (total, status) => total + byStatus[status],
          0,
        ),
        byStatus,
        overdueReturns,
      },
      alerts: {
        totals: alerts.totals,
        byEventType: alerts.data,
      },
    };
  }
}
