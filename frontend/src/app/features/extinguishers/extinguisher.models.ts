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

export type CapacityUnit = 'KG' | 'L' | 'LB';

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
  placementType: 'INTERNAL' | 'EXTERNAL' | 'NONE';
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
