/**
 * Semilla de desarrollo de SITE (fase 1).
 *
 * - Solo datos ficticios; nunca se ejecuta contra producción.
 * - Idempotente: se puede ejecutar varias veces sin duplicar filas.
 * - No siembra umbrales de alerta (days_before queda nulo) ni fechas técnicas
 *   inventadas: las fechas objetivo solo se crean desde documentos reales.
 * - La contraseña del administrador se toma de SEED_ADMIN_PASSWORD o se genera
 *   aleatoriamente y se muestra una sola vez.
 */
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@site.local';
const BCRYPT_COST = 12;

interface PermissionSeed {
  code: string;
  description: string;
}

const PERMISSIONS: PermissionSeed[] = [
  { code: 'dashboard.read', description: 'Ver el dashboard' },
  { code: 'users.read', description: 'Consultar usuarios' },
  { code: 'users.manage', description: 'Crear, editar y desactivar usuarios' },
  { code: 'roles.manage', description: 'Administrar roles y permisos' },
  { code: 'locations.read', description: 'Consultar ubicaciones' },
  { code: 'locations.manage', description: 'Crear y desactivar ubicaciones' },
  { code: 'catalogs.read', description: 'Consultar tipos y proveedores' },
  { code: 'catalogs.manage', description: 'Administrar tipos y proveedores' },
  { code: 'extinguishers.read', description: 'Consultar fichas de extintores' },
  { code: 'extinguishers.create', description: 'Dar de alta extintores' },
  {
    code: 'extinguishers.update',
    description: 'Actualizar datos técnicos del extintor',
  },
  {
    code: 'extinguishers.condition',
    description: 'Cambiar la condición técnica',
  },
  { code: 'extinguishers.retire', description: 'Dar de baja un extintor' },
  { code: 'movements.read', description: 'Consultar movimientos' },
  { code: 'movements.create', description: 'Registrar movimientos' },
  { code: 'movements.adjust', description: 'Registrar ajustes excepcionales' },
  { code: 'maintenance.read', description: 'Consultar órdenes y servicios' },
  {
    code: 'maintenance.manage',
    description: 'Gestionar órdenes y servicios',
  },
  { code: 'inspections.read', description: 'Consultar inspecciones' },
  { code: 'inspections.create', description: 'Registrar inspecciones' },
  { code: 'alerts.read', description: 'Consultar alertas' },
  { code: 'alerts.settings', description: 'Configurar umbrales de alerta' },
  { code: 'reports.read', description: 'Consultar reportes' },
  { code: 'reports.export', description: 'Exportar reportes a CSV' },
  { code: 'audit.read', description: 'Consultar auditoría' },
  {
    code: 'devices.manage',
    description: 'Registrar y desactivar dispositivos offline',
  },
];

const ROLE_SEEDS: Array<{
  code: string;
  name: string;
  description: string;
  permissions: string[] | 'ALL';
}> = [
  {
    code: 'ADMIN',
    name: 'Administrador',
    description: 'Configuración, usuarios, catálogos y acceso completo',
    permissions: 'ALL',
  },
  {
    code: 'ALMACEN',
    name: 'Encargado de almacén',
    description: 'Altas, movimientos y mantenimiento',
    permissions: [
      'dashboard.read',
      'locations.read',
      'catalogs.read',
      'extinguishers.read',
      'extinguishers.create',
      'extinguishers.update',
      'movements.read',
      'movements.create',
      'maintenance.read',
      'maintenance.manage',
      'inspections.read',
      'alerts.read',
      'reports.read',
    ],
  },
  {
    code: 'SEGURIDAD',
    name: 'Responsable de seguridad',
    description: 'Condición técnica, inspecciones, bajas y reportes',
    permissions: [
      'dashboard.read',
      'locations.read',
      'catalogs.read',
      'extinguishers.read',
      'extinguishers.update',
      'extinguishers.condition',
      'extinguishers.retire',
      'movements.read',
      'movements.create',
      'maintenance.read',
      'maintenance.manage',
      'inspections.read',
      'inspections.create',
      'alerts.read',
      'reports.read',
      'reports.export',
    ],
  },
  {
    code: 'CONSULTA',
    name: 'Consulta / auditor',
    description: 'Solo lectura de fichas, movimientos, reportes y auditoría',
    permissions: [
      'dashboard.read',
      'locations.read',
      'catalogs.read',
      'extinguishers.read',
      'movements.read',
      'maintenance.read',
      'inspections.read',
      'alerts.read',
      'reports.read',
      'audit.read',
    ],
  },
];

const SITE_SEEDS = [
  {
    code: 'UBI-000001',
    name: 'Sede Central de Desarrollo',
    type: 'SEDE' as const,
    address: 'Dirección ficticia 100',
  },
  {
    code: 'UBI-000002',
    name: 'Almacén Central de Desarrollo',
    type: 'ALMACEN' as const,
    address: null,
  },
  {
    code: 'UBI-000003',
    name: 'Área de Desarrollo',
    type: 'AREA' as const,
    address: null,
  },
  {
    code: 'UBI-000004',
    name: 'Taller de Desarrollo',
    type: 'TALLER' as const,
    address: null,
  },
];

