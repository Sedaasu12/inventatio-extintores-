import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * Exige que el usuario tenga todos los permisos indicados.
 * El backend verifica permisos, no nombres de rol.
 */
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
