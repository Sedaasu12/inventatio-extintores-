import { Injectable } from '@nestjs/common';
import { LocationType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  CodeCounterService,
  LOCATION_COUNTER,
} from '../../common/codes/code-counter.service';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  CreateLocationDto,
  ListLocationExtinguishersQueryDto,
  ListLocationsQueryDto,
  UpdateLocationDto,
} from './dto/locations.dto';

const LOCATION_LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  parentId: true,
  address: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  parent: { select: { id: true, code: true, name: true, type: true } },
  _count: { select: { children: true, extinguishers: true } },
} satisfies Prisma.LocationSelect;

const LOCATION_DETAIL_SELECT = {
  ...LOCATION_LIST_SELECT,
  children: {
    select: { id: true, code: true, name: true, type: true, active: true },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.LocationSelect;

type LocationRow = Prisma.LocationGetPayload<{
  select: typeof LOCATION_LIST_SELECT;
}>;
type LocationDetailRow = Prisma.LocationGetPayload<{
  select: typeof LOCATION_DETAIL_SELECT;
}>;

interface Actor {
  id: string;
  fullName: string;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeCounter: CodeCounterService,
  ) {}

  async list(query: ListLocationsQueryDto) {
    if (query.tree === true) {
      return this.tree(query);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        select: LOCATION_LIST_SELECT,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.location.count({ where }),
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

  async tree(query: ListLocationsQueryDto) {
    const activeFilter =
      query.active === undefined ? {} : { active: query.active === 'true' };

    const sedes = await this.prisma.location.findMany({
      where: { type: 'SEDE', ...activeFilter },
      select: {
        ...LOCATION_LIST_SELECT,
        children: {
          where: activeFilter,
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            parentId: true,
            address: true,
            active: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: sedes.map((sede) => ({
        ...this.toView(sede),
        children: sede.children,
      })),
    };
  }

  async get(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: LOCATION_DETAIL_SELECT,
    });
    if (location === null) {
      throw ApiError.notFound('La ubicación no existe.');
    }
    return this.toView(location);
  }

  async create(dto: CreateLocationDto, actor: Actor, context: RequestContext) {
    const parentId = await this.resolveParent(dto.type, dto.parentId);
    await this.assertNameAvailable(dto.name, parentId);
    const address = normalizeOptionalText(dto.address);

    const id = await this.prisma.$transaction(async (tx) => {
      const code = await this.codeCounter.nextCode(LOCATION_COUNTER, tx);
      const created = await tx.location.create({
        data: {
          id: randomUUID(),
          code,
          name: dto.name,
          type: dto.type,
          parentId,
          address,
          createdById: actor.id,
        },
        select: { id: true, code: true },
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'LOCATION_CREATED',
          entityType: 'LOCATION',
          entityId: created.id,
          afterData: {
            code: created.code,
            name: dto.name,
            type: dto.type,
            parentId,
            address,
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );

      return created.id;
    });

    return this.get(id);
  }

  async update(
    id: string,
    dto: UpdateLocationDto,
    actor: Actor,
    context: RequestContext,
  ) {
    const existing = await this.prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        address: true,
        active: true,
        _count: {
          select: {
            extinguishers: true,
            movementsOrigin: true,
            movementsDestination: true,
            maintenanceOrders: true,
          },
        },
      },
    });
    if (existing === null) {
      throw ApiError.notFound('La ubicación no existe.');
    }

    let nextParentId = existing.parentId;
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      if (existing.type === 'SEDE') {
        throw ApiError.unprocessable(
          ErrorCodes.LOCATION_PARENT_TYPE,
          'Una sede no puede tener padre.',
        );
      }
      const history =
        existing._count.extinguishers +
        existing._count.movementsOrigin +
        existing._count.movementsDestination +
        existing._count.maintenanceOrders;
      if (history > 0) {
        throw ApiError.conflict(
          ErrorCodes.CONFLICT,
          'No se puede cambiar el padre: la ubicación tiene activos o historial.',
        );
      }
      nextParentId = await this.resolveParent(existing.type, dto.parentId, id);
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name, nextParentId, id);
    }

    const data: Prisma.LocationUpdateInput = {};
    const nextAddress =
      dto.address === undefined
        ? existing.address
        : normalizeOptionalText(dto.address);
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.address !== undefined) {
      data.address = nextAddress;
    }
    if (nextParentId !== existing.parentId) {
      if (nextParentId === null) {
        throw ApiError.unprocessable(
          ErrorCodes.LOCATION_PARENT_TYPE,
          'El padre es obligatorio para almacenes, áreas y talleres.',
        );
      }
      data.parent = { connect: { id: nextParentId } };
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.location.update({ where: { id }, data });
        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'LOCATION_UPDATED',
            entityType: 'LOCATION',
            entityId: id,
            beforeData: {
              name: existing.name,
              parentId: existing.parentId,
              address: existing.address,
            },
            afterData: {
              name: dto.name ?? existing.name,
              parentId: nextParentId,
              address: nextAddress,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );
      });
    }

    return this.get(id);
  }

  async deactivate(
    id: string,
    actor: Actor,
    context: RequestContext,
  ): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        _count: { select: { extinguishers: true } },
      },
    });
    if (location === null) {
      throw ApiError.notFound('La ubicación no existe.');
    }
    if (!location.active) {
      return;
    }

    if (location._count.extinguishers > 0) {
      throw ApiError.conflict(
        ErrorCodes.CONFLICT,
        'No se puede desactivar: la ubicación tiene extintores. Trasládalos primero.',
      );
    }

    const activeChildren = await this.prisma.location.count({
      where: { parentId: id, active: true },
    });
    if (activeChildren > 0) {
      throw ApiError.conflict(
        ErrorCodes.CONFLICT,
        'No se puede desactivar: la sede tiene ubicaciones activas.',
      );
    }

    const openOrders = await this.prisma.maintenanceOrder.count({
      where: {
        workshopLocationId: id,
        status: { in: ['ABIERTA', 'EN_PROVEEDOR'] },
      },
    });
    if (openOrders > 0) {
      throw ApiError.conflict(
        ErrorCodes.CONFLICT,
        'No se puede desactivar: el taller tiene órdenes de mantenimiento activas.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.location.update({ where: { id }, data: { active: false } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'LOCATION_DEACTIVATED',
          entityType: 'LOCATION',
          entityId: id,
          beforeData: {
            code: location.code,
            name: location.name,
            active: true,
          },
          afterData: { active: false },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );
    });
  }

  async listExtinguishers(
    id: string,
    query: ListLocationExtinguishersQueryDto,
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        children: { select: { id: true } },
      },
    });
    if (location === null) {
      throw ApiError.notFound('La ubicación no existe.');
    }

    const locationIds =
      location.type === 'SEDE'
        ? location.children.map((child) => child.id)
        : [location.id];

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExtinguisherWhereInput = {
      currentLocationId: { in: locationIds },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.extinguisher.findMany({
        where,
        select: {
          id: true,
          assetCode: true,
          serialNumber: true,
          capacityValue: true,
          capacityUnit: true,
          logisticsStatus: true,
          technicalCondition: true,
          currentSince: true,
          rowVersion: true,
          type: { select: { code: true, name: true } },
        },
        orderBy: { assetCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.extinguisher.count({ where }),
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

  private buildWhere(query: ListLocationsQueryDto): Prisma.LocationWhereInput {
    const where: Prisma.LocationWhereInput = {};
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }
    if (query.type !== undefined) {
      where.type = query.type;
    }
    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    }
    if (query.search !== undefined && query.search !== '') {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    return where;
  }

  /**
   * Valida la jerarquía de dos niveles (D-02 / BR-027A/B) y la ausencia de
   * ciclos (BR-027).
   */
  private async resolveParent(
    type: LocationType,
    parentId: string | null | undefined,
    currentId?: string,
  ): Promise<string | null> {
    if (type === 'SEDE') {
      if (parentId !== undefined && parentId !== null) {
        throw ApiError.unprocessable(
          ErrorCodes.LOCATION_PARENT_TYPE,
          'Una sede no puede tener padre.',
        );
      }
      return null;
    }

    if (parentId === undefined || parentId === null) {
      throw ApiError.unprocessable(
        ErrorCodes.LOCATION_PARENT_TYPE,
        'El padre es obligatorio para almacenes, áreas y talleres.',
      );
    }

    let cursor = await this.prisma.location.findUnique({
      where: { id: parentId },
      select: { id: true, type: true, active: true, parentId: true },
    });

    if (cursor === null) {
      throw ApiError.unprocessable(
        ErrorCodes.LOCATION_PARENT_TYPE,
        'El padre indicado no existe.',
      );
    }
    if (!cursor.active) {
      throw ApiError.unprocessable(
        ErrorCodes.LOCATION_PARENT_TYPE,
        'El padre indicado está inactivo.',
      );
    }
    if (cursor.type !== 'SEDE') {
      throw ApiError.unprocessable(
        ErrorCodes.LOCATION_DEPTH,
        'Solo una sede puede ser padre; la jerarquía tiene dos niveles.',
      );
    }

    // Defensa ante datos antiguos o cambios futuros: recorrer ancestros.
    const visited = new Set<string>();
    if (currentId !== undefined) {
      visited.add(currentId);
    }
    while (cursor !== null) {
      if (visited.has(cursor.id)) {
        throw ApiError.unprocessable(
          ErrorCodes.LOCATION_CYCLE,
          'La jerarquía de ubicaciones no puede tener ciclos.',
        );
      }
      visited.add(cursor.id);
      cursor =
        cursor.parentId === null
          ? null
          : await this.prisma.location.findUnique({
              where: { id: cursor.parentId },
              select: { id: true, type: true, active: true, parentId: true },
            });
    }

    return parentId;
  }

  private async assertNameAvailable(
    name: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.location.findFirst({
      where: {
        parentId,
        name,
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw ApiError.conflict(
        ErrorCodes.LOCATION_NAME_DUPLICATE,
        'Ya existe una ubicación con ese nombre en la misma sede.',
      );
    }
  }

  private toView(row: LocationRow | LocationDetailRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      address: row.address,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      parent: row.parent,
      counts: row._count,
      ...('children' in row ? { children: row.children } : {}),
    };
  }
}
