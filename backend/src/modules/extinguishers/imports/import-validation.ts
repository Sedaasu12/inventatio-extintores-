import { CapacityUnit, LocationType, TechnicalCondition } from '@prisma/client';
import {
  parseCalendarDate,
  todayInTimeZone,
  validateCalendarDates,
} from '../extinguisher-dates';
import type { ImportColumn, RawImportRow } from './import-file';
import { IMPORT_COLUMNS } from './import-file';

const ALLOWED_COLUMNS = new Set<string>(IMPORT_COLUMNS);
const CAPACITY_UNITS = Object.values(CapacityUnit);
const TECHNICAL_CONDITIONS = Object.values(TechnicalCondition);

export interface TypeCatalogEntry {
  id: string;
  code: string;
  active: boolean;
  usefulLifeYears: number | null;
}

export interface LocationCatalogEntry {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  active: boolean;
  parentId: string | null;
}

export interface ImportCatalogs {
  types: Map<string, TypeCatalogEntry>;
  locations: Map<string, LocationCatalogEntry>;
}

export function buildImportCatalogs(
  types: TypeCatalogEntry[],
  locations: LocationCatalogEntry[],
): ImportCatalogs {
  return {
    types: new Map(types.map((type) => [type.code.toUpperCase(), type])),
    locations: new Map(
      locations.map((location) => [location.code.toUpperCase(), location]),
    ),
  };
}

export interface RowIssue {
  code: string;
  field?: string;
  message: string;
}

export interface NormalizedImportRow {
  serialNumber: string | null;
  typeCode: string | null;
  brand: string | null;
  model: string | null;
  capacityValue: number | null;
  capacityUnit: CapacityUnit | null;
  manufactureDate: string | null;
  acquiredAt: string | null;
  commissionedAt: string | null;
  manufacturerExpiryDate: string | null;
  sedeCode: string | null;
  locationCode: string | null;
  technicalCondition: TechnicalCondition | null;
  notes: string | null;
}

export interface ResolvedImportRow {
  typeId: string;
  sedeId: string;
  sedeName: string;
  locationId: string;
  locationName: string;
  locationType: 'ALMACEN' | 'AREA';
}

export interface ValidatedImportRow {
  row: number;
  line: number;
  status: 'VALID' | 'INVALID';
  errors: RowIssue[];
  warnings: RowIssue[];
  data: NormalizedImportRow;
  resolved: ResolvedImportRow | null;
}

export interface SerialConflict {
  serialNumber: string;
  rows: number[];
  assetCodes: string[];
}

export interface SerialWarningResult {
  duplicateInFile: SerialConflict[];
  alreadyRegistered: SerialConflict[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  bySede: Array<{
    sedeCode: string;
    sedeName: string | null;
    totalRows: number;
    validRows: number;
    invalidRows: number;
  }>;
  byLocation: Array<{
    sedeCode: string;
    sedeName: string | null;
    locationCode: string;
    locationName: string | null;
    locationType: 'ALMACEN' | 'AREA' | null;
    totalRows: number;
    validRows: number;
    invalidRows: number;
  }>;
  duplicateSerialsInFile: SerialConflict[];
  serialsAlreadyRegistered: SerialConflict[];
}

function textValue(
  values: Record<string, unknown>,
  field: ImportColumn,
  maxLength: number,
  errors: RowIssue[],
): string | null {
  const raw = values[field];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({
      code: 'INVALID_FORMAT',
      field,
      message: 'El valor debe ser texto.',
    });
    return null;
  }

  const text = String(raw).trim();
  if (text === '') {
    return null;
  }
  if (text.length > maxLength) {
    errors.push({
      code: 'MAX_LENGTH',
      field,
      message: `El valor supera los ${maxLength} caracteres permitidos.`,
    });
  }
  return text;
}

function requiredText(
  values: Record<string, unknown>,
  field: ImportColumn,
  maxLength: number,
  errors: RowIssue[],
): string | null {
  const text = textValue(values, field, maxLength, errors);
  if (text === null) {
    errors.push({
      code: 'REQUIRED',
      field,
      message: 'El campo es obligatorio.',
    });
  }
  return text;
}

