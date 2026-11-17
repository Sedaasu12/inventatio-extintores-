import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import { ErrorCodes } from '../errors/error-codes';
import type { AuthenticatedRequest } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';

const ALLOWED_PATHS = new Set([
  '/auth/me',
  '/auth/change-password',
  '/auth/logout',
]);

/**
 * Mientras `mustChangePassword` sea verdadero, solo se permite consultar el
 * perfil, cambiar la contraseña o cerrar sesión (BR-175).
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined || !request.user.mustChangePassword) {
      return true;
    }

    const path = request.path.replace(/^\/api\/v1/, '');
    if (ALLOWED_PATHS.has(path)) {
      return true;
    }

    throw ApiError.forbidden(
      'Debes cambiar tu contraseña antes de continuar.',
      ErrorCodes.PASSWORD_CHANGE_REQUIRED,
    );
  }
}
