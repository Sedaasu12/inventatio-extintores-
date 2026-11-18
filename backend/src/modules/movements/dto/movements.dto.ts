import { Type, Transform } from 'class-transformer';
import {
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
  MinLength,
} from 'class-validator';
import { MovementType, PlacementType } from '@prisma/client';
import {
  MOVED_AT_PATTERN,
  OPERATIONAL_MOVEMENT_TYPES,
} from '../movement-policy';
import type { OperationalMovementType } from '../movement-policy';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateMovementDto {
  @IsIn(OPERATIONAL_MOVEMENT_TYPES)
  type!: OperationalMovementType;

  @IsUUID()
  originLocationId!: string;

  @IsUUID()
  destinationLocationId!: string;

  @Matches(MOVED_AT_PATTERN)
  movedAt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  requestedBy?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  authorizedBy?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  deliveredBy?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  receivedBy?: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
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

export class RetireExtinguisherDto {
  @Matches(MOVED_AT_PATTERN)
  movedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  authorizedBy!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentRef!: string;

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

export class AdjustMovementDto {
  @IsIn(['INTERNAL', 'EXTERNAL'])
  placementType!: PlacementType;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  externalPartyId?: string;

  @Matches(MOVED_AT_PATTERN)
  movedAt!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  authorizedBy!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentRef!: string;

  @IsOptional()
  @IsUUID()
  correctsMovementId?: string;

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

export class ListMovementsQueryDto {
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
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  from?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE)
  to?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsIn([
    'movedAt',
    '-movedAt',
    'createdAt',
    '-createdAt',
    'assetSequence',
    '-assetSequence',
  ])
  sort?: string;
}
