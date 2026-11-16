/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * La base de pruebas se migra en `global-setup.ts`; aquí solo se limpian las
 * tablas entre casos y se crean datos mínimos reales (sin fechas inventadas).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL?.trim() ||
  'mysql://site:site@localhost:3307/site_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;

export const prisma = new PrismaClient();

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `;

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const { TABLE_NAME } of tables) {
      if (TABLE_NAME === '_prisma_migrations') {
        continue;
      }
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE \`${TABLE_NAME.replace(/`/g, '')}\``,
      );
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  }
}

export interface BaseFixtures {
  userId: string;
  sedeId: string;
  warehouseId: string;
  areaId: string;
  workshopId: string;
  typeId: string;
  providerId: string;
  extinguisherId: string;
}

export async function createBaseFixtures(): Promise<BaseFixtures> {
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      email: `pruebas-${userId}@site.local`,
      passwordHash: '$2b$12$pruebas.integracion.no.es.un.hash.real',
      fullName: 'Usuario de pruebas',
      active: true,
    },
  });

  const sedeId = randomUUID();
  await prisma.location.create({
    data: {
      id: sedeId,
      code: `UBI-${sedeId.slice(0, 8)}`,
      name: 'Sede de pruebas',
      type: 'SEDE',
      createdById: userId,
    },
  });

  const warehouseId = randomUUID();
  await prisma.location.create({
    data: {
      id: warehouseId,
      code: `UBI-${warehouseId.slice(0, 8)}`,
      name: 'Almacén de pruebas',
      type: 'ALMACEN',
      parentId: sedeId,
      createdById: userId,
    },
  });

  const areaId = randomUUID();
  await prisma.location.create({
    data: {
      id: areaId,
      code: `UBI-${areaId.slice(0, 8)}`,
      name: 'Área de pruebas',
      type: 'AREA',
      parentId: sedeId,
      createdById: userId,
    },
  });

  const workshopId = randomUUID();
  await prisma.location.create({
    data: {
      id: workshopId,
      code: `UBI-${workshopId.slice(0, 8)}`,
      name: 'Taller de pruebas',
      type: 'TALLER',
      parentId: sedeId,
      createdById: userId,
    },
  });

  const typeId = randomUUID();
  await prisma.extinguisherType.create({
    data: {
      id: typeId,
      code: `TIPO-${typeId.slice(0, 8)}`,
      name: 'Tipo de pruebas',
      agent: 'PQS',
      nominalCapacity: '6.00',
      capacityUnit: 'KG',
      usefulLifeYears: null,
    },
  });

  const providerId = randomUUID();
  await prisma.externalParty.create({
    data: {
      id: providerId,
      code: `PRV-${providerId.slice(0, 8)}`,
      name: 'Proveedor de pruebas',
      partyType: 'PROVEEDOR_MANTENIMIENTO',
    },
  });

  const extinguisherId = randomUUID();
  await prisma.extinguisher.create({
    data: {
      id: extinguisherId,
      assetCode: `EXT-${extinguisherId.slice(0, 8).toUpperCase()}`,
      typeId,
      capacityValue: '6.00',
      capacityUnit: 'KG',
      logisticsStatus: 'EN_ALMACEN',
      technicalCondition: 'OPERATIVO',
      placementType: 'INTERNAL',
      currentLocationId: warehouseId,
      createdById: userId,
    },
  });

  return {
    userId,
    sedeId,
    warehouseId,
    areaId,
    workshopId,
    typeId,
    providerId,
    extinguisherId,
  };
}

export interface ExtinguisherOverrides {
  assetCode?: string;
  placementType?: 'INTERNAL' | 'EXTERNAL' | 'NONE';
  currentLocationId?: string | null;
  currentExternalPartyId?: string | null;
  logisticsStatus?:
    'EN_ALMACEN' | 'ASIGNADO' | 'EN_MANTENIMIENTO' | 'DADO_DE_BAJA';
  retiredAt?: Date | null;
  rowVersion?: number;
}

