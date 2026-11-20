import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../common/errors/api-error';
import { dateInTimeZone } from '../../common/time/calendar';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ListExtinguishersQueryDto } from '../extinguishers/dto/extinguishers.dto';
import { ExtinguishersService } from '../extinguishers/extinguishers.service';
import { ListInspectionsQueryDto } from '../inspections/dto/inspection.dto';
import { InspectionsService } from '../inspections/inspections.service';
import { ListMaintenanceOrdersQueryDto } from '../maintenance/dto/maintenance.dto';
import {
  MAINTENANCE_ORDER_DETAIL_SELECT,
  toMaintenanceOrderDetailView,
} from '../maintenance/maintenance-view';
import { ListMovementsQueryDto } from '../movements/dto/movements.dto';
import { MOVEMENT_SELECT, toMovementView } from '../movements/movement-view';
import { MovementsService } from '../movements/movements.service';
import { buildCsv, CsvCell } from './csv';
import {
  ExportReportQueryDto,
  ListRetiredReportQueryDto,
} from './dto/reports.dto';

const REPORT_TYPES = [
  'inventory',
  'movements',
  'maintenance',
  'inspections',
  'retired',
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

const EXPORT_LIMIT = 100_000;

const SORT_FIELDS: Record<ReportType, readonly string[]> = {
  inventory: [
    'assetCode',
    '-assetCode',
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
    'serialNumber',
    '-serialNumber',
  ],
  movements: [
    'movedAt',
    '-movedAt',
    'createdAt',
    '-createdAt',
    'assetSequence',
    '-assetSequence',
  ],
  maintenance: [
    'openedAt',
    '-openedAt',
    'expectedReturnDate',
    '-expectedReturnDate',
    'createdAt',
    '-createdAt',
  ],
  inspections: ['inspectedAt', '-inspectedAt', 'createdAt', '-createdAt'],
  retired: ['movedAt', '-movedAt', 'createdAt', '-createdAt'],
};

function assertReportType(value: string): ReportType {
  if ((REPORT_TYPES as readonly string[]).includes(value)) {
    return value as ReportType;
  }
  throw ApiError.notFound(
    'El reporte solicitado no existe. Los reportes disponibles son inventario, movimientos, mantenimiento, inspecciones y bajas.',
  );
}

function pickSort(
  value: string | undefined,
  allowed: readonly string[],
): string | undefined {
  return value !== undefined && allowed.includes(value) ? value : undefined;
}

function calendarBoundary(value: string, endOfDay = false): Date {
  return endOfDay
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(`${value}T00:00:00.000Z`);
}

const INVENTORY_HEADER = [
  'Código de activo',
  'Serie',
  'Tipo',
  'Marca',
  'Modelo',
  'Capacidad',
  'Unidad',
  'Estado logístico',
  'Condición técnica',
  'Colocación',
  'Ubicación',
  'Código de ubicación',
  'Entidad externa',
  'Ubicado desde',
  'Fecha de fabricación',
  'Vencimiento documentado',
  'Dado de baja',
];

const MOVEMENT_HEADER = [
  'Código de activo',
  'Secuencia',
  'Tipo de movimiento',
  'Fecha y hora',
  'Origen',
  'Destino',
  'Solicitado por',
  'Autorizado por',
  'Entregado por',
  'Recibido por',
  'Motivo',
  'Documento',
  'Registrado por',
  'Modo de captura',
];

const MAINTENANCE_HEADER = [
  'Código de activo',
  'Orden',
  'Estado de la orden',
  'Proveedor',
  'Taller',
  'Fecha de apertura',
  'Retorno previsto',
  'Fecha de cierre',
  'Motivo',
  'Tipo de servicio',
  'Realizado en',
  'Resultado',
  'Certificado',
  'Fecha del certificado',
  'Próximo vencimiento',
  'Costo',
  'Moneda',
  'Documento',
];

const INSPECTION_HEADER = [
  'Código de activo',
  'Fecha y hora',
  'Fecha de inspección',
  'Inspector',
  'Resultado',
  'Próximo vencimiento',
  'Documento',
  'Notas',
];

const RETIRED_HEADER = [
  'Código de activo',
  'Tipo',
  'Fecha y hora',
  'Origen',
  'Destino',
  'Motivo',
  'Autorizado por',
  'Solicitado por',
  'Entregado por',
  'Recibido por',
  'Documento',
  'Movimiento corregido',
  'Registrado por',
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extinguishers: ExtinguishersService,
    private readonly movements: MovementsService,
    private readonly inspections: InspectionsService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  inventory(query: ListExtinguishersQueryDto) {
    return this.extinguishers.list(query);
  }

  movementsReport(query: ListMovementsQueryDto) {
    return this.movements.list(query);
  }

  inspectionsReport(query: ListInspectionsQueryDto) {
    return this.inspections.list(query);
  }

  maintenanceReport(query: ListMaintenanceOrdersQueryDto) {
    return this.listMaintenance(query);
  }

  retired(query: ListRetiredReportQueryDto) {
    return this.listRetired(query);
  }

  async export(
    typeValue: string,
    query: ExportReportQueryDto,
  ): Promise<{ filename: string; content: string }> {
    if (query.format !== undefined && query.format.toLowerCase() !== 'csv') {
      throw ApiError.notFound('En el MVP solo se admite el formato CSV.');
    }
    const type = assertReportType(typeValue);
    const { header, rows } = await this.buildExport(type, query);
    const filename = `reporte-${type}-${dateInTimeZone(
      new Date(),
      this.env.timezone,
    )}.csv`;
    return { filename, content: buildCsv(header, rows) };
  }

  private async buildExport(
    type: ReportType,
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    switch (type) {
      case 'inventory':
        return this.exportInventory(query);
      case 'movements':
        return this.exportMovements(query);
      case 'maintenance':
        return this.exportMaintenance(query);
      case 'inspections':
        return this.exportInspections(query);
      case 'retired':
        return this.exportRetired(query);
    }
  }

  private async exportInventory(
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    const result = await this.extinguishers.list({
      page: 1,
      pageSize: EXPORT_LIMIT,
      q: query.q,
      assetCode: query.assetCode,
      serialNumber: query.serialNumber,
      typeId: query.typeId,
      locationId: query.locationId,
      includeDescendants: query.includeDescendants,
      logisticsStatus: query.logisticsStatus,
      technicalCondition: query.technicalCondition,
      includeRetired: query.includeRetired,
      sort: pickSort(query.sort, SORT_FIELDS.inventory),
    });

    return {
      header: INVENTORY_HEADER,
      rows: result.data.map((row) => [
        row.assetCode,
        row.serialNumber,
        row.type.name,
        row.brand,
        row.model,
        row.capacityValue,
        row.capacityUnit,
        row.logisticsStatus,
        row.technicalCondition,
        row.placementType,
        row.currentLocation?.name ?? null,
        row.currentLocation?.code ?? null,
        row.currentExternalParty?.name ?? null,
        row.currentSince,
        row.manufactureDate,
        row.manufacturerExpiryDate,
        row.retiredAt,
      ]),
    };
  }

  private async exportMovements(
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    const result = await this.movements.list({
      page: 1,
      pageSize: EXPORT_LIMIT,
      extinguisherId: query.extinguisherId,
      assetCode: query.assetCode,
      type: query.type,
      locationId: query.locationId,
      from: query.from,
      to: query.to,
      createdById: query.createdById,
      sort: pickSort(query.sort, SORT_FIELDS.movements),
    });

    return {
      header: MOVEMENT_HEADER,
      rows: result.data.map((row) => [
        row.extinguisher.assetCode,
        row.assetSequence,
        row.type,
        row.movedAt,
        row.origin.label,
        row.destination.label,
        row.requestedBy,
        row.authorizedBy,
        row.deliveredBy,
        row.receivedBy,
        row.reason,
        row.documentRef,
        row.createdBy.fullName,
        row.captureMode,
      ]),
    };
  }

  private async exportMaintenance(
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    const result = await this.listMaintenance({
      page: 1,
      pageSize: EXPORT_LIMIT,
      status: query.status,
      providerId: query.providerId,
      workshopLocationId: query.workshopLocationId,
      extinguisherId: query.extinguisherId,
      assetCode: query.assetCode,
      expectedReturnFrom: query.expectedReturnFrom,
      expectedReturnTo: query.expectedReturnTo,
      sort: pickSort(query.sort, SORT_FIELDS.maintenance),
    });

    const rows: CsvCell[][] = [];
    for (const order of result.data) {
      const base: CsvCell[] = [
        order.extinguisher.assetCode,
        order.id,
        order.status,
        order.provider?.name ?? null,
        order.workshopLocation?.name ?? null,
        order.openedAt,
        order.expectedReturnDate,
        order.closedAt,
        order.reason,
      ];
      if (order.services.length === 0) {
        rows.push([...base, null, null, null, null, null, null, null, null]);
        continue;
      }
      for (const service of order.services) {
        rows.push([
          ...base,
          service.serviceType,
          service.performedOn,
          service.result,
          service.certificateNo,
          service.certificateDate,
          service.nextDueDate,
          service.cost,
          service.currency,
          service.documentRef,
        ]);
      }
    }
    return { header: MAINTENANCE_HEADER, rows };
  }

  private async exportInspections(
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    const result = await this.inspections.list({
      page: 1,
      pageSize: EXPORT_LIMIT,
      extinguisherId: query.extinguisherId,
      assetCode: query.assetCode,
      result: query.result,
      inspectedFrom: query.inspectedFrom,
      inspectedTo: query.inspectedTo,
      sort: pickSort(query.sort, SORT_FIELDS.inspections),
    });

    return {
      header: INSPECTION_HEADER,
      rows: result.data.map((row) => [
        row.extinguisher.assetCode,
        row.inspectedAt,
        row.inspectedOn,
        row.inspectorName,
        row.result,
        row.nextDueDate,
        row.documentRef,
        row.notes,
      ]),
    };
  }

  private async exportRetired(
    query: ExportReportQueryDto,
  ): Promise<{ header: string[]; rows: CsvCell[][] }> {
    const type =
      query.type === 'BAJA' || query.type === 'AJUSTE'
        ? query.type
        : query.type === undefined
          ? undefined
          : null;
    if (type === null) {
      return { header: RETIRED_HEADER, rows: [] };
    }

    const result = await this.listRetired({
      page: 1,
      pageSize: EXPORT_LIMIT,
      assetCode: query.assetCode,
      type,
      from: query.from,
      to: query.to,
      sort: pickSort(query.sort, SORT_FIELDS.retired),
    });

    return {
      header: RETIRED_HEADER,
      rows: result.data.map((row) => [
        row.extinguisher.assetCode,
        row.type,
        row.movedAt,
        row.origin.label,
        row.destination.label,
        row.reason,
        row.authorizedBy,
        row.requestedBy,
        row.deliveredBy,
        row.receivedBy,
        row.documentRef,
        row.correctsMovementId,
        row.createdBy.fullName,
      ]),
    };
  }

  private async listMaintenance(query: ListMaintenanceOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.MaintenanceOrderWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.providerId !== undefined) {
      where.providerId = query.providerId;
    }
    if (query.workshopLocationId !== undefined) {
      where.workshopLocationId = query.workshopLocationId;
    }
    if (query.extinguisherId !== undefined) {
      where.extinguisherId = query.extinguisherId;
    }
    if (query.assetCode !== undefined) {
      where.extinguisher = {
        assetCode: { contains: query.assetCode.toUpperCase() },
      };
    }
    if (
      query.expectedReturnFrom !== undefined ||
      query.expectedReturnTo !== undefined
    ) {
      where.expectedReturnDate = {
        ...(query.expectedReturnFrom === undefined
          ? {}
          : { gte: calendarBoundary(query.expectedReturnFrom) }),
        ...(query.expectedReturnTo === undefined
          ? {}
          : { lte: calendarBoundary(query.expectedReturnTo) }),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.maintenanceOrder.findMany({
        where,
        select: MAINTENANCE_ORDER_DETAIL_SELECT,
        orderBy: maintenanceOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.maintenanceOrder.count({ where }),
    ]);

    return {
      data: rows.map((row) => toMaintenanceOrderDetailView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async listRetired(query: ListRetiredReportQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.MovementWhereInput = {
      movementType: {
        in: query.type === undefined ? ['BAJA', 'AJUSTE'] : [query.type],
      },
    };

    if (query.assetCode !== undefined) {
      where.extinguisher = {
        assetCode: { contains: query.assetCode.toUpperCase() },
      };
    }
    if (query.from !== undefined || query.to !== undefined) {
      where.movedAt = {
        ...(query.from === undefined
          ? {}
          : { gte: calendarBoundary(query.from) }),
        ...(query.to === undefined
          ? {}
          : { lte: calendarBoundary(query.to, true) }),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: retiredOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return {
      data: rows.map((row) => toMovementView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

function maintenanceOrderBy(
  sort: string | undefined,
): Prisma.MaintenanceOrderOrderByWithRelationInput {
  const value = sort ?? '-openedAt';
  return value.startsWith('-')
    ? { [value.slice(1)]: 'desc' }
    : { [value]: 'asc' };
}

function retiredOrderBy(
  sort: string | undefined,
): Prisma.MovementOrderByWithRelationInput {
  const value = sort ?? '-movedAt';
  return value.startsWith('-')
    ? { [value.slice(1)]: 'desc' }
    : { [value]: 'asc' };
}
