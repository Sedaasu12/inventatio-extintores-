import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  InspectionResult,
  LogisticsStatus,
  MaintenanceOrderStatus,
  MovementType,
  TechnicalCondition,
} from '@prisma/client';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value;
};

export class ListRetiredReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

  @IsOptional()
  @IsIn(['BAJA', 'AJUSTE'])
  type?: 'BAJA' | 'AJUSTE';

  @IsOptional()
  @Matches(CALENDAR_DATE)
  from?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  to?: string;

  @IsOptional()
  @IsIn(['movedAt', '-movedAt', 'createdAt', '-createdAt'])
  sort?: string;
}

/**
 * Filtros aceptados por la exportación CSV. Se declara la unión de todos los
 * reportes para mantener un único contrato de consulta; cada reporte usa solo
 * los campos que le corresponden.
 */
export class ExportReportQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  format?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsUUID()
  extinguisherId?: string;

  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDescendants?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeRetired?: boolean;

  @IsOptional()
  @IsEnum(LogisticsStatus)
  logisticsStatus?: LogisticsStatus;

  @IsOptional()
  @IsEnum(TechnicalCondition)
  technicalCondition?: TechnicalCondition;

  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  from?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  to?: string;

  @IsOptional()
  @IsEnum(MaintenanceOrderStatus)
  status?: MaintenanceOrderStatus;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  workshopLocationId?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  expectedReturnFrom?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  expectedReturnTo?: string;

  @IsOptional()
  @IsEnum(InspectionResult)
  result?: InspectionResult;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  inspectedFrom?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  inspectedTo?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsIn([
    'assetCode',
    '-assetCode',
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
    'serialNumber',
    '-serialNumber',
    'movedAt',
    '-movedAt',
    'openedAt',
    '-openedAt',
    'expectedReturnDate',
    '-expectedReturnDate',
    'inspectedAt',
    '-inspectedAt',
  ])
  sort?: string;
}