async function seedAdminUser(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  let generatedPassword: string | null = null;
  if (existing === null) {
    const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
    generatedPassword = fromEnv && fromEnv.length > 0 ? null : randomPassword();
    const password = fromEnv && fromEnv.length > 0 ? fromEnv : generatedPassword!;

    await prisma.user.create({
      data: {
        id: ADMIN_USER_ID,
        email: ADMIN_EMAIL,
        passwordHash: hashSync(password, BCRYPT_COST),
        fullName: 'Administrador de desarrollo',
        active: true,
        mustChangePassword: true,
      },
    });

    if (generatedPassword !== null) {
      console.log(
        `[seed] Contraseña temporal generada para ${ADMIN_EMAIL}: ${generatedPassword}`,
      );
      console.log(
        '[seed] Cámbiala en el primer inicio de sesión; no se vuelve a mostrar.',
      );
    }
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { fullName: existing.fullName },
    });
  }
}

function randomPassword(): string {
  return randomBytes(18).toString('base64url');
}

async function seedRbac(): Promise<Record<string, string>> {
  const permissionIds = new Map<string, string>();

  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: {
        id: randomUUID(),
        code: permission.code,
        description: permission.description,
      },
    });
    permissionIds.set(row.code, row.id);
  }

  const roleIds: Record<string, string> = {};

  for (const role of ROLE_SEEDS) {
    const row = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        id: randomUUID(),
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
    roleIds[row.code] = row.id;

    const codes =
      role.permissions === 'ALL'
        ? PERMISSIONS.map((permission) => permission.code)
        : role.permissions;

    for (const code of codes) {
      const permissionId = permissionIds.get(code);
      if (permissionId === undefined) {
        throw new Error(`Permiso desconocido en la semilla: ${code}`);
      }
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: row.id, permissionId },
        },
        update: {},
        create: { roleId: row.id, permissionId },
      });
    }
  }

  return roleIds;
}

async function seedLocations(): Promise<Record<string, string>> {
  const locationIds: Record<string, string> = {};

  const sede = await prisma.location.upsert({
    where: { code: SITE_SEEDS[0].code },
    update: { name: SITE_SEEDS[0].name, address: SITE_SEEDS[0].address },
    create: {
      id: randomUUID(),
      code: SITE_SEEDS[0].code,
      name: SITE_SEEDS[0].name,
      type: SITE_SEEDS[0].type,
      address: SITE_SEEDS[0].address,
      createdById: ADMIN_USER_ID,
    },
  });
  locationIds[sede.code] = sede.id;

  for (const site of SITE_SEEDS.slice(1)) {
    const row = await prisma.location.upsert({
      where: { code: site.code },
      update: { name: site.name, parentId: sede.id },
      create: {
        id: randomUUID(),
        code: site.code,
        name: site.name,
        type: site.type,
        address: site.address,
        parentId: sede.id,
        createdById: ADMIN_USER_ID,
      },
    });
    locationIds[row.code] = row.id;
  }

  return locationIds;
}

async function seedCatalogs(): Promise<{
  typePqsId: string;
  typeCo2Id: string;
  providerId: string;
}> {
  const typePqs = await prisma.extinguisherType.upsert({
    where: { code: 'TIPO-PQS-6' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'TIPO-PQS-6',
      name: 'PQS 6 kg',
      agent: 'PQS',
      nominalCapacity: '6.00',
      capacityUnit: 'KG',
      usefulLifeYears: null,
      description: 'Tipo ficticio de desarrollo',
    },
  });

  const typeCo2 = await prisma.extinguisherType.upsert({
    where: { code: 'TIPO-CO2-5' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'TIPO-CO2-5',
      name: 'CO2 5 lb',
      agent: 'CO2',
      nominalCapacity: '5.00',
      capacityUnit: 'LB',
      usefulLifeYears: null,
      description: 'Tipo ficticio de desarrollo',
    },
  });

  const provider = await prisma.externalParty.upsert({
    where: { code: 'PRV-001' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'PRV-001',
      name: 'Proveedor de desarrollo S.A.C.',
      partyType: 'PROVEEDOR_MANTENIMIENTO',
      contactName: 'Contacto ficticio',
      phone: '000-000000',
      email: 'proveedor@example.test',
      notes: 'Dato ficticio de desarrollo',
    },
  });

  return {
    typePqsId: typePqs.id,
    typeCo2Id: typeCo2.id,
    providerId: provider.id,
  };
}

