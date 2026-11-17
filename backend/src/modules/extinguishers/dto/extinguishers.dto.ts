import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
  CapacityUnit,
  EntrySource,
  LogisticsStatus,
  TechnicalCondition,
} from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === true || value === 'true' || value === '1';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateExtinguisherDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNumber?: string | null;

  @IsUUID()
  typeId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  capacityValue!: number;

  @IsEnum(CapacityUnit)
  capacityUnit!: CapacityUnit;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  manufactureDate?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  acquiredAt?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  commissionedAt?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  manufacturerExpiryDate?: string | null;

  @IsUUID()
  initialLocationId!: string;

  @IsEnum(EntrySource)
  entrySource!: EntrySource;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  initialReason!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  receivedBy!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentRef!: string;

  @IsEnum(TechnicalCondition)
  technicalCondition!: TechnicalCondition;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateExtinguisherDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNumber?: string | null;

  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  capacityValue?: number;

  @IsOptional()
  @IsEnum(CapacityUnit)
  capacityUnit?: CapacityUnit;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  manufactureDate?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  acquiredAt?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  commissionedAt?: string | null;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  manufacturerExpiryDate?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowVersion!: number;
}

export class ChangeConditionDto {
  @IsEnum(TechnicalCondition)
  condition!: TechnicalCondition;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  documentRef?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowVersion?: number;
}

export class ListExtinguishersQueryDto {
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
  typeId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDescendants?: boolean;

  @IsOptional()
  @IsEnum(LogisticsStatus)
  logisticsStatus?: LogisticsStatus;

  @IsOptional()
  @IsEnum(TechnicalCondition)
  technicalCondition?: TechnicalCondition;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeRetired?: boolean;

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
  ])
  sort?: string;
}

export class QrQueryDto {
  @IsOptional()
  @IsIn(['png', 'svg'])
  format?: 'png' | 'svg';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(1024)
  size?: number;
}
