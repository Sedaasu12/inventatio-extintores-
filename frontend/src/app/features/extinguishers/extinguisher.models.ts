import type { TranslationKey } from '../../core/i18n/es-PE';

/**
 * Contrato de lectura del inventario. Los valores de estado y condición son
 * los mismos enums del backend; el frontend no los inventa ni los traduce a
 * otro vocabulario.
 */
export const LOGISTICS_STATUSES = [
  'EN_ALMACEN',
  'ASIGNADO',
  'EN_MANTENIMIENTO',
  'DADO_DE_BAJA',
] as const;

export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

export const TECHNICAL_CONDITIONS = [
  'OPERATIVO',
  'OBSERVADO',
  'NO_OPERATIVO',
  'PENDIENTE_INSPECCION',
] as const;

export type TechnicalCondition = (typeof TECHNICAL_CONDITIONS)[number];

export const EXTINGUISHER_SORTS = [
  'assetCode',
  '-assetCode',
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
  'serialNumber',
  '-serialNumber',
] as const;

export type ExtinguisherSort = (typeof EXTINGUISHER_SORTS)[number];

export type LocationType = 'SEDE' | 'ALMACEN' | 'AREA' | 'TALLER';

export const CAPACITY_UNITS = ['KG', 'L', 'LB'] as const;

export type CapacityUnit = (typeof CAPACITY_UNITS)[number];

export const ENTRY_SOURCES = [
  'COMPRA_CENTRAL',
  'COMPRA_LOCAL',
  'CARGA_INICIAL',
  'RETORNO_MANTENIMIENTO',
  'TRASLADO',
] as const;

export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const DUE_DATE_EVENT_TYPES = [
  'EQUIPO',
  'INSPECCION',
  'MANTENIMIENTO',
  'RECARGA',
  'PRUEBA_HIDROSTATICA',
] as const;

export type DueDateEventType = (typeof DUE_DATE_EVENT_TYPES)[number];

export type DueDateSourceType =
  | 'EXTINGUISHER'
  | 'INSPECTION'
  | 'MAINTENANCE_SERVICE';

export type PlacementType = 'INTERNAL' | 'EXTERNAL' | 'NONE';

export type InspectionResult =
  | 'APROBADO'
  | 'APROBADO_CON_OBSERVACIONES'
  | 'RECHAZADO';

export type MaintenanceOrderStatus =
  | 'ABIERTA'
  | 'EN_PROVEEDOR'
  | 'CERRADA'
  | 'CANCELADA';

export interface ExtinguisherTypeSummary {
  id: string;
  code: string;
  name: string;
  agent: string;
  nominalCapacity: string;
  capacityUnit: CapacityUnit;
  usefulLifeYears: number | null;
}

export interface LocationReference {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  parentId: string | null;
}

export interface ExternalPartyReference {
  id: string;
  code: string;
  name: string;
}

