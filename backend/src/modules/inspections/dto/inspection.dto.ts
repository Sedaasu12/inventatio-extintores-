import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InspectionResult } from '@prisma/client';
import { INSTANT_PATTERN } from '../../../common/time/instant';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateInspectionDto {
  @Matches(INSTANT_PATTERN)
  inspectedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  inspectorName!: string;

  @IsOptional()
  @IsUUID()
  inspectorUserId?: string;

  @IsEnum(InspectionResult)
  result!: InspectionResult;

  /** Checklist libre; el tamaño máximo y la forma se validan en la política. */
  @IsOptional()
  @IsObject()
  checklist?: Record<string, unknown>;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  nextDueDate?: string;

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

export class ListInspectionsQueryDto {
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
  @IsUUID()
  extinguisherId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  assetCode?: string;

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
  @IsIn(['inspectedAt', '-inspectedAt', 'createdAt', '-createdAt'])
  sort?: string;
}
