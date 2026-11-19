import { Inject, Injectable } from '@nestjs/common';
import { MaintenanceOrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { hashPayload } from '../../common/idempotency/request-hash';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  applyDueDateProjection,
  eventTypeForService,
} from '../due-dates/due-date-projection';
import {
  EXTINGUISHER_DETAIL_SELECT,
  toExtinguisherDetail,
} from '../extinguishers/extinguisher-view';
import {
  Tx,
  assertRowVersion,
  locationLabel,
  lockAsset,
  nextSequence,
  normalizeOptionalText,
  requireText,
  resolveActiveLocation,
  snapshotOrigin,
  toPolicyState,
} from '../movements/movement-core';
import { validateMovedAt } from '../movements/movement-policy';
import { MOVEMENT_SELECT, toMovementView } from '../movements/movement-view';
import {
  CreateServiceDto,
  ListMaintenanceOrdersQueryDto,
  ReturnFromMaintenanceDto,
  SendToMaintenanceDto,
} from './dto/maintenance.dto';
import {
  assertNotRetired,
  calendarDateOf,
  normalizeCostCurrency,
  parseEventInstant,
  parseOptionalCalendarDate,
  statusForReturnLocation,
  validateEventInstant,
  validateNextDueDate,
  validateReturnInstant,
} from './maintenance-policy';
import {
  MAINTENANCE_ORDER_DETAIL_SELECT,
  MAINTENANCE_ORDER_SELECT,
  MAINTENANCE_SERVICE_SELECT,
  toMaintenanceOrderDetailView,
  toMaintenanceOrderView,
  toMaintenanceServiceView,
} from './maintenance-view';

const ACTIVE_STATUSES: MaintenanceOrderStatus[] = ['ABIERTA', 'EN_PROVEEDOR'];

interface LockedOrder {
  id: string;
  extinguisherId: string;
  providerId: string | null;
  workshopLocationId: string | null;
  status: MaintenanceOrderStatus;
  openedAt: Date;
  sentMovementId: string;
  returnMovementId: string | null;
}

interface SendParty {
  kind: 'EXTERNAL' | 'INTERNAL';
  providerId: string | null;
  workshopLocationId: string | null;
  label: string;
}

export interface MaintenanceOperationBody {
  maintenanceOrder: ReturnType<typeof toMaintenanceOrderView>;
  movement: ReturnType<typeof toMovementView>;
  extinguisher: ReturnType<typeof toExtinguisherDetail>;
}

export interface MaintenanceOperationResult {
  replayed: boolean;
  body: MaintenanceOperationBody;
}

export interface ServiceOperationResult {
  replayed: boolean;
  service: ReturnType<typeof toMaintenanceServiceView>;
}

function orderNotFound(): ApiError {
  return new ApiError(
    404,
    ErrorCodes.MAINTENANCE_ORDER_NOT_FOUND,
    'La orden de mantenimiento no existe.',
  );
}

function orderClosed(): ApiError {
  return new ApiError(
    409,
    ErrorCodes.MAINTENANCE_ORDER_CLOSED,
    'La orden de mantenimiento ya está cerrada o cancelada.',
  );
}

function orderActive(): ApiError {
  return new ApiError(
    409,
    ErrorCodes.MAINTENANCE_ORDER_ACTIVE,
    'El extintor ya tiene una orden de mantenimiento activa.',
  );
}

async function lockOrder(tx: Tx, orderId: string): Promise<LockedOrder> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM maintenance_orders WHERE id = ${orderId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw orderNotFound();
  }
  const order = await tx.maintenanceOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      extinguisherId: true,
      providerId: true,
      workshopLocationId: true,
      status: true,
      openedAt: true,
      sentMovementId: true,
      returnMovementId: true,
    },
  });
  if (order === null) {
    throw orderNotFound();
  }
  return order;
}

