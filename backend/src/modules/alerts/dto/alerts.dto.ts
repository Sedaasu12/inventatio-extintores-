import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DueDateEventType } from '@prisma/client';
import { ALERT_STATUSES } from '../alert-policy';

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

export class ListAlertsQueryDto {
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
  @IsEnum(DueDateEventType)
  eventType?: DueDateEventType;

  @IsOptional()
  @IsIn([...ALERT_STATUSES])
  status?: (typeof ALERT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeRetired?: boolean;

  @IsOptional()
  @IsIn([
    'dueDate',
    '-dueDate',
    'daysRemaining',
    '-daysRemaining',
    'assetCode',
    '-assetCode',
    'status',
    '-status',
  ])
  sort?: string;
}

export class AlertSummaryQueryDto {
  @IsOptional()
  @IsEnum(DueDateEventType)
  eventType?: DueDateEventType;

  @IsOptional()
  @IsIn([...ALERT_STATUSES])
  status?: (typeof ALERT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeRetired?: boolean;
}

export class UpdateAlertSettingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  daysBefore?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
