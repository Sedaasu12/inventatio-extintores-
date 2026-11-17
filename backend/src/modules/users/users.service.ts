import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { assertValidPassword } from '../auth/password-policy';
import { hashPassword } from '../auth/password-hasher';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/users.dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: { role: { select: { code: true } } },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}

export interface CreateUserResult {
  user: UserView;
  temporaryPassword?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<{
    data: UserView[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {};
    if (query.active === 'true') {
      where.active = true;
    } else if (query.active === 'false') {
      where.active = false;
    }
    if (query.role !== undefined && query.role !== '') {
      where.userRoles = { some: { role: { code: query.role } } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { email: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async get(id: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (user === null) {
      throw ApiError.notFound('El usuario no existe.');
    }
    return this.toView(user);
  }

  async create(
    dto: CreateUserDto,
    actor: { id: string; fullName: string },
    context: RequestContext,
  ): Promise<CreateUserResult> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing !== null) {
      throw ApiError.conflict(
        ErrorCodes.EMAIL_ALREADY_EXISTS,
        'Ya existe un usuario con ese correo.',
      );
    }

    const providedPassword = dto.password;
    if (providedPassword !== undefined) {
      assertValidPassword(providedPassword);
    }
    const temporaryPassword =
      providedPassword ?? randomBytes(18).toString('base64url');
    const passwordHash = await hashPassword(temporaryPassword);

    const roles = await this.resolveRoles(dto.roleCodes);
    const userId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          passwordHash,
          fullName: dto.fullName.trim(),
          active: true,
          mustChangePassword: true,
          createdById: actor.id,
        },
      });
      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
            assignedById: actor.id,
          })),
        });
      }
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'USER_CREATED',
          entityType: 'USER',
          entityId: userId,
          afterData: {
            email,
            fullName: dto.fullName.trim(),
            roleCodes: roles.map((role) => role.code),
            mustChangePassword: true,
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });

    const user = await this.get(userId);
    return providedPassword === undefined
      ? { user, temporaryPassword }
      : { user };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: { id: string; fullName: string },
    context: RequestContext,
  ): Promise<UserView> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (existing === null) {
      throw ApiError.notFound('El usuario no existe.');
    }

    const roles =
      dto.roleCodes === undefined
        ? undefined
        : await this.resolveRoles(dto.roleCodes);

    const before = this.toView(existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.fullName === undefined
            ? {}
            : { fullName: dto.fullName.trim() }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
          ...(dto.active === false
            ? { deactivatedAt: new Date() }
            : dto.active === true
              ? { deactivatedAt: null }
              : {}),
        },
      });

      if (roles !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((role) => ({
              userId: id,
              roleId: role.id,
              assignedById: actor.id,
            })),
          });
        }
      }

      if (dto.active === false) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: id,
          beforeData: {
            fullName: before.fullName,
            active: before.active,
            roleCodes: before.roles,
          },
          afterData: {
            fullName: dto.fullName?.trim() ?? before.fullName,
            active: dto.active ?? before.active,
            roleCodes:
              roles === undefined
                ? before.roles
                : roles.map((role) => role.code),
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });

    return this.get(id);
  }

  async deactivate(
    id: string,
    actor: { id: string; fullName: string },
    context: RequestContext,
  ): Promise<void> {
    await this.update(id, { active: false }, actor, context);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: { id: string; fullName: string },
    context: RequestContext,
  ): Promise<{ temporaryPassword: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (user === null) {
      throw ApiError.notFound('El usuario no existe.');
    }

    if (dto.password !== undefined) {
      assertValidPassword(dto.password);
    }
    const temporaryPassword =
      dto.password ?? randomBytes(18).toString('base64url');
    const passwordHash = await hashPassword(temporaryPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'USER_PASSWORD_RESET',
          entityType: 'USER',
          entityId: id,
          afterData: { email: user.email, mustChangePassword: true },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });

    return { temporaryPassword };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions
        .map((rolePermission) => rolePermission.permission.code)
        .sort(),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      select: { id: true, code: true, description: true },
      orderBy: { code: 'asc' },
    });
  }

  async replaceRolePermissions(
    roleId: string,
    permissionCodes: string[],
    actor: { id: string; fullName: string },
    context: RequestContext,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        code: true,
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    });
    if (role === null) {
      throw ApiError.notFound('El rol no existe.');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });
    const found = new Set(permissions.map((permission) => permission.code));
    const missing = permissionCodes.filter((code) => !found.has(code));
    if (missing.length > 0) {
      throw ApiError.unprocessable(
        ErrorCodes.UNKNOWN_PERMISSION,
        'Uno o más permisos no existen.',
        { missing },
      );
    }

    const beforeCodes = role.permissions
      .map((rolePermission) => rolePermission.permission.code)
      .sort();

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'ROLE_PERMISSIONS_UPDATED',
          entityType: 'ROLE',
          entityId: roleId,
          beforeData: { roleCode: role.code, permissionCodes: beforeCodes },
          afterData: {
            roleCode: role.code,
            permissionCodes: [...permissionCodes].sort(),
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });

    return this.listRoles().then((roles) =>
      roles.find((item) => item.id === roleId),
    );
  }

  private async resolveRoles(
    roleCodes: string[],
  ): Promise<Array<{ id: string; code: string }>> {
    if (roleCodes.length === 0) {
      return [];
    }
    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
      select: { id: true, code: true },
    });
    const found = new Set(roles.map((role) => role.code));
    const missing = roleCodes.filter((code) => !found.has(code));
    if (missing.length > 0) {
      throw ApiError.unprocessable(
        ErrorCodes.UNKNOWN_ROLE,
        'Uno o más roles no existen.',
        { missing },
      );
    }
    return roles;
  }

  private toView(row: UserRow): UserView {
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      lastLoginAt: row.lastLoginAt,
      deactivatedAt: row.deactivatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      roles: row.userRoles.map((userRole) => userRole.role.code).sort(),
    };
  }
}
