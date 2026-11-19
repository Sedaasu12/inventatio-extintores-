import { Prisma } from '@prisma/client';
import { formatCalendarDate } from './extinguisher-dates';

export const EXTINGUISHER_BASE_SELECT = {
  id: true,
  assetCode: true,
  serialNumber: true,
  typeId: true,
  brand: true,
  model: true,
  capacityValue: true,
  capacityUnit: true,
  manufactureDate: true,
  acquiredAt: true,
  commissionedAt: true,
  manufacturerExpiryDate: true,
  logisticsStatus: true,
  technicalCondition: true,
  placementType: true,
  currentLocationId: true,
  currentExternalPartyId: true,
  currentSince: true,
  retiredAt: true,
  notes: true,
  rowVersion: true,
  createdAt: true,
  updatedAt: true,
  type: {
    select: {
      id: true,
      code: true,
      name: true,
      agent: true,
      nominalCapacity: true,
      capacityUnit: true,
      usefulLifeYears: true,
    },
  },
  currentLocation: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      parentId: true,
    },
  },
  currentExternalParty: {
    select: { id: true, code: true, name: true },
  },
} satisfies Prisma.ExtinguisherSelect;

export const EXTINGUISHER_DETAIL_SELECT = {
  ...EXTINGUISHER_BASE_SELECT,
  dueDates: {
    select: {
      eventType: true,
      dueDate: true,
      sourceType: true,
      sourceId: true,
      updatedAt: true,
    },
    orderBy: { eventType: 'asc' },
  },
  _count: { select: { movements: true } },
  inspections: {
    select: {
      id: true,
      inspectedAt: true,
      inspectedOn: true,
      inspectorName: true,
      result: true,
      nextDueDate: true,
    },
    orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  },
  maintenanceOrders: {
    where: { status: { in: ['ABIERTA', 'EN_PROVEEDOR'] } },
    select: {
      id: true,
      status: true,
      providerId: true,
      workshopLocationId: true,
      openedAt: true,
      expectedReturnDate: true,
    },
    take: 1,
  },
} satisfies Prisma.ExtinguisherSelect;

export type ExtinguisherBaseRow = Prisma.ExtinguisherGetPayload<{
  select: typeof EXTINGUISHER_BASE_SELECT;
}>;

export type ExtinguisherDetailRow = Prisma.ExtinguisherGetPayload<{
  select: typeof EXTINGUISHER_DETAIL_SELECT;
}>;

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export function toExtinguisherView(row: ExtinguisherBaseRow) {
  return {
    id: row.id,
    assetCode: row.assetCode,
    serialNumber: row.serialNumber,
    type: {
      id: row.type.id,
      code: row.type.code,
      name: row.type.name,
      agent: row.type.agent,
      nominalCapacity: row.type.nominalCapacity.toFixed(2),
      capacityUnit: row.type.capacityUnit,
      usefulLifeYears: row.type.usefulLifeYears,
    },
    brand: row.brand,
    model: row.model,
    capacityValue: row.capacityValue.toFixed(2),
    capacityUnit: row.capacityUnit,
    manufactureDate: formatCalendarDate(row.manufactureDate),
    acquiredAt: formatCalendarDate(row.acquiredAt),
    commissionedAt: formatCalendarDate(row.commissionedAt),
    manufacturerExpiryDate: formatCalendarDate(row.manufacturerExpiryDate),
    logisticsStatus: row.logisticsStatus,
    technicalCondition: row.technicalCondition,
    placementType: row.placementType,
    currentLocation:
      row.currentLocation === null
        ? null
        : {
            id: row.currentLocation.id,
            code: row.currentLocation.code,
            name: row.currentLocation.name,
            type: row.currentLocation.type,
            parentId: row.currentLocation.parentId,
          },
    currentExternalParty: row.currentExternalParty,
    currentSince: iso(row.currentSince),
    retiredAt: iso(row.retiredAt),
    notes: row.notes,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toExtinguisherDetail(row: ExtinguisherDetailRow) {
  return {
    ...toExtinguisherView(row),
    dueDates: row.dueDates.map((dueDate) => ({
      eventType: dueDate.eventType,
      dueDate: formatCalendarDate(dueDate.dueDate),
      sourceType: dueDate.sourceType,
      sourceId: dueDate.sourceId,
      updatedAt: dueDate.updatedAt.toISOString(),
    })),
    movementCount: row._count.movements,
    lastInspection:
      row.inspections.length === 0
        ? null
        : {
            id: row.inspections[0].id,
            inspectedAt: row.inspections[0].inspectedAt.toISOString(),
            inspectedOn: formatCalendarDate(row.inspections[0].inspectedOn),
            inspectorName: row.inspections[0].inspectorName,
            result: row.inspections[0].result,
            nextDueDate: formatCalendarDate(row.inspections[0].nextDueDate),
          },
    openMaintenanceOrder:
      row.maintenanceOrders.length === 0
        ? null
        : {
            id: row.maintenanceOrders[0].id,
            status: row.maintenanceOrders[0].status,
            providerId: row.maintenanceOrders[0].providerId,
            workshopLocationId: row.maintenanceOrders[0].workshopLocationId,
            openedAt: row.maintenanceOrders[0].openedAt.toISOString(),
            expectedReturnDate: formatCalendarDate(
              row.maintenanceOrders[0].expectedReturnDate,
            ),
          },
  };
}
