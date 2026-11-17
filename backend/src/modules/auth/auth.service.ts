import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AUTH_PROVIDER,
  type AuthIdentity,
  type AuthProvider,
} from './auth-provider';
import { assertValidPassword } from './password-policy';
import { hashPassword } from './password-hasher';
import { LoginRateLimiter } from './login-rate-limiter';
import { TokenService } from './token.service';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  origin?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly rateLimiter: LoginRateLimiter,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async login(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const rateKeys = [
      `ip:${context.ip ?? 'unknown'}`,
      `email:${normalizedEmail}`,
    ];
    this.rateLimiter.assertAllowed(rateKeys);

    const identity = await this.provider.validateCredentials(
      normalizedEmail,
      password,
    );

    if (identity === null) {
      this.rateLimiter.registerFailure(rateKeys);
      try {
        await this.audit.record({
          actorUserId: null,
          actorLabel: normalizedEmail,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'AUTH',
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        });
      } catch (error) {
        // La auditoría de un fallo no debe impedir la respuesta 401.
        this.logger.warn(
          `No se pudo auditar el login fallido (requestId=${context.requestId ?? 'none'}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_CREDENTIALS,
        'Correo o contraseña incorrectos.',
      );
    }

    // Se limpia solo el contador del correo: los fallos por IP se conservan
    // para que una cuenta válida no reinicie el límite global.
    this.rateLimiter.clear([`email:${normalizedEmail}`]);

    const sessionId = randomUUID();
    const refresh = this.tokens.generateRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.tokens.refreshTokenTtlMs,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: randomUUID(),
          userId: identity.userId,
          tokenHash: refresh.hash,
          familyId: sessionId,
          expiresAt: refreshExpiresAt,
          userAgent: context.userAgent ?? null,
          ip: context.ip ?? null,
        },
      });
      await tx.user.update({
        where: { id: identity.userId },
        data: {
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.audit.record(
        {
          actorUserId: identity.userId,
          actorLabel: identity.fullName,
          action: 'AUTH_LOGIN_SUCCEEDED',
          entityType: 'AUTH',
          entityId: identity.userId,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });

    const accessToken = await this.tokens.issueAccessToken(
      identity.userId,
      sessionId,
    );

    return {
      accessToken,
      expiresIn: this.tokens.accessTokenTtlSeconds,
      refreshToken: refresh.raw,
      refreshExpiresAt,
      user: this.toPublicUser(identity),
    };
  }

  async refresh(
    rawRefreshToken: string | undefined,
    context: RequestContext,
  ): Promise<RefreshResult> {
    this.assertTrustedOrigin(context.origin);

    if (rawRefreshToken === undefined || rawRefreshToken === '') {
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'La sesión no es válida. Inicia sesión nuevamente.',
      );
    }

    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, active: true } } },
    });

    if (stored === null) {
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'La sesión no es válida. Inicia sesión nuevamente.',
      );
    }

    if (stored.revokedAt !== null) {
      // Reutilización de un refresh ya rotado: se revoca la familia completa.
      await this.revokeFamily(stored.familyId);
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'La sesión no es válida. Inicia sesión nuevamente.',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now() || !stored.user.active) {
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'La sesión no es válida. Inicia sesión nuevamente.',
      );
    }

    const next = this.tokens.generateRefreshToken();
    const nextId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + this.tokens.refreshTokenTtlMs,
    );

    const rotated = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count === 0) {
        await tx.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return false;
      }

      await tx.refreshToken.create({
        data: {
          id: nextId,
          userId: stored.userId,
          tokenHash: next.hash,
          familyId: stored.familyId,
          expiresAt: refreshExpiresAt,
          userAgent: context.userAgent ?? null,
          ip: context.ip ?? null,
        },
      });
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: nextId },
      });
      return true;
    });

    if (!rotated) {
      throw ApiError.unauthorized(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'La sesión no es válida. Inicia sesión nuevamente.',
      );
    }

    const identity = await this.loadIdentity(stored.userId);
    if (identity === null) {
      throw ApiError.unauthorized();
    }

    const accessToken = await this.tokens.issueAccessToken(
      stored.userId,
      stored.familyId,
    );

    return {
      accessToken,
      expiresIn: this.tokens.accessTokenTtlSeconds,
      refreshToken: next.raw,
      refreshExpiresAt,
      user: this.toPublicUser(identity),
    };
  }

  async logout(
    userId: string,
    fullName: string,
    sessionId: string,
    context: RequestContext,
  ) {
    this.assertTrustedOrigin(context.origin);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { familyId: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          actorLabel: fullName,
          action: 'AUTH_LOGOUT',
          entityType: 'AUTH',
          entityId: userId,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const identity = await this.loadIdentity(userId);
    if (identity === null) {
      throw ApiError.unauthorized();
    }
    return this.toPublicUser(identity);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, active: true },
    });

    if (user === null || !user.active) {
      throw ApiError.unauthorized();
    }

    const identity = await this.provider.validateCredentials(
      user.email,
      currentPassword,
    );
    if (identity === null) {
      throw ApiError.unprocessable(
        ErrorCodes.INVALID_CURRENT_PASSWORD,
        'La contraseña actual no es correcta.',
      );
    }

    assertValidPassword(newPassword);
    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          familyId: { not: sessionId },
        },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          actorLabel: user.fullName,
          action: 'AUTH_PASSWORD_CHANGED',
          entityType: 'USER',
          entityId: userId,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async loadIdentity(userId: string): Promise<AuthIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

  private toPublicUser(identity: AuthIdentity): PublicUser {
    return {
      id: identity.userId,
      email: identity.email,
      fullName: identity.fullName,
      roles: identity.roles,
      permissions: identity.permissions,
      mustChangePassword: identity.mustChangePassword,
    };
  }

  /**
   * T-SEC-13: además de `SameSite=Strict`, se valida el origen cuando el
   * navegador lo envía.
   */
  private assertTrustedOrigin(origin: string | undefined): void {
    if (origin === undefined || origin === '') {
      return;
    }
    if (!this.env.corsOrigins.includes(origin)) {
      throw ApiError.forbidden(
        'El origen de la solicitud no está permitido.',
        ErrorCodes.UNTRUSTED_ORIGIN,
      );
    }
  }
}
