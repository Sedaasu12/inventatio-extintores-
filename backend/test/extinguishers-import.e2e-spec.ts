import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from './e2e-app';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

interface ImportRowReport {
  row: number;
  status: string;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  assetCode?: string | null;
  extinguisherId?: string | null;
}

interface DryRunBody {
  dryRunToken: string;
  expiresAt: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
    duplicateSerialsInFile: Array<{
      serialNumber: string;
      rows: number[];
    }>;
    serialsAlreadyRegistered: Array<{
      serialNumber: string;
      rows: number[];
      assetCodes: string[];
    }>;
  };
  rows: ImportRowReport[];
}

interface ConfirmBody {
  dryRunId: string;
  summary: {
    totalRows: number;
    importedRows: number;
    replayedRows: number;
    skippedRows: number;
    failedRows: number;
    warningRows: number;
  };
  rows: ImportRowReport[];
}

const COLUMNS = [
  'serialNumber',
  'typeCode',
  'brand',
  'model',
  'capacityValue',
  'capacityUnit',
  'manufactureDate',
  'acquiredAt',
  'commissionedAt',
  'manufacturerExpiryDate',
  'sedeCode',
  'locationCode',
  'technicalCondition',
  'notes',
] as const;

const HEADER = COLUMNS.join(',');

function csvRow(overrides: Partial<Record<string, string>> = {}): string {
  const values: Record<string, string> = {
    serialNumber: 'SN-1',
    typeCode: 'PQS-6KG',
    brand: 'ACME',
    model: 'PQS-6',
    capacityValue: '6',
    capacityUnit: 'KG',
    manufactureDate: '2020-01-01',
    acquiredAt: '2020-02-01',
    commissionedAt: '2020-02-10',
    manufacturerExpiryDate: '2035-01-01',
    sedeCode: 'UBI-SEDE',
    locationCode: 'UBI-ALM',
    technicalCondition: 'OPERATIVO',
    notes: 'Equipo de carga inicial',
    ...overrides,
  };
  return COLUMNS.map((column) => values[column]).join(',');
}

function csv(rows: string[]): string {
  return `${HEADER}\n${rows.join('\n')}\n`;
}

