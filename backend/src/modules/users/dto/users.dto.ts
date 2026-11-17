import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayUnique,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes?: string[];
}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;
}

export class ListUsersQueryDto {
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
  @IsString()
  active?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  role?: string;
}