export interface ExtinguisherSummary {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  type: ExtinguisherTypeSummary;
  brand: string | null;
  model: string | null;
  capacityValue: string;
  capacityUnit: CapacityUnit;
  manufactureDate: string | null;
  acquiredAt: string | null;
  commissionedAt: string | null;
  manufacturerExpiryDate: string | null;
  logisticsStatus: LogisticsStatus;
  technicalCondition: TechnicalCondition;
  placementType: PlacementType;
  currentLocation: LocationReference | null;
  currentExternalParty: ExternalPartyReference | null;
  currentSince: string | null;
  retiredAt: string | null;
  notes: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ExtinguisherListResponse {
  data: ExtinguisherSummary[];
  meta: ListMeta;
}

export interface ExtinguisherTypeOption {
  id: string;
  code: string;
  name: string;
  nominalCapacity: string;
  capacityUnit: CapacityUnit;
  usefulLifeYears: number | null;
  active: boolean;
}

export interface ExtinguisherTypeListResponse {
  data: ExtinguisherTypeOption[];
  meta: ListMeta;
}

export interface LocationNode {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  address: string | null;
  active: boolean;
  children: LocationNode[];
}

export interface LocationTreeResponse {
  data: LocationNode[];
}

/**
 * Filtros de la lista. `locationId` puede apuntar a una sede; en ese caso la
 * API recibe `includeDescendants` para abarcar sus almacenes y áreas.
 */
export interface ExtinguisherFilters {
  q: string;
  typeId: string;
  locationId: string;
  logisticsStatus: LogisticsStatus | '';
  technicalCondition: TechnicalCondition | '';
  includeRetired: boolean;
  sort: ExtinguisherSort;
  page: number;
}

export function defaultExtinguisherFilters(): ExtinguisherFilters {
  return {
    q: '',
    typeId: '',
    locationId: '',
    logisticsStatus: '',
    technicalCondition: '',
    includeRetired: false,
    sort: 'assetCode',
    page: 1,
  };
}

export function isExtinguisherSort(value: string): value is ExtinguisherSort {
  return (EXTINGUISHER_SORTS as readonly string[]).includes(value);
}

export function isLogisticsStatus(
  value: string,
): value is LogisticsStatus {
  return (LOGISTICS_STATUSES as readonly string[]).includes(value);
}

export function isTechnicalCondition(
  value: string,
): value is TechnicalCondition {
  return (TECHNICAL_CONDITIONS as readonly string[]).includes(value);
}

export const LOGISTICS_LABEL_KEYS: Record<LogisticsStatus, TranslationKey> = {
  EN_ALMACEN: 'inventory.logistics.EN_ALMACEN',
  ASIGNADO: 'inventory.logistics.ASIGNADO',
  EN_MANTENIMIENTO: 'inventory.logistics.EN_MANTENIMIENTO',
  DADO_DE_BAJA: 'inventory.logistics.DADO_DE_BAJA',
};

export const CONDITION_LABEL_KEYS: Record<
  TechnicalCondition,
  TranslationKey
> = {
  OPERATIVO: 'inventory.condition.OPERATIVO',
  OBSERVADO: 'inventory.condition.OBSERVADO',
  NO_OPERATIVO: 'inventory.condition.NO_OPERATIVO',
  PENDIENTE_INSPECCION: 'inventory.condition.PENDIENTE_INSPECCION',
};

export const SORT_LABEL_KEYS: Record<ExtinguisherSort, TranslationKey> = {
  assetCode: 'inventory.sort.assetCodeAsc',
  '-assetCode': 'inventory.sort.assetCodeDesc',
  createdAt: 'inventory.sort.createdAtAsc',
  '-createdAt': 'inventory.sort.createdAtDesc',
  updatedAt: 'inventory.sort.updatedAtAsc',
  '-updatedAt': 'inventory.sort.updatedAtDesc',
  serialNumber: 'inventory.sort.serialNumberAsc',
  '-serialNumber': 'inventory.sort.serialNumberDesc',
};

export const CAPACITY_UNIT_LABEL_KEYS: Record<CapacityUnit, TranslationKey> = {
  KG: 'extinguisher.capacityUnit.KG',
  L: 'extinguisher.capacityUnit.L',
  LB: 'extinguisher.capacityUnit.LB',
};

export const ENTRY_SOURCE_LABEL_KEYS: Record<EntrySource, TranslationKey> = {
  COMPRA_CENTRAL: 'extinguisher.entrySource.COMPRA_CENTRAL',
  COMPRA_LOCAL: 'extinguisher.entrySource.COMPRA_LOCAL',
  CARGA_INICIAL: 'extinguisher.entrySource.CARGA_INICIAL',
  RETORNO_MANTENIMIENTO: 'extinguisher.entrySource.RETORNO_MANTENIMIENTO',
  TRASLADO: 'extinguisher.entrySource.TRASLADO',
};

export const PLACEMENT_LABEL_KEYS: Record<PlacementType, TranslationKey> = {
  INTERNAL: 'extinguisher.placement.INTERNAL',
  EXTERNAL: 'extinguisher.placement.EXTERNAL',
  NONE: 'extinguisher.placement.NONE',
};

export const DUE_DATE_LABEL_KEYS: Record<DueDateEventType, TranslationKey> = {
  EQUIPO: 'extinguisher.dueDate.EQUIPO',
  INSPECCION: 'extinguisher.dueDate.INSPECCION',
  MANTENIMIENTO: 'extinguisher.dueDate.MANTENIMIENTO',
  RECARGA: 'extinguisher.dueDate.RECARGA',
  PRUEBA_HIDROSTATICA: 'extinguisher.dueDate.PRUEBA_HIDROSTATICA',
};

export const INSPECTION_RESULT_LABEL_KEYS: Record<
  InspectionResult,
  TranslationKey
> = {
  APROBADO: 'extinguisher.inspectionResult.APROBADO',
  APROBADO_CON_OBSERVACIONES:
    'extinguisher.inspectionResult.APROBADO_CON_OBSERVACIONES',
  RECHAZADO: 'extinguisher.inspectionResult.RECHAZADO',
};

export const MAINTENANCE_STATUS_LABEL_KEYS: Record<
  MaintenanceOrderStatus,
  TranslationKey
> = {
  ABIERTA: 'extinguisher.maintenanceStatus.ABIERTA',
  EN_PROVEEDOR: 'extinguisher.maintenanceStatus.EN_PROVEEDOR',
  CERRADA: 'extinguisher.maintenanceStatus.CERRADA',
  CANCELADA: 'extinguisher.maintenanceStatus.CANCELADA',
};

export interface ExtinguisherDueDate {
  eventType: DueDateEventType;
  dueDate: string;
  sourceType: DueDateSourceType;
  sourceId: string;
  updatedAt: string;
}

export interface ExtinguisherLastInspection {
  id: string;
  inspectedAt: string;
  inspectedOn: string | null;
  inspectorName: string;
  result: InspectionResult;
  nextDueDate: string | null;
}

export interface OpenMaintenanceOrder {
  id: string;
  status: MaintenanceOrderStatus;
  providerId: string | null;
  workshopLocationId: string | null;
  openedAt: string;
  expectedReturnDate: string | null;
}

/** Ficha completa: el resumen de la lista más el historial derivado. */
export interface ExtinguisherDetail extends ExtinguisherSummary {
  dueDates: ExtinguisherDueDate[];
  movementCount: number;
  lastInspection: ExtinguisherLastInspection | null;
  openMaintenanceOrder: OpenMaintenanceOrder | null;
}

/**
 * Datos del alta. La ubicación y el estado inicial no se editan después: un
 * cambio de ubicación exige un movimiento y la condición tiene su propio
 * endpoint con motivo.
 */
export interface CreateExtinguisherPayload {
  serialNumber: string | null;
  typeId: string;
  brand: string | null;
  model: string | null;
  capacityValue: number;
  capacityUnit: CapacityUnit;
  manufactureDate: string | null;
  acquiredAt: string | null;
  commissionedAt: string | null;
  manufacturerExpiryDate: string | null;
  initialLocationId: string;
  entrySource: EntrySource;
  initialReason: string;
  receivedBy: string;
  documentRef: string;
  technicalCondition: TechnicalCondition;
  notes: string | null;
}

/** Solo campos descriptivos y técnicos; `rowVersion` evita sobrescrituras. */
export interface UpdateExtinguisherPayload {
  serialNumber: string | null;
  typeId: string;
  brand: string | null;
  model: string | null;
  capacityValue: number;
  capacityUnit: CapacityUnit;
  manufactureDate: string | null;
  acquiredAt: string | null;
  commissionedAt: string | null;
  manufacturerExpiryDate: string | null;
  notes: string | null;
  rowVersion: number;
}

export interface ChangeConditionPayload {
  condition: TechnicalCondition;
  reason: string;
  documentRef?: string | null;
  rowVersion?: number;
}

export interface CreateExtinguisherResponse {
  id: string;
  assetCode: string;
  qrPayload: string;
  extinguisher: ExtinguisherDetail;
  movement: {
    id: string;
    type: string;
    assetSequence: number;
    movedAt: string;
  };
}

export function isCapacityUnit(value: string): value is CapacityUnit {
  return (CAPACITY_UNITS as readonly string[]).includes(value);
}

export function isEntrySource(value: string): value is EntrySource {
  return (ENTRY_SOURCES as readonly string[]).includes(value);
}
