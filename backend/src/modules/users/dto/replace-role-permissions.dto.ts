import { IsArray, ArrayUnique, IsString } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}
