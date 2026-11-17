import { Injectable } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthIdentity, AuthProvider } from './auth-provider';

/**
 * Proveedor de identidad local (correo + contraseña), único del MVP (D-06).
 * El contrato de sesión y permisos no depende de esta implementación.
 */
@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
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
      return null;
    }

    const matches = await compare(password, user.passwordHash);
    if (!matches) {
      return null;
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code);
    const permissions = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions: [...permissions].sort(),
      mustChangePassword: user.mustChangePassword,
    };
  }
}
