import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MaintenanceOrderStatus,
  ServiceResult,
  ServiceType,
} from '@prisma/client';
import { INSTANT_PATTERN } from '../../../common/time/instant';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Za-z]{3}$/;

export class SendToMaintenanceDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  workshopLocationId?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  expectedReturnDate?: string;

  @Matches(INSTANT_PATTERN)
  movedAt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  authorizedBy?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  deliveredBy!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentRef?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowVersion!: number;
}

export class CreateServiceDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @Matches(INSTANT_PATTERN)
  performedAt!: string;

  @IsOptional()
  @IsUUID()
  performedByUserId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsEnum(ServiceResult)
  result!: ServiceResult;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  certificateNo?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  certificateDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  nextDueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsOptional()
  @Transform(trim)
  @Matches(CURRENCY)
  currency?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  documentRef?: string;
}

export class ReturnFromMaintenanceDto {
  @IsUUID()
  destinationLocationId!: string;

  @Matches(INSTANT_PATTERN)
  movedAt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  deliveredBy?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  receivedBy!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  authorizedBy?: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentRef?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowVersion!: number;
}

export class ListMaintenanceOrdersQueryDto {
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
  @IsEnum(MaintenanceOrderStatus)
  status?: MaintenanceOrderStatus;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  workshopLocationId?: string;

  @IsOptional()
  @IsUUID()
  extinguisherId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  expectedReturnFrom?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  expectedReturnTo?: string;

  @IsOptional()
  @IsIn([
    'openedAt',
    '-openedAt',
    'expectedReturnDate',
    '-expectedReturnDate',
    'createdAt',
    '-createdAt',
  ])
  sort?: string;
}
