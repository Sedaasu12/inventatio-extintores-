import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

export interface AuditEntry {
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: Prisma.InputJsonValue | null;
  afterData?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export type AuditClient = PrismaService | Prisma.TransactionClient;

/**
 * Registro append-only de acciones sensibles (BR-180..BR-182).
 * Los llamadores deben pasar datos ya redactados: nunca contraseñas ni tokens.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entry: AuditEntry,
    client: AuditClient = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        id: randomUUID(),
        actorUserId: entry.actorUserId ?? null,
        actorLabel: entry.actorLabel,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        beforeData: entry.beforeData ?? Prisma.JsonNull,
        afterData: entry.afterData ?? Prisma.JsonNull,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
      },
    });
  }

  /**
   * Consulta paginada y filtrada. La auditoría es append-only: la API no
   * permite modificarla ni eliminarla (D-21).
   */
  async list(query: ListAuditLogsQueryDto): Promise<{
    data: Array<{
      id: string;
      actorUserId: string | null;
      actorLabel: string;
      action: string;
      entityType: string;
      entityId: string | null;
      beforeData: Prisma.JsonValue | null;
      afterData: Prisma.JsonValue | null;
      ip: string | null;
      userAgent: string | null;
      requestId: string | null;
      createdAt: Date;
    }>;
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType !== undefined) {
      where.entityType = query.entityType;
    }
    if (query.entityId !== undefined) {
      where.entityId = query.entityId;
    }
    if (query.action !== undefined) {
      where.action = query.action;
    }
    if (query.actorUserId !== undefined) {
      where.actorUserId = query.actorUserId;
    }
    if (query.from !== undefined || query.to !== undefined) {
      where.createdAt = {
        ...(query.from === undefined ? {} : { gte: new Date(query.from) }),
        ...(query.to === undefined ? {} : { lte: new Date(query.to) }),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
