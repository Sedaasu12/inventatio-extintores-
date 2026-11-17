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
  MinLength,
} from 'class-validator';
import { LocationType } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLocationDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsEnum(LocationType)
  type!: LocationType;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string | null;
}

export class UpdateLocationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class ListLocationsQueryDto {
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
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  tree?: boolean;
}

export class ListLocationExtinguishersQueryDto {
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
}