function hashSend(extinguisherId: string, dto: SendToMaintenanceDto): string {
  return hashPayload({
    action: 'MAINTENANCE_SEND',
    extinguisherId,
    providerId: dto.providerId ?? null,
    workshopLocationId: dto.workshopLocationId ?? null,
    expectedReturnDate: dto.expectedReturnDate ?? null,
    movedAt: dto.movedAt,
    authorizedBy: dto.authorizedBy ?? null,
    deliveredBy: dto.deliveredBy,
    reason: dto.reason,
    documentRef: dto.documentRef ?? null,
    notes: dto.notes ?? null,
    rowVersion: dto.rowVersion,
  });
}

function hashService(
  scope: { orderId: string } | { extinguisherId: string },
  dto: CreateServiceDto,
): string {
  return hashPayload({
    action: 'MAINTENANCE_SERVICE',
    scope,
    serviceType: dto.serviceType,
    performedAt: dto.performedAt,
    performedByUserId: dto.performedByUserId ?? null,
    providerId: dto.providerId ?? null,
    result: dto.result,
    certificateNo: dto.certificateNo ?? null,
    certificateDate: dto.certificateDate ?? null,
    nextDueDate: dto.nextDueDate ?? null,
    cost: dto.cost ?? null,
    currency: dto.currency ?? null,
    notes: dto.notes ?? null,
    documentRef: dto.documentRef ?? null,
  });
}

