import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import type { AuthenticatedRequest } from './authenticated-user';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined) {
      throw ApiError.unauthorized();
    }

    const granted = new Set(request.user.permissions);
    const missing = required.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      throw ApiError.forbidden('No tienes permiso para realizar esta acción.');
    }

    return true;
  }
}