function readCapacity(
  values: Record<string, unknown>,
  errors: RowIssue[],
): number | null {
  const raw = values.capacityValue;
  if (raw === undefined || raw === null) {
    errors.push({
      code: 'REQUIRED',
      field: 'capacityValue',
      message: 'La capacidad es obligatoria.',
    });
    return null;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({
      code: 'INVALID_FORMAT',
      field: 'capacityValue',
      message: 'La capacidad debe ser un número.',
    });
    return null;
  }

  const text = String(raw).trim();
  if (text === '') {
    errors.push({
      code: 'REQUIRED',
      field: 'capacityValue',
      message: 'La capacidad es obligatoria.',
    });
    return null;
  }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text)) {
    errors.push({
      code: 'CAPACITY_INVALID',
      field: 'capacityValue',
      message:
        'La capacidad debe ser un número positivo con hasta dos decimales.',
    });
    return null;
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0.01 || value > 99_999_999.99) {
    errors.push({
      code: 'CAPACITY_INVALID',
      field: 'capacityValue',
      message: 'La capacidad está fuera del rango permitido.',
    });
    return null;
  }
  return value;
}

function readEnum<T extends string>(
  values: Record<string, unknown>,
  field: ImportColumn,
  allowed: readonly T[],
  errors: RowIssue[],
): T | null {
  const raw = values[field];
  if (raw === undefined || raw === null) {
    errors.push({
      code: 'REQUIRED',
      field,
      message: 'El campo es obligatorio.',
    });
    return null;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({
      code: 'INVALID_FORMAT',
      field,
      message: 'El valor debe ser texto.',
    });
    return null;
  }
  const normalized = String(raw).trim().toUpperCase();
  if (normalized === '') {
    errors.push({
      code: 'REQUIRED',
      field,
      message: 'El campo es obligatorio.',
    });
    return null;
  }
  if (!allowed.includes(normalized as T)) {
    errors.push({
      code: 'INVALID_VALUE',
      field,
      message: `El valor debe ser uno de: ${allowed.join(', ')}.`,
    });
    return null;
  }
  return normalized as T;
}

function readDate(
  values: Record<string, unknown>,
  field: ImportColumn,
  errors: RowIssue[],
): string | null {
  const raw = values[field];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    errors.push({
      code: 'INVALID_FORMAT',
      field,
      message: 'La fecha debe ser texto con formato YYYY-MM-DD.',
    });
    return null;
  }
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  if (parseCalendarDate(text) === null) {
    errors.push({
      code: 'DATE_INVALID',
      field,
      message:
        'La fecha debe tener el formato YYYY-MM-DD y existir en el calendario.',
    });
    return null;
  }
  return text;
}

function asDate(value: string | null): Date | null {
  return value === null ? null : parseCalendarDate(value);
}

