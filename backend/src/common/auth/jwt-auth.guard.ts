import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_KEY } from './public.decorator';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './authenticated-user';

interface AccessTokenPayload {
  sub?: string;
  sid?: string;
}

/**
 * Verifica el access token y reconstruye el usuario y sus permisos desde la
 * base de datos en cada solicitud:
 * - un usuario desactivado pierde acceso de inmediato (BR-169);
 * - los permisos no se confían al token (BR-170);
 * - cerrar sesión revoca la familia y el access token deja de valer (T-AUT-06).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (token === null) {
      throw ApiError.unauthorized();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw ApiError.unauthorized();
    }

    if (payload.sub === undefined || payload.sid === undefined) {
      throw ApiError.unauthorized();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (user === null || !user.active) {
      throw ApiError.unauthorized();
    }

    const activeSession = await this.prisma.refreshToken.findFirst({
      where: {
        familyId: payload.sid,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (activeSession === null) {
      throw ApiError.unauthorized();
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code);
    const permissions = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions: [...permissions].sort(),
      sessionId: payload.sid,
      mustChangePassword: user.mustChangePassword,
    };

    request.user = authenticatedUser;
    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const header = request.header('authorization');
    if (header === undefined) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    if (
      scheme?.toLowerCase() !== 'bearer' ||
      token === undefined ||
      token === ''
    ) {
      return null;
    }
    return token;
  }
}
