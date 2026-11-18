import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ImportFormat } from '../import-file';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Campos comunes a la previsualización y a la confirmación de una carga
 * inicial. El archivo viaja en el campo multipart `file`.
 */
export class DryRunImportDto {
  @IsEnum(ImportFormat)
  format!: ImportFormat;

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

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ConfirmImportDto extends DryRunImportDto {
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  dryRunToken!: string;
}