function hashReturn(orderId: string, dto: ReturnFromMaintenanceDto): string {
  return hashPayload({
    action: 'MAINTENANCE_RETURN',
    orderId,
    destinationLocationId: dto.destinationLocationId,
    movedAt: dto.movedAt,
    deliveredBy: dto.deliveredBy ?? null,
    receivedBy: dto.receivedBy,
    authorizedBy: dto.authorizedBy ?? null,
    reason: dto.reason,
    documentRef: dto.documentRef ?? null,
    notes: dto.notes ?? null,
    rowVersion: dto.rowVersion,
  });
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async sendToMaintenance(
    extinguisherId: string,
    dto: SendToMaintenanceDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MaintenanceOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashSend(extinguisherId, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/maintenance/send`,
        resourceType: 'MAINTENANCE_ORDER',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertRowVersion(asset, dto.rowVersion);
        assertNotRetired(asset);
        if (asset.activeOrder !== null) {
          throw orderActive();
        }

        const movedAt = parseEventInstant(dto.movedAt, 'movedAt');
        validateMovedAt(movedAt, toPolicyState(asset));
        const expectedReturnDate = parseOptionalCalendarDate(
          dto.expectedReturnDate,
          'expectedReturnDate',
        );
        const party = await this.resolveSendParty(tx, dto);
        const origin = snapshotOrigin(asset);
        const assetSequence = nextSequence(asset);
        const movementId = randomUUID();
        const orderId = randomUUID();

        await tx.movement.create({
          data: {
            id: movementId,
            extinguisherId,
            assetSequence,
            movementType: 'ENVIO_MANTENIMIENTO',
            originKind: origin.kind,
            originLocationId: origin.locationId,
            originExternalPartyId: origin.externalPartyId,
            originLabel: origin.label,
            destinationKind:
              party.kind === 'EXTERNAL' ? 'EXTERNAL_PARTY' : 'LOCATION',
            destinationLocationId: party.workshopLocationId,
            destinationExternalPartyId: party.providerId,
            destinationLabel: party.label,
            movedAt,
            authorizedBy: normalizeOptionalText(dto.authorizedBy),
            deliveredBy: requireText(dto.deliveredBy, 'deliveredBy'),
            reason: dto.reason,
            documentRef: normalizeOptionalText(dto.documentRef),
            notes: normalizeOptionalText(dto.notes),
            createdById: actor.id,
          },
        });

        await tx.maintenanceOrder.create({
          data: {
            id: orderId,
            extinguisherId,
            providerId: party.providerId,
            workshopLocationId: party.workshopLocationId,
            status: 'EN_PROVEEDOR',
            sentMovementId: movementId,
            openedAt: movedAt,
            expectedReturnDate,
            reason: dto.reason,
            authorizedBy: normalizeOptionalText(dto.authorizedBy),
            documentRef: normalizeOptionalText(dto.documentRef),
            notes: normalizeOptionalText(dto.notes),
            createdById: actor.id,
          },
        });

        await tx.extinguisher.update({
          where: { id: extinguisherId },
          data: {
            logisticsStatus: 'EN_MANTENIMIENTO',
            placementType: party.kind === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
            currentLocationId: party.workshopLocationId,
            currentExternalPartyId: party.providerId,
            currentSince: movedAt,
            rowVersion: { increment: 1 },
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MAINTENANCE_ORDER_CREATED',
            entityType: 'MAINTENANCE_ORDER',
            entityId: orderId,
            afterData: {
              extinguisherId,
              assetCode: asset.assetCode,
              movementId,
              assetSequence,
              destination: party.label,
              openedAt: movedAt.toISOString(),
              expectedReturnDate:
                expectedReturnDate === null
                  ? null
                  : expectedReturnDate.toISOString().slice(0, 10),
              documentRef: normalizeOptionalText(dto.documentRef),
              rowVersionBefore: asset.rowVersion,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: orderId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await this.buildOperationBody(outcome.resourceId, false),
    };
  }

  async registerOrderService(
    orderId: string,
    dto: CreateServiceDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<ServiceOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashService({ orderId }, dto),
        path: `/api/v1/maintenance-orders/${orderId}/services`,
        resourceType: 'MAINTENANCE_SERVICE',
      },
      async (tx) => {
        const order = await lockOrder(tx, orderId);
        if (!ACTIVE_STATUSES.includes(order.status)) {
          throw orderClosed();
        }
        const asset = await lockAsset(tx, order.extinguisherId);
        assertNotRetired(asset);

        const performedAt = parseEventInstant(dto.performedAt, 'performedAt');
        validateEventInstant(performedAt, {
          assetCreatedAt: asset.createdAt,
          orderOpenedAt: order.openedAt,
          field: 'performedAt',
        });
        const performedOn = calendarDateOf(performedAt, this.env.timezone);
        const nextDueDate = parseOptionalCalendarDate(
          dto.nextDueDate,
          'nextDueDate',
        );
        validateNextDueDate(nextDueDate, performedOn);
        const certificateDate = parseOptionalCalendarDate(
          dto.certificateDate,
          'certificateDate',
        );
        const cost = normalizeCostCurrency(dto.cost, dto.currency);
        const serviceActors = await this.resolveServiceActors(tx, order, dto);

        const serviceId = randomUUID();
        await tx.maintenanceService.create({
          data: {
            id: serviceId,
            extinguisherId: order.extinguisherId,
            maintenanceOrderId: order.id,
            serviceType: dto.serviceType,
            performedAt,
            performedOn,
            performedByUserId: serviceActors.performedByUserId,
            providerId: serviceActors.providerId,
            result: dto.result,
            certificateNo: normalizeOptionalText(dto.certificateNo),
            certificateDate,
            nextDueDate,
            cost: cost.cost,
            currency: cost.currency,
            notes: normalizeOptionalText(dto.notes),
            documentRef: normalizeOptionalText(dto.documentRef),
            createdById: actor.id,
          },
        });

        await applyDueDateProjection(tx, {
          extinguisherId: order.extinguisherId,
          eventType: eventTypeForService(dto.serviceType),
          dueDate: nextDueDate,
          sourceType: 'MAINTENANCE_SERVICE',
          sourceId: serviceId,
          sourceEventAt: performedAt,
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MAINTENANCE_SERVICE_CREATED',
            entityType: 'MAINTENANCE_SERVICE',
            entityId: serviceId,
            afterData: {
              extinguisherId: order.extinguisherId,
              assetCode: asset.assetCode,
              maintenanceOrderId: order.id,
              serviceType: dto.serviceType,
              performedAt: performedAt.toISOString(),
              result: dto.result,
              nextDueDate:
                nextDueDate === null
                  ? null
                  : nextDueDate.toISOString().slice(0, 10),
              cost: cost.cost,
              currency: cost.currency,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: serviceId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      service: await this.buildServiceBody(outcome.resourceId),
    };
  }

  async registerStandaloneService(
    extinguisherId: string,
    dto: CreateServiceDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<ServiceOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashService({ extinguisherId }, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/services`,
        resourceType: 'MAINTENANCE_SERVICE',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertNotRetired(asset);
        if (asset.activeOrder !== null) {
          throw new ApiError(
            409,
            ErrorCodes.MAINTENANCE_ORDER_ACTIVE,
            'Registra el servicio dentro de la orden de mantenimiento activa.',
          );
        }

        const performedAt = parseEventInstant(dto.performedAt, 'performedAt');
        validateEventInstant(performedAt, {
          assetCreatedAt: asset.createdAt,
          field: 'performedAt',
        });
        const performedOn = calendarDateOf(performedAt, this.env.timezone);
        const nextDueDate = parseOptionalCalendarDate(
          dto.nextDueDate,
          'nextDueDate',
        );
        validateNextDueDate(nextDueDate, performedOn);
        const certificateDate = parseOptionalCalendarDate(
          dto.certificateDate,
          'certificateDate',
        );
        const cost = normalizeCostCurrency(dto.cost, dto.currency);

        if (dto.providerId !== undefined) {
          throw ApiError.unprocessable(
            ErrorCodes.PROVIDER_INVALID,
            'El servicio sin orden es interno y no admite proveedor externo.',
            { field: 'providerId' },
          );
        }
        if (dto.performedByUserId === undefined) {
          throw ApiError.unprocessable(
            ErrorCodes.VALIDATION_ERROR,
            'El servicio interno sin orden exige performedByUserId.',
            { field: 'performedByUserId' },
          );
        }
        await this.assertActiveUser(tx, dto.performedByUserId);

        const serviceId = randomUUID();
        await tx.maintenanceService.create({
          data: {
            id: serviceId,
            extinguisherId,
            maintenanceOrderId: null,
            serviceType: dto.serviceType,
            performedAt,
            performedOn,
            performedByUserId: dto.performedByUserId,
            providerId: null,
            result: dto.result,
            certificateNo: normalizeOptionalText(dto.certificateNo),
            certificateDate,
            nextDueDate,
            cost: cost.cost,
            currency: cost.currency,
            notes: normalizeOptionalText(dto.notes),
            documentRef: normalizeOptionalText(dto.documentRef),
            createdById: actor.id,
          },
        });

        await applyDueDateProjection(tx, {
          extinguisherId,
          eventType: eventTypeForService(dto.serviceType),
          dueDate: nextDueDate,
          sourceType: 'MAINTENANCE_SERVICE',
          sourceId: serviceId,
          sourceEventAt: performedAt,
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MAINTENANCE_SERVICE_CREATED',
            entityType: 'MAINTENANCE_SERVICE',
            entityId: serviceId,
            afterData: {
              extinguisherId,
              assetCode: asset.assetCode,
              maintenanceOrderId: null,
              serviceType: dto.serviceType,
              performedAt: performedAt.toISOString(),
              result: dto.result,
              nextDueDate:
                nextDueDate === null
                  ? null
                  : nextDueDate.toISOString().slice(0, 10),
              cost: cost.cost,
              currency: cost.currency,
              standalone: true,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: serviceId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      service: await this.buildServiceBody(outcome.resourceId),
    };
  }

  async returnFromMaintenance(
    orderId: string,
    dto: ReturnFromMaintenanceDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MaintenanceOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashReturn(orderId, dto),
        path: `/api/v1/maintenance-orders/${orderId}/return`,
        resourceType: 'MAINTENANCE_ORDER',
      },
      async (tx) => {
        const order = await lockOrder(tx, orderId);
        if (!ACTIVE_STATUSES.includes(order.status)) {
          throw orderClosed();
        }
        const asset = await lockAsset(tx, order.extinguisherId);
        assertRowVersion(asset, dto.rowVersion);
        assertNotRetired(asset);

        const lastService = await tx.maintenanceService.findFirst({
          where: { maintenanceOrderId: order.id },
          orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
          select: { performedAt: true },
        });
        if (lastService === null) {
          throw ApiError.unprocessable(
            ErrorCodes.MAINTENANCE_SERVICE_REQUIRED,
            'No se puede cerrar la orden sin al menos un servicio registrado.',
          );
        }

        const movedAt = parseEventInstant(dto.movedAt, 'movedAt');
        validateReturnInstant(movedAt, order.openedAt, lastService.performedAt);
        this.assertReturnOrigin(asset, order);

        const destination = await resolveActiveLocation(
          tx,
          dto.destinationLocationId,
        );
        const logisticsStatus = statusForReturnLocation(destination.type);
        const documentRef = normalizeOptionalText(dto.documentRef);
        if (order.providerId !== null && documentRef === null) {
          throw ApiError.unprocessable(
            ErrorCodes.VALIDATION_ERROR,
            'El retorno desde un proveedor externo exige documentRef.',
            { field: 'documentRef' },
          );
        }

        const origin = snapshotOrigin(asset);
        const assetSequence = nextSequence(asset);
        const movementId = randomUUID();

        await tx.movement.create({
          data: {
            id: movementId,
            extinguisherId: order.extinguisherId,
            assetSequence,
            movementType: 'RETORNO_MANTENIMIENTO',
            originKind: origin.kind,
            originLocationId: origin.locationId,
            originExternalPartyId: origin.externalPartyId,
            originLabel: origin.label,
            destinationKind: 'LOCATION',
            destinationLocationId: destination.id,
            destinationLabel: locationLabel(destination),
            movedAt,
            authorizedBy: normalizeOptionalText(dto.authorizedBy),
            deliveredBy: normalizeOptionalText(dto.deliveredBy),
            receivedBy: requireText(dto.receivedBy, 'receivedBy'),
            reason: dto.reason,
            documentRef,
            notes: normalizeOptionalText(dto.notes),
            createdById: actor.id,
          },
        });

        await tx.extinguisher.update({
          where: { id: order.extinguisherId },
          data: {
            logisticsStatus,
            placementType: 'INTERNAL',
            currentLocationId: destination.id,
            currentExternalPartyId: null,
            currentSince: movedAt,
            rowVersion: { increment: 1 },
          },
        });

        await tx.maintenanceOrder.update({
          where: { id: order.id },
          data: {
            status: 'CERRADA',
            closedAt: movedAt,
            returnMovementId: movementId,
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MAINTENANCE_ORDER_CLOSED',
            entityType: 'MAINTENANCE_ORDER',
            entityId: order.id,
            beforeData: {
              status: order.status,
              openedAt: order.openedAt.toISOString(),
            },
            afterData: {
              extinguisherId: order.extinguisherId,
              assetCode: asset.assetCode,
              movementId,
              assetSequence,
              destination: locationLabel(destination),
              logisticsStatus,
              closedAt: movedAt.toISOString(),
              rowVersionBefore: asset.rowVersion,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: order.id, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await this.buildOperationBody(outcome.resourceId, true),
    };
  }

  async list(query: ListMaintenanceOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.maintenanceOrder.findMany({
        where,
        select: MAINTENANCE_ORDER_SELECT,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.maintenanceOrder.count({ where }),
    ]);

    return {
      data: rows.map((row) => toMaintenanceOrderView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async get(id: string) {
    const row = await this.prisma.maintenanceOrder.findUnique({
      where: { id },
      select: MAINTENANCE_ORDER_DETAIL_SELECT,
    });
    if (row === null) {
      throw orderNotFound();
    }
    return toMaintenanceOrderDetailView(row);
  }

  private buildWhere(
    query: ListMaintenanceOrdersQueryDto,
  ): Prisma.MaintenanceOrderWhereInput {
    const and: Prisma.MaintenanceOrderWhereInput[] = [];

    if (query.status !== undefined) {
      and.push({ status: query.status });
    }
    if (query.providerId !== undefined) {
      and.push({ providerId: query.providerId });
    }
    if (query.workshopLocationId !== undefined) {
      and.push({ workshopLocationId: query.workshopLocationId });
    }
    if (query.extinguisherId !== undefined) {
      and.push({ extinguisherId: query.extinguisherId });
    }
    if (query.assetCode !== undefined) {
      and.push({
        extinguisher: {
          assetCode: { contains: query.assetCode.toUpperCase() },
        },
      });
    }
    if (
      query.expectedReturnFrom !== undefined ||
      query.expectedReturnTo !== undefined
    ) {
      and.push({
        expectedReturnDate: {
          ...(query.expectedReturnFrom === undefined
            ? {}
            : { gte: new Date(`${query.expectedReturnFrom}T00:00:00.000Z`) }),
          ...(query.expectedReturnTo === undefined
            ? {}
            : { lte: new Date(`${query.expectedReturnTo}T00:00:00.000Z`) }),
        },
      });
    }

    return and.length === 0 ? {} : { AND: and };
  }

  private buildOrderBy(
    sort: string | undefined,
  ): Prisma.MaintenanceOrderOrderByWithRelationInput {
    const value = sort ?? '-openedAt';
    if (value.startsWith('-')) {
      return { [value.slice(1)]: 'desc' };
    }
    return { [value]: 'asc' };
  }

  private async resolveSendParty(
    tx: Tx,
    dto: SendToMaintenanceDto,
  ): Promise<SendParty> {
    const hasProvider = dto.providerId !== undefined;
    const hasWorkshop = dto.workshopLocationId !== undefined;
    if (hasProvider === hasWorkshop) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'Indica exactamente un proveedor externo o un taller interno.',
        { field: 'providerId' },
      );
    }

    if (hasProvider) {
      const provider = await tx.externalParty.findUnique({
        where: { id: dto.providerId },
        select: {
          id: true,
          code: true,
          name: true,
          partyType: true,
          active: true,
        },
      });
      if (
        provider === null ||
        !provider.active ||
        (provider.partyType !== 'PROVEEDOR_MANTENIMIENTO' &&
          provider.partyType !== 'TALLER')
      ) {
        throw ApiError.unprocessable(
          ErrorCodes.PROVIDER_INVALID,
          'El proveedor de mantenimiento no existe, está inactivo o no es del tipo correcto.',
          { field: 'providerId' },
        );
      }
      if (normalizeOptionalText(dto.documentRef) === null) {
        throw ApiError.unprocessable(
          ErrorCodes.VALIDATION_ERROR,
          'El envío a un proveedor externo exige documentRef.',
          { field: 'documentRef' },
        );
      }
      return {
        kind: 'EXTERNAL',
        providerId: provider.id,
        workshopLocationId: null,
        label: locationLabel(provider),
      };
    }

    const workshop = await resolveActiveLocation(
      tx,
      dto.workshopLocationId as string,
      'workshopLocationId',
      'El taller interno no existe o está inactivo.',
    );
    if (workshop.type !== 'TALLER') {
      throw ApiError.unprocessable(
        ErrorCodes.DESTINATION_INVALID,
        'El taller interno debe ser una ubicación de tipo TALLER.',
        { field: 'workshopLocationId' },
      );
    }
    return {
      kind: 'INTERNAL',
      providerId: null,
      workshopLocationId: workshop.id,
      label: locationLabel(workshop),
    };
  }

  private async resolveServiceActors(
    tx: Tx,
    order: LockedOrder,
    dto: CreateServiceDto,
  ): Promise<{ providerId: string | null; performedByUserId: string | null }> {
    if (order.providerId !== null) {
      if (dto.providerId === undefined) {
        throw ApiError.unprocessable(
          ErrorCodes.VALIDATION_ERROR,
          'El servicio de una orden externa exige providerId.',
          { field: 'providerId' },
        );
      }
      if (dto.providerId !== order.providerId) {
        throw ApiError.unprocessable(
          ErrorCodes.PROVIDER_INVALID,
          'El proveedor del servicio debe coincidir con el proveedor de la orden.',
          { field: 'providerId' },
        );
      }
      if (dto.performedByUserId !== undefined) {
        await this.assertActiveUser(tx, dto.performedByUserId);
      }
      return {
        providerId: order.providerId,
        performedByUserId: dto.performedByUserId ?? null,
      };
    }

    if (dto.providerId !== undefined) {
      throw ApiError.unprocessable(
        ErrorCodes.PROVIDER_INVALID,
        'El servicio de un taller interno no admite proveedor externo.',
        { field: 'providerId' },
      );
    }
    if (dto.performedByUserId === undefined) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El servicio interno exige performedByUserId.',
        { field: 'performedByUserId' },
      );
    }
    await this.assertActiveUser(tx, dto.performedByUserId);
    return {
      providerId: null,
      performedByUserId: dto.performedByUserId,
    };
  }

  private async assertActiveUser(tx: Tx, userId: string): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { active: true },
    });
    if (user === null || !user.active) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El usuario responsable no existe o está inactivo.',
        { field: 'performedByUserId' },
      );
    }
  }

  private assertReturnOrigin(
    asset: Awaited<ReturnType<typeof lockAsset>>,
    order: LockedOrder,
  ): void {
    const matches =
      order.providerId !== null
        ? asset.placementType === 'EXTERNAL' &&
          asset.currentExternalPartyId === order.providerId
        : asset.placementType === 'INTERNAL' &&
          asset.currentLocationId === order.workshopLocationId;
    if (!matches) {
      throw new ApiError(
        409,
        ErrorCodes.ORIGIN_MISMATCH,
        'El extintor no se encuentra en el proveedor o taller de la orden.',
        {
          expected:
            order.providerId !== null
              ? { externalPartyId: order.providerId }
              : { locationId: order.workshopLocationId },
          received: {
            placementType: asset.placementType,
            currentLocationId: asset.currentLocationId,
            currentExternalPartyId: asset.currentExternalPartyId,
          },
        },
      );
    }
  }

  private async buildOperationBody(
    orderId: string,
    useReturnMovement: boolean,
  ): Promise<MaintenanceOperationBody> {
    const order = await this.prisma.maintenanceOrder.findUnique({
      where: { id: orderId },
      select: MAINTENANCE_ORDER_SELECT,
    });
    if (order === null) {
      throw orderNotFound();
    }
    const movementId = useReturnMovement
      ? order.returnMovementId
      : order.sentMovementId;
    if (movementId === null) {
      throw ApiError.notFound('El movimiento de la orden no existe.');
    }
    const movement = await this.prisma.movement.findUniqueOrThrow({
      where: { id: movementId },
      select: MOVEMENT_SELECT,
    });
    const extinguisher = await this.prisma.extinguisher.findUniqueOrThrow({
      where: { id: order.extinguisherId },
      select: EXTINGUISHER_DETAIL_SELECT,
    });

    return {
      maintenanceOrder: toMaintenanceOrderView(order),
      movement: toMovementView(movement),
      extinguisher: toExtinguisherDetail(extinguisher),
    };
  }

  private async buildServiceBody(
    serviceId: string,
  ): Promise<ReturnType<typeof toMaintenanceServiceView>> {
    const service = await this.prisma.maintenanceService.findUnique({
      where: { id: serviceId },
      select: MAINTENANCE_SERVICE_SELECT,
    });
    if (service === null) {
      throw new ApiError(
        404,
        ErrorCodes.NOT_FOUND,
        'El servicio de mantenimiento no existe.',
      );
    }
    return toMaintenanceServiceView(service);
  }
}
