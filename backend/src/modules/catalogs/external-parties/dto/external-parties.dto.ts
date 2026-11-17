import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ExternalPartyType } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateExternalPartyDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsEnum(ExternalPartyType)
  partyType!: ExternalPartyType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  taxId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  contactName?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateExternalPartyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(ExternalPartyType)
  partyType?: ExternalPartyType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  taxId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  contactName?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListExternalPartiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @IsEnum(ExternalPartyType)
  partyType?: ExternalPartyType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  search?: string;
}
