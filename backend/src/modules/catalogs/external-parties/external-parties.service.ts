import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../../common/errors/api-error';
import { ErrorCodes } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { RequestContext } from '../../auth/auth.service';
import {
  CreateExternalPartyDto,
  ListExternalPartiesQueryDto,
  UpdateExternalPartyDto,
} from './dto/external-parties.dto';

const PARTY_SELECT = {
  id: true,
  code: true,
  name: true,
  partyType: true,
  taxId: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { extinguishers: true, maintenanceOrders: true } },
} satisfies Prisma.ExternalPartySelect;

type PartyRow = Prisma.ExternalPartyGetPayload<{
  select: typeof PARTY_SELECT;
}>;

interface Actor {
  id: string;
  fullName: string;
}

@Injectable()
export class ExternalPartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListExternalPartiesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExternalPartyWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }
    if (query.partyType !== undefined) {
      where.partyType = query.partyType;
    }
    if (query.search !== undefined && query.search !== '') {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { taxId: { contains: query.search } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.externalParty.findMany({
        where,
        select: PARTY_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.externalParty.count({ where }),
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
    dto: CreateExternalPartyDto,
    actor: Actor,
    context: RequestContext,
  ) {
    await this.assertCodeAvailable(dto.code);

    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.externalParty.create({
        data: {
          id,
          code: dto.code,
          name: dto.name,
          partyType: dto.partyType,
          taxId: dto.taxId ?? null,
          contactName: dto.contactName ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          notes: dto.notes ?? null,
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTERNAL_PARTY_CREATED',
          entityType: 'EXTERNAL_PARTY',
          entityId: id,
          afterData: {
            code: dto.code,
            name: dto.name,
            partyType: dto.partyType,
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
    dto: UpdateExternalPartyDto,
    actor: Actor,
    context: RequestContext,
  ) {
    const existing = await this.prisma.externalParty.findUnique({
      where: { id },
      select: PARTY_SELECT,
    });
    if (existing === null) {
      throw ApiError.notFound('La contraparte externa no existe.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.externalParty.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.partyType === undefined ? {} : { partyType: dto.partyType }),
          ...(dto.taxId === undefined ? {} : { taxId: dto.taxId }),
          ...(dto.contactName === undefined
            ? {}
            : { contactName: dto.contactName }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone }),
          ...(dto.email === undefined ? {} : { email: dto.email }),
          ...(dto.address === undefined ? {} : { address: dto.address }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTERNAL_PARTY_UPDATED',
          entityType: 'EXTERNAL_PARTY',
          entityId: id,
          beforeData: {
            name: existing.name,
            partyType: existing.partyType,
            active: existing.active,
          },
          afterData: {
            name: dto.name ?? existing.name,
            partyType: dto.partyType ?? existing.partyType,
            active: dto.active ?? existing.active,
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
    const party = await this.prisma.externalParty.findUnique({
      where: { id },
      select: PARTY_SELECT,
    });
    if (party === null) {
      throw ApiError.notFound('La contraparte externa no existe.');
    }
    return this.toView(party);
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const duplicate = await this.prisma.externalParty.findUnique({
      where: { code },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw ApiError.conflict(
        ErrorCodes.CONFLICT,
        'Ya existe una contraparte externa con ese código.',
      );
    }
  }

  private toView(row: PartyRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      partyType: row.partyType,
      taxId: row.taxId,
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      address: row.address,
      notes: row.notes,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      extinguisherCount: row._count.extinguishers,
      maintenanceOrderCount: row._count.maintenanceOrders,
    };
  }
}