function validateRow(
  raw: RawImportRow,
  catalogs: ImportCatalogs,
  today: string,
): ValidatedImportRow {
  const errors: RowIssue[] = raw.structureErrors.map((error) => ({
    code: error.code,
    message: error.message,
  }));
  const warnings: RowIssue[] = [];

  for (const key of Object.keys(raw.values)) {
    if (!ALLOWED_COLUMNS.has(key)) {
      errors.push({
        code: 'UNKNOWN_FIELD',
        field: key,
        message: `La columna "${key}" no se reconoce.`,
      });
    }
  }

  const serialNumber = textValue(raw.values, 'serialNumber', 100, errors);
  const typeCode = requiredText(raw.values, 'typeCode', 20, errors);
  const brand = textValue(raw.values, 'brand', 100, errors);
  const model = textValue(raw.values, 'model', 100, errors);
  const capacityValue = readCapacity(raw.values, errors);
  const capacityUnit = readEnum(
    raw.values,
    'capacityUnit',
    CAPACITY_UNITS,
    errors,
  );
  const manufactureDate = readDate(raw.values, 'manufactureDate', errors);
  const acquiredAt = readDate(raw.values, 'acquiredAt', errors);
  const commissionedAt = readDate(raw.values, 'commissionedAt', errors);
  const manufacturerExpiryDate = readDate(
    raw.values,
    'manufacturerExpiryDate',
    errors,
  );
  const sedeCode = requiredText(raw.values, 'sedeCode', 30, errors);
  const locationCode = requiredText(raw.values, 'locationCode', 30, errors);
  const technicalCondition = readEnum(
    raw.values,
    'technicalCondition',
    TECHNICAL_CONDITIONS,
    errors,
  );
  const notes = textValue(raw.values, 'notes', 2000, errors);

  const dateError = validateCalendarDates(
    {
      manufactureDate: asDate(manufactureDate),
      acquiredAt: asDate(acquiredAt),
      commissionedAt: asDate(commissionedAt),
      manufacturerExpiryDate: asDate(manufacturerExpiryDate),
    },
    today,
  );
  if (dateError !== null) {
    errors.push({
      code: dateError.code,
      field: dateError.field,
      message: dateError.message,
    });
  }

  const type =
    typeCode === null ? undefined : catalogs.types.get(typeCode.toUpperCase());
  if (typeCode !== null && type === undefined) {
    errors.push({
      code: 'TYPE_NOT_FOUND',
      field: 'typeCode',
      message: `No existe un tipo de extintor con el código "${typeCode}".`,
    });
  } else if (type !== undefined && !type.active) {
    errors.push({
      code: 'TYPE_INACTIVE',
      field: 'typeCode',
      message: `El tipo de extintor "${typeCode}" está inactivo.`,
    });
  }

  const sede =
    sedeCode === null
      ? undefined
      : catalogs.locations.get(sedeCode.toUpperCase());
  if (sedeCode !== null && sede === undefined) {
    errors.push({
      code: 'SEDE_NOT_FOUND',
      field: 'sedeCode',
      message: `No existe una ubicación con el código "${sedeCode}".`,
    });
  } else if (sede !== undefined) {
    if (sede.type !== 'SEDE') {
      errors.push({
        code: 'SEDE_INVALID_TYPE',
        field: 'sedeCode',
        message: `La ubicación "${sedeCode}" no es una sede.`,
      });
    } else if (!sede.active) {
      errors.push({
        code: 'SEDE_INACTIVE',
        field: 'sedeCode',
        message: `La sede "${sedeCode}" está inactiva.`,
      });
    }
  }

  const location =
    locationCode === null
      ? undefined
      : catalogs.locations.get(locationCode.toUpperCase());
  if (locationCode !== null && location === undefined) {
    errors.push({
      code: 'LOCATION_NOT_FOUND',
      field: 'locationCode',
      message: `No existe una ubicación con el código "${locationCode}".`,
    });
  } else if (location !== undefined) {
    if (location.type !== 'ALMACEN' && location.type !== 'AREA') {
      errors.push({
        code: 'LOCATION_INVALID_TYPE',
        field: 'locationCode',
        message: 'La ubicación de carga inicial debe ser un almacén o un área.',
      });
    } else if (!location.active) {
      errors.push({
        code: 'LOCATION_INACTIVE',
        field: 'locationCode',
        message: `La ubicación "${locationCode}" está inactiva.`,
      });
    } else if (
      sede !== undefined &&
      sede.type === 'SEDE' &&
      location.parentId !== sede.id
    ) {
      errors.push({
        code: 'LOCATION_NOT_IN_SEDE',
        field: 'locationCode',
        message: `La ubicación "${locationCode}" no pertenece a la sede "${sedeCode}".`,
      });
    }
  }

  if (
    location?.type === 'AREA' &&
    technicalCondition === TechnicalCondition.NO_OPERATIVO
  ) {
    errors.push({
      code: 'CONDITION_NOT_ASSIGNABLE',
      field: 'technicalCondition',
      message:
        'Un extintor NO_OPERATIVO no puede cargarse directamente en un área.',
    });
  }

  if (serialNumber === null) {
    warnings.push({
      code: 'SERIAL_MISSING',
      field: 'serialNumber',
      message:
        'Sin número de serie no se puede conciliar con el listado físico.',
    });
  }

  const resolved: ResolvedImportRow | null =
    errors.length === 0 &&
    type !== undefined &&
    sede !== undefined &&
    location !== undefined &&
    (location.type === 'ALMACEN' || location.type === 'AREA')
      ? {
          typeId: type.id,
          sedeId: sede.id,
          sedeName: sede.name,
          locationId: location.id,
          locationName: location.name,
          locationType: location.type,
        }
      : null;

  return {
    row: raw.row,
    line: raw.line,
    status: errors.length === 0 ? 'VALID' : 'INVALID',
    errors,
    warnings,
    data: {
      serialNumber,
      typeCode,
      brand,
      model,
      capacityValue,
      capacityUnit,
      manufactureDate,
      acquiredAt,
      commissionedAt,
      manufacturerExpiryDate,
      sedeCode,
      locationCode,
      technicalCondition,
      notes,
    },
    resolved,
  };
}

export function validateImportRows(
  rawRows: RawImportRow[],
  catalogs: ImportCatalogs,
  timezone: string,
  now: Date = new Date(),
): ValidatedImportRow[] {
  const today = todayInTimeZone(timezone, now);
  return rawRows.map((raw) => validateRow(raw, catalogs, today));
}

