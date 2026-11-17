import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../../common/errors/api-error';
import { ErrorCodes } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { RequestContext } from '../../auth/auth.service';
import {
  CreateExtinguisherTypeDto,
  ListExtinguisherTypesQueryDto,
  UpdateExtinguisherTypeDto,
} from './dto/extinguisher-types.dto';
import { EquipmentDueDatesService } from './equipment-due-dates.service';

const TYPE_SELECT = {
  id: true,
  code: true,
  name: true,
  agent: true,
  nominalCapacity: true,
  capacityUnit: true,
  usefulLifeYears: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { extinguishers: true } },
} satisfies Prisma.ExtinguisherTypeSelect;

type TypeRow = Prisma.ExtinguisherTypeGetPayload<{
  select: typeof TYPE_SELECT;
}>;

interface Actor {
  id: string;
  fullName: string;
}

@Injectable()
export class ExtinguisherTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dueDates: EquipmentDueDatesService,
  ) {}

  async list(query: ListExtinguisherTypesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExtinguisherTypeWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }
    if (query.search !== undefined && query.search !== '') {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { agent: { contains: query.search } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.extinguisherType.findMany({
        where,
        select: TYPE_SELECT,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.extinguisherType.count({ where }),
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

  async create(
    dto: CreateExtinguisherTypeDto,
    actor: Actor,
    context: RequestContext,
  ) {
    this.assertUsefulLife(dto.usefulLifeYears);
    await this.assertCodeAvailable(dto.code);

    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.extinguisherType.create({
        data: {
          id,
          code: dto.code,
          name: dto.name,
          agent: dto.agent,
          nominalCapacity: dto.nominalCapacity.toFixed(2),
          capacityUnit: dto.capacityUnit,
          usefulLifeYears: dto.usefulLifeYears ?? null,
          description: dto.description ?? null,
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTINGUISHER_TYPE_CREATED',
          entityType: 'EXTINGUISHER_TYPE',
          entityId: id,
          afterData: {
            code: dto.code,
            name: dto.name,
            agent: dto.agent,
            nominalCapacity: dto.nominalCapacity,
            capacityUnit: dto.capacityUnit,
            usefulLifeYears: dto.usefulLifeYears ?? null,
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

  async update(
    id: string,
    dto: UpdateExtinguisherTypeDto,
    actor: Actor,
    context: RequestContext,
  ) {
    const existing = await this.prisma.extinguisherType.findUnique({
      where: { id },
      select: TYPE_SELECT,
    });
    if (existing === null) {
      throw ApiError.notFound('El tipo de extintor no existe.');
    }

    if (dto.usefulLifeYears !== undefined) {
      this.assertUsefulLife(dto.usefulLifeYears);
    }

    const usefulLifeChanged =
      dto.usefulLifeYears !== undefined &&
      dto.usefulLifeYears !== existing.usefulLifeYears;

    await this.prisma.$transaction(async (tx) => {
      await tx.extinguisherType.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.agent === undefined ? {} : { agent: dto.agent }),
          ...(dto.nominalCapacity === undefined
            ? {}
            : { nominalCapacity: dto.nominalCapacity.toFixed(2) }),
          ...(dto.capacityUnit === undefined
            ? {}
            : { capacityUnit: dto.capacityUnit }),
          ...(dto.usefulLifeYears === undefined
            ? {}
            : { usefulLifeYears: dto.usefulLifeYears }),
          ...(dto.description === undefined
            ? {}
            : { description: dto.description }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
        },
      });

      if (usefulLifeChanged) {
        await this.dueDates.recalculateForType(id, tx);
      }

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTINGUISHER_TYPE_UPDATED',
          entityType: 'EXTINGUISHER_TYPE',
          entityId: id,
          beforeData: {
            name: existing.name,
            agent: existing.agent,
            nominalCapacity: existing.nominalCapacity.toFixed(2),
            capacityUnit: existing.capacityUnit,
            usefulLifeYears: existing.usefulLifeYears,
            description: existing.description,
            active: existing.active,
          },
          afterData: {
            name: dto.name ?? existing.name,
            agent: dto.agent ?? existing.agent,
            nominalCapacity:
              dto.nominalCapacity === undefined
                ? existing.nominalCapacity.toFixed(2)
                : dto.nominalCapacity,
            capacityUnit: dto.capacityUnit ?? existing.capacityUnit,
            usefulLifeYears:
              dto.usefulLifeYears === undefined
                ? existing.usefulLifeYears
                : dto.usefulLifeYears,
            description:
              dto.description === undefined
                ? existing.description
                : dto.description,
            active: dto.active ?? existing.active,
            equipmentDueDatesRecalculated: usefulLifeChanged,
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

  async get(id: string) {
    const type = await this.prisma.extinguisherType.findUnique({
      where: { id },
      select: TYPE_SELECT,
    });
    if (type === null) {
      throw ApiError.notFound('El tipo de extintor no existe.');
    }
    return this.toView(type);
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const duplicate = await this.prisma.extinguisherType.findUnique({
      where: { code },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw ApiError.conflict(
        ErrorCodes.CONFLICT,
        'Ya existe un tipo de extintor con ese código.',
      );
    }
  }

  private assertUsefulLife(value: number | null | undefined): void {
    if (value === undefined || value === null) {
      return;
    }
    if (!Number.isInteger(value) || value <= 0 || value > 65535) {
      throw ApiError.unprocessable(
        ErrorCodes.USEFUL_LIFE_INVALID,
        'La vida útil debe ser un entero positivo.',
      );
    }
  }

  private toView(row: TypeRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      agent: row.agent,
      nominalCapacity: row.nominalCapacity.toFixed(2),
      capacityUnit: row.capacityUnit,
      usefulLifeYears: row.usefulLifeYears,
      description: row.description,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      extinguisherCount: row._count.extinguishers,
    };
  }
}