export async function createExtinguisher(
  fixtures: BaseFixtures,
  overrides: ExtinguisherOverrides = {},
): Promise<{ id: string; assetCode: string }> {
  const id = randomUUID();
  const assetCode =
    overrides.assetCode ?? `EXT-${id.slice(0, 8).toUpperCase()}`;

  const placementType = overrides.placementType ?? 'INTERNAL';
  const currentLocationId =
    overrides.currentLocationId === undefined
      ? placementType === 'INTERNAL'
        ? fixtures.warehouseId
        : null
      : overrides.currentLocationId;
  const currentExternalPartyId =
    overrides.currentExternalPartyId === undefined
      ? placementType === 'EXTERNAL'
        ? fixtures.providerId
        : null
      : overrides.currentExternalPartyId;

  await prisma.extinguisher.create({
    data: {
      id,
      assetCode,
      typeId: fixtures.typeId,
      capacityValue: '6.00',
      capacityUnit: 'KG',
      logisticsStatus: overrides.logisticsStatus ?? 'EN_ALMACEN',
      technicalCondition: 'OPERATIVO',
      placementType,
      currentLocationId,
      currentExternalPartyId,
      retiredAt: overrides.retiredAt ?? null,
      rowVersion: overrides.rowVersion ?? 1,
      createdById: fixtures.userId,
    },
  });

  return { id, assetCode };
}

export interface MovementOverrides {
  extinguisherId?: string;
  assetSequence?: number;
  movementType?:
    | 'INGRESO'
    | 'SALIDA'
    | 'TRASLADO'
    | 'RETORNO_ALMACEN'
    | 'ENVIO_MANTENIMIENTO'
    | 'RETORNO_MANTENIMIENTO'
    | 'BAJA'
    | 'AJUSTE';
  entrySource?:
    | 'COMPRA_CENTRAL'
    | 'COMPRA_LOCAL'
    | 'CARGA_INICIAL'
    | 'RETORNO_MANTENIMIENTO'
    | 'TRASLADO'
    | null;
  originKind?: 'LOCATION' | 'EXTERNAL_PARTY' | 'NONE';
  originLocationId?: string | null;
  originExternalPartyId?: string | null;
  destinationKind?: 'LOCATION' | 'EXTERNAL_PARTY' | 'NONE';
  destinationLocationId?: string | null;
  destinationExternalPartyId?: string | null;
  reason?: string;
}

export async function createMovement(
  fixtures: BaseFixtures,
  overrides: MovementOverrides = {},
): Promise<string> {
  const id = randomUUID();
  const extinguisherId = overrides.extinguisherId ?? fixtures.extinguisherId;

  await prisma.movement.create({
    data: {
      id,
      extinguisherId,
      assetSequence: overrides.assetSequence ?? 1,
      movementType: overrides.movementType ?? 'INGRESO',
      entrySource:
        overrides.entrySource === undefined
          ? 'COMPRA_CENTRAL'
          : overrides.entrySource,
      originKind: overrides.originKind ?? 'NONE',
      originLocationId: overrides.originLocationId ?? null,
      originExternalPartyId: overrides.originExternalPartyId ?? null,
      originLabel: 'Origen de pruebas',
      destinationKind: overrides.destinationKind ?? 'LOCATION',
      destinationLocationId:
        overrides.destinationLocationId === undefined
          ? fixtures.warehouseId
          : overrides.destinationLocationId,
      destinationExternalPartyId: overrides.destinationExternalPartyId ?? null,
      destinationLabel: 'Destino de pruebas',
      movedAt: new Date('2026-01-15T15:00:00.000Z'),
      reason: overrides.reason ?? 'Movimiento de pruebas',
      createdById: fixtures.userId,
    },
  });

  return id;
}

export interface OrderOverrides {
  extinguisherId?: string;
  providerId?: string | null;
  workshopLocationId?: string | null;
  status?: 'ABIERTA' | 'EN_PROVEEDOR' | 'CERRADA' | 'CANCELADA';
  sentMovementId: string;
  returnMovementId?: string | null;
  closedAt?: Date | null;
}

export async function createOrder(
  fixtures: BaseFixtures,
  overrides: OrderOverrides,
): Promise<string> {
  const id = randomUUID();

  await prisma.maintenanceOrder.create({
    data: {
      id,
      extinguisherId: overrides.extinguisherId ?? fixtures.extinguisherId,
      providerId:
        overrides.providerId === undefined
          ? fixtures.providerId
          : overrides.providerId,
      workshopLocationId: overrides.workshopLocationId ?? null,
      status: overrides.status ?? 'ABIERTA',
      sentMovementId: overrides.sentMovementId,
      returnMovementId: overrides.returnMovementId ?? null,
      openedAt: new Date('2026-02-01T15:00:00.000Z'),
      closedAt: overrides.closedAt ?? null,
      reason: 'Orden de pruebas',
      createdById: fixtures.userId,
    },
  });

  return id;
}

/**
 * Ejecuta una escritura que debe ser rechazada por la base de datos.
 * Devuelve el mensaje de error para poder verificar la restricción concreta.
 */
export async function expectRejection(
  action: () => Promise<unknown>,
): Promise<string> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('La base de datos aceptó una escritura que debía rechazar.');
}