describe('Carga inicial de extintores (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
  let almacenToken: string;
  let consultaToken: string;
  let typeId: string;
  let sedeId: string;
  let warehouseId: string;
  let areaId: string;

  const authenticate = async (email: string): Promise<string> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  };

  const dryRunRequest = (
    token: string,
    content: string,
    options: {
      format?: 'CSV' | 'JSON';
      fileName?: string;
      fields?: Record<string, string>;
    } = {},
  ): request.Test => {
    const format = options.format ?? 'CSV';
    return request(server)
      .post('/api/v1/extinguishers/imports/dry-run')
      .set('Authorization', `Bearer ${token}`)
      .field('format', format)
      .field('receivedBy', options.fields?.receivedBy ?? 'Carlos Ruiz')
      .field('documentRef', options.fields?.documentRef ?? 'ACTA-CARGA-001')
      .field('reason', options.fields?.reason ?? 'Carga inicial conciliada')
      .attach(
        'file',
        Buffer.from(content, 'utf8'),
        options.fileName ??
          (format === 'CSV' ? 'inventario.csv' : 'inventario.json'),
      );
  };

  const confirmRequest = (
    token: string,
    content: string,
    dryRunToken: string,
    options: {
      format?: 'CSV' | 'JSON';
      fileName?: string;
      fields?: Record<string, string>;
    } = {},
  ): request.Test => {
    const format = options.format ?? 'CSV';
    return request(server)
      .post('/api/v1/extinguishers/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('format', format)
      .field('receivedBy', options.fields?.receivedBy ?? 'Carlos Ruiz')
      .field('documentRef', options.fields?.documentRef ?? 'ACTA-CARGA-001')
      .field('reason', options.fields?.reason ?? 'Carga inicial conciliada')
      .field('dryRunToken', dryRunToken)
      .attach(
        'file',
        Buffer.from(content, 'utf8'),
        options.fileName ??
          (format === 'CSV' ? 'inventario.csv' : 'inventario.json'),
      );
  };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    adminToken = await authenticate(fixtures.admin.email);
    almacenToken = await authenticate(fixtures.almacen.email);
    consultaToken = await authenticate(fixtures.consulta.email);

    typeId = randomUUID();
    await prisma.extinguisherType.create({
      data: {
        id: typeId,
        code: 'PQS-6KG',
        name: 'PQS 6 kg',
        agent: 'PQS',
        nominalCapacity: '6.00',
        capacityUnit: 'KG',
        usefulLifeYears: 10,
      },
    });

    sedeId = randomUUID();
    await prisma.location.create({
      data: {
        id: sedeId,
        code: 'UBI-SEDE',
        name: 'Sede Central',
        type: 'SEDE',
        createdById: fixtures.admin.id,
      },
    });
    warehouseId = randomUUID();
    await prisma.location.create({
      data: {
        id: warehouseId,
        code: 'UBI-ALM',
        name: 'Almacén Central',
        type: 'ALMACEN',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });
    areaId = randomUUID();
    await prisma.location.create({
      data: {
        id: areaId,
        code: 'UBI-AREA',
        name: 'Área de producción',
        type: 'AREA',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-IMP-01: el dry-run reporta filas y no escribe extintores', async () => {
    const response = await dryRunRequest(adminToken, csv([csvRow()])).expect(
      200,
    );
    const body = response.body as DryRunBody;

    expect(body.dryRunToken).toEqual(expect.any(String));
    expect(body.expiresAt).toEqual(expect.any(String));
    expect(body.summary).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      warningRows: 0,
    });
    expect(body.rows[0]).toMatchObject({
      row: 1,
      status: 'VALID',
      errors: [],
    });
    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('T-IMP-02: confirma la carga con INGRESO CARGA_INICIAL y evidencia', async () => {
    const content = csv([csvRow()]);
    const dry = await dryRunRequest(adminToken, content).expect(200);
    const confirm = await confirmRequest(
      adminToken,
      content,
      (dry.body as DryRunBody).dryRunToken,
    ).expect(200);
    const body = confirm.body as ConfirmBody;

    expect(body.summary).toMatchObject({
      totalRows: 1,
      importedRows: 1,
      replayedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    });
    expect(body.rows[0].status).toBe('IMPORTED');
    expect(body.rows[0].assetCode).toMatch(/^EXT-\d{6}$/);

    const extinguisher = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: body.rows[0].extinguisherId as string },
    });
    expect(extinguisher.serialNumber).toBe('SN-1');
    expect(extinguisher.currentLocationId).toBe(warehouseId);
    expect(extinguisher.logisticsStatus).toBe('EN_ALMACEN');

    const movement = await prisma.movement.findFirstOrThrow({
      where: { extinguisherId: extinguisher.id },
    });
    expect(movement).toMatchObject({
      assetSequence: 1,
      movementType: 'INGRESO',
      entrySource: 'CARGA_INICIAL',
      receivedBy: 'Carlos Ruiz',
      documentRef: 'ACTA-CARGA-001',
      destinationLocationId: warehouseId,
    });
  });

  it('T-IMP-03: exige el comprobante de dry-run', async () => {
    const response = await request(server)
      .post('/api/v1/extinguishers/imports')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('format', 'CSV')
      .field('receivedBy', 'Carlos Ruiz')
      .field('documentRef', 'ACTA-CARGA-001')
      .field('reason', 'Carga inicial conciliada')
      .attach('file', Buffer.from(csv([csvRow()]), 'utf8'), 'inventario.csv')
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('T-IMP-04: rechaza confirmar un archivo distinto al del dry-run', async () => {
    const dry = await dryRunRequest(adminToken, csv([csvRow()])).expect(200);
    const other = csv([csvRow({ serialNumber: 'SN-OTRO' })]);

    const response = await confirmRequest(
      adminToken,
      other,
      (dry.body as DryRunBody).dryRunToken,
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'IMPORT_DRY_RUN_INVALID',
    );
    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('T-IMP-05: importa filas válidas y omite inválidas sin efectos parciales', async () => {
    const content = csv([
      csvRow({ serialNumber: 'SN-OK' }),
      csvRow({ serialNumber: 'SN-TIPO', typeCode: 'NO-EXISTE' }),
      csvRow({
        serialNumber: 'SN-AREA',
        locationCode: 'UBI-AREA',
        technicalCondition: 'NO_OPERATIVO',
      }),
    ]);

    const dry = await dryRunRequest(adminToken, content).expect(200);
    const dryBody = dry.body as DryRunBody;
    expect(dryBody.summary).toMatchObject({
      totalRows: 3,
      validRows: 1,
      invalidRows: 2,
    });
    expect(dryBody.rows.map((row) => row.status)).toEqual([
      'VALID',
      'INVALID',
      'INVALID',
    ]);

    const confirm = await confirmRequest(
      adminToken,
      content,
      dryBody.dryRunToken,
    ).expect(200);
    const body = confirm.body as ConfirmBody;

    expect(body.summary).toMatchObject({
      importedRows: 1,
      skippedRows: 2,
      failedRows: 0,
    });
    expect(body.rows.map((row) => row.status)).toEqual([
      'IMPORTED',
      'SKIPPED',
      'SKIPPED',
    ]);

    expect(await prisma.extinguisher.count()).toBe(1);
    expect(
      await prisma.extinguisher.count({
        where: { serialNumber: { in: ['SN-TIPO', 'SN-AREA'] } },
      }),
    ).toBe(0);
  });

  it('T-IMP-06: advierte seriales duplicados sin bloquear la carga', async () => {
    await prisma.extinguisher.create({
      data: {
        id: randomUUID(),
        assetCode: 'EXT-999999',
        serialNumber: 'SN-EXISTE',
        typeId,
        capacityValue: '6.00',
        capacityUnit: 'KG',
        logisticsStatus: 'EN_ALMACEN',
        technicalCondition: 'OPERATIVO',
        placementType: 'INTERNAL',
        currentLocationId: warehouseId,
        createdById: fixtures.admin.id,
      },
    });

    const content = csv([
      csvRow({ serialNumber: 'SN-DUP' }),
      csvRow({ serialNumber: 'SN-DUP' }),
      csvRow({ serialNumber: 'SN-EXISTE' }),
    ]);

    const dry = await dryRunRequest(adminToken, content).expect(200);
    const dryBody = dry.body as DryRunBody;
    expect(dryBody.summary.duplicateSerialsInFile).toEqual([
      { serialNumber: 'SN-DUP', rows: [1, 2], assetCodes: [] },
    ]);
    expect(dryBody.summary.serialsAlreadyRegistered).toEqual([
      { serialNumber: 'SN-EXISTE', rows: [3], assetCodes: ['EXT-999999'] },
    ]);

    const confirm = await confirmRequest(
      adminToken,
      content,
      dryBody.dryRunToken,
    ).expect(200);
    const body = confirm.body as ConfirmBody;

    expect(body.summary.importedRows).toBe(3);
    expect(body.rows[0].warnings.map((warning) => warning.code)).toContain(
      'SERIAL_DUPLICATE_IN_FILE',
    );
    expect(body.rows[2].warnings.map((warning) => warning.code)).toContain(
      'SERIAL_ALREADY_REGISTERED',
    );
    expect(
      await prisma.extinguisher.count({
        where: { serialNumber: 'SN-DUP' },
      }),
    ).toBe(2);
  });

  it('T-IMP-07: acepta JSON y asigna código generado', async () => {
    const content = JSON.stringify([
      {
        serialNumber: 'SN-JSON',
        typeCode: 'PQS-6KG',
        capacityValue: 6,
        capacityUnit: 'KG',
        sedeCode: 'UBI-SEDE',
        locationCode: 'UBI-AREA',
        technicalCondition: 'OPERATIVO',
        notes: 'Carga JSON',
      },
    ]);

    const dry = await dryRunRequest(adminToken, content, {
      format: 'JSON',
    }).expect(200);
    const confirm = await confirmRequest(
      adminToken,
      content,
      (dry.body as DryRunBody).dryRunToken,
      { format: 'JSON' },
    ).expect(200);
    const body = confirm.body as ConfirmBody;

    expect(body.summary.importedRows).toBe(1);
    const stored = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: body.rows[0].extinguisherId as string },
    });
    expect(stored.assetCode).toMatch(/^EXT-\d{6}$/);
    expect(stored.logisticsStatus).toBe('ASIGNADO');
  });

  it('T-IMP-08: solo roles con extinguishers.create pueden importar', async () => {
    await dryRunRequest(almacenToken, csv([csvRow()])).expect(200);

    const response = await dryRunRequest(consultaToken, csv([csvRow()])).expect(
      403,
    );
    expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('T-IMP-09: repetir la confirmación no duplica activos', async () => {
    const content = csv([csvRow()]);
    const dry = await dryRunRequest(adminToken, content).expect(200);
    const token = (dry.body as DryRunBody).dryRunToken;

    await confirmRequest(adminToken, content, token).expect(200);
    expect(await prisma.extinguisher.count()).toBe(1);

    const replay = await confirmRequest(adminToken, content, token).expect(200);
    const body = replay.body as ConfirmBody;

    expect(body.summary).toMatchObject({
      importedRows: 0,
      replayedRows: 1,
      failedRows: 0,
    });
    expect(body.rows[0].status).toBe('REPLAYED');
    expect(await prisma.extinguisher.count()).toBe(1);
  });

  it('T-IMP-10: exige el archivo adjunto', async () => {
    const response = await request(server)
      .post('/api/v1/extinguishers/imports/dry-run')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('format', 'CSV')
      .field('receivedBy', 'Carlos Ruiz')
      .field('documentRef', 'ACTA-CARGA-001')
      .field('reason', 'Carga inicial conciliada')
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('IMPORT_FILE_INVALID');
  });
});
