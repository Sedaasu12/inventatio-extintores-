import { Prisma } from '@prisma/client';
import { formatCalendarDate } from '../../common/time/calendar';

export const MAINTENANCE_SERVICE_SELECT = {
  id: true,
  extinguisherId: true,
  maintenanceOrderId: true,
  serviceType: true,
  performedAt: true,
  performedOn: true,
  performedByUserId: true,
  providerId: true,
  result: true,
  certificateNo: true,
  certificateDate: true,
  nextDueDate: true,
  cost: true,
  currency: true,
  notes: true,
  documentRef: true,
  correctsId: true,
  createdById: true,
  createdAt: true,
  performedByUser: { select: { id: true, fullName: true } },
  provider: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MaintenanceServiceSelect;

export const MAINTENANCE_ORDER_SELECT = {
  id: true,
  extinguisherId: true,
  providerId: true,
  workshopLocationId: true,
  status: true,
  sentMovementId: true,
  returnMovementId: true,
  openedAt: true,
  expectedReturnDate: true,
  closedAt: true,
  reason: true,
  authorizedBy: true,
  documentRef: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  extinguisher: { select: { id: true, assetCode: true } },
  provider: { select: { id: true, code: true, name: true } },
  workshopLocation: {
    select: { id: true, code: true, name: true, type: true },
  },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MaintenanceOrderSelect;

export const MAINTENANCE_ORDER_DETAIL_SELECT = {
  ...MAINTENANCE_ORDER_SELECT,
  services: {
    select: MAINTENANCE_SERVICE_SELECT,
    orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.MaintenanceOrderSelect;

export type MaintenanceServiceRow = Prisma.MaintenanceServiceGetPayload<{
  select: typeof MAINTENANCE_SERVICE_SELECT;
}>;

export type MaintenanceOrderRow = Prisma.MaintenanceOrderGetPayload<{
  select: typeof MAINTENANCE_ORDER_SELECT;
}>;

export type MaintenanceOrderDetailRow = Prisma.MaintenanceOrderGetPayload<{
  select: typeof MAINTENANCE_ORDER_DETAIL_SELECT;
}>;

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export function toMaintenanceServiceView(row: MaintenanceServiceRow) {
  return {
    id: row.id,
    extinguisherId: row.extinguisherId,
    maintenanceOrderId: row.maintenanceOrderId,
    serviceType: row.serviceType,
    performedAt: row.performedAt.toISOString(),
    performedOn: formatCalendarDate(row.performedOn),
    performedByUser: row.performedByUser,
    provider: row.provider,
    result: row.result,
    certificateNo: row.certificateNo,
    certificateDate: formatCalendarDate(row.certificateDate),
    nextDueDate: formatCalendarDate(row.nextDueDate),
    cost: row.cost === null ? null : row.cost.toFixed(2),
    currency: row.currency,
    notes: row.notes,
    documentRef: row.documentRef,
    correctsId: row.correctsId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMaintenanceOrderView(row: MaintenanceOrderRow) {
  return {
    id: row.id,
    extinguisher: row.extinguisher,
    provider: row.provider,
    workshopLocation: row.workshopLocation,
    status: row.status,
    sentMovementId: row.sentMovementId,
    returnMovementId: row.returnMovementId,
    openedAt: row.openedAt.toISOString(),
    expectedReturnDate: formatCalendarDate(row.expectedReturnDate),
    closedAt: iso(row.closedAt),
    reason: row.reason,
    authorizedBy: row.authorizedBy,
    documentRef: row.documentRef,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMaintenanceOrderDetailView(row: MaintenanceOrderDetailRow) {
  return {
    ...toMaintenanceOrderView(row),
    services: row.services.map((service) => toMaintenanceServiceView(service)),
  };
}