async function seedExtinguishers(
  locationIds: Record<string, string>,
  catalogs: { typePqsId: string; typeCo2Id: string },
): Promise<void> {
  const warehouseId = locationIds['UBI-000002'];
  const areaId = locationIds['UBI-000003'];

  const seeds = [
    {
      assetCode: 'EXT-000001',
      typeId: catalogs.typePqsId,
      capacityValue: '6.00',
      capacityUnit: 'KG' as const,
      logisticsStatus: 'EN_ALMACEN' as const,
      technicalCondition: 'OPERATIVO' as const,
      locationId: warehouseId,
      entrySource: 'COMPRA_CENTRAL' as const,
    },
    {
      assetCode: 'EXT-000002',
      typeId: catalogs.typeCo2Id,
      capacityValue: '5.00',
      capacityUnit: 'LB' as const,
      logisticsStatus: 'ASIGNADO' as const,
      technicalCondition: 'OPERATIVO' as const,
      locationId: areaId,
      entrySource: 'CARGA_INICIAL' as const,
    },
    {
      assetCode: 'EXT-000003',
      typeId: catalogs.typePqsId,
      capacityValue: '6.00',
      capacityUnit: 'KG' as const,
      logisticsStatus: 'EN_ALMACEN' as const,
      technicalCondition: 'OBSERVADO' as const,
      locationId: warehouseId,
      entrySource: 'COMPRA_LOCAL' as const,
    },
  ];

  const movedAt = new Date('2026-01-15T15:00:00.000Z');

  for (const seed of seeds) {
    const locationName =
      seed.locationId === areaId
        ? 'Área de Desarrollo'
        : 'Almacén Central de Desarrollo';

    const extinguisher = await prisma.extinguisher.upsert({
      where: { assetCode: seed.assetCode },
      update: {},
      create: {
        id: randomUUID(),
        assetCode: seed.assetCode,
        typeId: seed.typeId,
        brand: 'Marca ficticia',
        model: 'Modelo ficticio',
        capacityValue: seed.capacityValue,
        capacityUnit: seed.capacityUnit,
        logisticsStatus: seed.logisticsStatus,
        technicalCondition: seed.technicalCondition,
        placementType: 'INTERNAL',
        currentLocationId: seed.locationId,
        currentSince: movedAt,
        createdById: ADMIN_USER_ID,
      },
    });

    await prisma.movement.upsert({
      where: {
        extinguisherId_assetSequence: {
          extinguisherId: extinguisher.id,
          assetSequence: 1,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        extinguisherId: extinguisher.id,
        assetSequence: 1,
        movementType: 'INGRESO',
        entrySource: seed.entrySource,
        originKind: 'NONE',
        originLabel: 'Sin ubicación previa',
        destinationKind: 'LOCATION',
        destinationLocationId: seed.locationId,
        destinationLabel: locationName,
        movedAt,
        reason: 'Carga de datos de desarrollo',
        createdById: ADMIN_USER_ID,
      },
    });
  }
}

async function seedAlertSettings(): Promise<void> {
  const eventTypes = [
    'EQUIPO',
    'INSPECCION',
    'MANTENIMIENTO',
    'RECARGA',
    'PRUEBA_HIDROSTATICA',
  ] as const;

  for (const eventType of eventTypes) {
    await prisma.alertSetting.upsert({
      where: { eventType },
      update: {},
      create: {
        id: randomUUID(),
        eventType,
        daysBefore: null,
        enabled: true,
        updatedById: ADMIN_USER_ID,
      },
    });
  }
}

async function seedCounters(): Promise<void> {
  await prisma.codeCounter.upsert({
    where: { scope: 'EXTINGUISHER' },
    update: {},
    create: {
      id: randomUUID(),
      scope: 'EXTINGUISHER',
      prefix: 'EXT-',
      nextValue: 4,
      padding: 6,
    },
  });

  await prisma.codeCounter.upsert({
    where: { scope: 'LOCATION' },
    update: {},
    create: {
      id: randomUUID(),
      scope: 'LOCATION',
      prefix: 'UBI-',
      nextValue: 5,
      padding: 6,
    },
  });
}

async function seedAdminRole(adminRoleId: string): Promise<void> {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: ADMIN_USER_ID, roleId: adminRoleId },
    },
    update: {},
    create: {
      userId: ADMIN_USER_ID,
      roleId: adminRoleId,
      assignedById: ADMIN_USER_ID,
    },
  });
}

async function main(): Promise<void> {
  await seedAdminUser();
  const roleIds = await seedRbac();
  await seedAdminRole(roleIds.ADMIN);
  const locationIds = await seedLocations();
  const catalogs = await seedCatalogs();
  await seedExtinguishers(locationIds, catalogs);
  await seedAlertSettings();
  await seedCounters();

  console.log('[seed] Roles: %s', Object.keys(roleIds).join(', '));
  console.log('[seed] Ubicaciones: %s', Object.keys(locationIds).join(', '));
  console.log('[seed] Datos de desarrollo cargados.');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] Error:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