/**
 * Agrega advertencias de seriales repetidos (D-16: no bloquean la carga).
 * `existing` se indexa por serial en mayúsculas y contiene los códigos de
 * activo ya registrados con ese serial.
 */
export function applySerialWarnings(
  rows: ValidatedImportRow[],
  existing: Map<string, string[]>,
): SerialWarningResult {
  const byRow = new Map(rows.map((row) => [row.row, row]));
  const bySerial = new Map<string, { display: string; rows: number[] }>();

  for (const row of rows) {
    const serial = row.data.serialNumber;
    if (serial === null) {
      continue;
    }
    const key = serial.toUpperCase();
    const entry = bySerial.get(key);
    if (entry === undefined) {
      bySerial.set(key, { display: serial, rows: [row.row] });
    } else {
      entry.rows.push(row.row);
    }
  }

  const duplicateInFile: SerialConflict[] = [];
  const alreadyRegistered: SerialConflict[] = [];

  for (const [key, entry] of bySerial) {
    if (entry.rows.length > 1) {
      const conflict: SerialConflict = {
        serialNumber: entry.display,
        rows: entry.rows,
        assetCodes: [],
      };
      duplicateInFile.push(conflict);
      const otherRows = entry.rows.join(', ');
      for (const rowNumber of entry.rows) {
        byRow.get(rowNumber)?.warnings.push({
          code: 'SERIAL_DUPLICATE_IN_FILE',
          field: 'serialNumber',
          message: `El número de serie también aparece en las filas ${otherRows}.`,
        });
      }
    }

    const assetCodes = existing.get(key);
    if (assetCodes !== undefined && assetCodes.length > 0) {
      const conflict: SerialConflict = {
        serialNumber: entry.display,
        rows: entry.rows,
        assetCodes,
      };
      alreadyRegistered.push(conflict);
      for (const rowNumber of entry.rows) {
        byRow.get(rowNumber)?.warnings.push({
          code: 'SERIAL_ALREADY_REGISTERED',
          field: 'serialNumber',
          message: `El número de serie ya existe en el sistema (${assetCodes.join(', ')}).`,
        });
      }
    }
  }

  return { duplicateInFile, alreadyRegistered };
}

export function buildImportSummary(
  rows: ValidatedImportRow[],
  serials: SerialWarningResult,
): ImportSummary {
  const sedeGroups = new Map<
    string,
    {
      sedeCode: string;
      sedeName: string | null;
      totalRows: number;
      validRows: number;
      invalidRows: number;
    }
  >();
  const locationGroups = new Map<
    string,
    {
      sedeCode: string;
      sedeName: string | null;
      locationCode: string;
      locationName: string | null;
      locationType: 'ALMACEN' | 'AREA' | null;
      totalRows: number;
      validRows: number;
      invalidRows: number;
    }
  >();

  for (const row of rows) {
    const sedeCode = row.data.sedeCode ?? '';
    const sedeKey = sedeCode.toUpperCase();
    const sede = sedeGroups.get(sedeKey) ?? {
      sedeCode,
      sedeName: row.resolved?.sedeName ?? null,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
    sede.totalRows += 1;
    if (row.status === 'VALID') {
      sede.validRows += 1;
    } else {
      sede.invalidRows += 1;
    }
    sedeGroups.set(sedeKey, sede);

    const locationCode = row.data.locationCode ?? '';
    const locationKey = `${sedeKey}|${locationCode.toUpperCase()}`;
    const location = locationGroups.get(locationKey) ?? {
      sedeCode,
      sedeName: row.resolved?.sedeName ?? null,
      locationCode,
      locationName: row.resolved?.locationName ?? null,
      locationType: row.resolved?.locationType ?? null,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
    location.totalRows += 1;
    if (row.status === 'VALID') {
      location.validRows += 1;
    } else {
      location.invalidRows += 1;
    }
    locationGroups.set(locationKey, location);
  }

  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === 'VALID').length,
    invalidRows: rows.filter((row) => row.status === 'INVALID').length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
    bySede: [...sedeGroups.values()].sort((a, b) =>
      a.sedeCode.localeCompare(b.sedeCode),
    ),
    byLocation: [...locationGroups.values()].sort(
      (a, b) =>
        a.sedeCode.localeCompare(b.sedeCode) ||
        a.locationCode.localeCompare(b.locationCode),
    ),
    duplicateSerialsInFile: serials.duplicateInFile,
    serialsAlreadyRegistered: serials.alreadyRegistered,
  };
}
