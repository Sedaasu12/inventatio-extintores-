import type { RawImportRow } from './import-file';
import {
  applySerialWarnings,
  buildImportCatalogs,
  buildImportSummary,
  validateImportRows,
} from './import-validation';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const TZ = 'America/Lima';

const catalogs = buildImportCatalogs(
  [
    { id: 'type-1', code: 'TIPO-1', active: true, usefulLifeYears: 10 },
    { id: 'type-off', code: 'TIPO-OFF', active: false, usefulLifeYears: 10 },
  ],
  [
    {
      id: 'sede-1',
      code: 'UBI-SEDE',
      name: 'Sede Central',
      type: 'SEDE',
      active: true,
      parentId: null,
    },
    {
      id: 'alm-1',
      code: 'UBI-ALM',
      name: 'Almacén Central',
      type: 'ALMACEN',
      active: true,
      parentId: 'sede-1',
    },
    {
      id: 'area-1',
      code: 'UBI-AREA',
      name: 'Área de producción',
      type: 'AREA',
      active: true,
      parentId: 'sede-1',
    },
    {
      id: 'area-off',
      code: 'UBI-AREA-OFF',
      name: 'Área inactiva',
      type: 'AREA',
      active: false,
      parentId: 'sede-1',
    },
    {
      id: 'taller-1',
      code: 'UBI-TALLER',
      name: 'Taller propio',
      type: 'TALLER',
      active: true,
      parentId: 'sede-1',
    },
    {
      id: 'sede-2',
      code: 'UBI-SEDE-2',
      name: 'Sede Norte',
      type: 'SEDE',
      active: true,
      parentId: null,
    },
    {
      id: 'alm-2',
      code: 'UBI-ALM-2',
      name: 'Almacén Norte',
      type: 'ALMACEN',
      active: true,
      parentId: 'sede-2',
    },
  ],
);

function row(
  values: Record<string, unknown> = {},
  rowNumber = 1,
): RawImportRow {
  return {
    row: rowNumber,
    line: rowNumber + 1,
    values: {
      serialNumber: 'SN-1',
      typeCode: 'TIPO-1',
      brand: 'ACME',
      model: 'PQS-6',
      capacityValue: '6',
      capacityUnit: 'KG',
      manufactureDate: '2020-01-01',
      acquiredAt: '2020-02-01',
      commissionedAt: '2020-02-10',
      manufacturerExpiryDate: '2030-01-01',
      sedeCode: 'UBI-SEDE',
      locationCode: 'UBI-ALM',
      technicalCondition: 'OPERATIVO',
      notes: 'Equipo de pruebas',
      ...values,
    },
    structureErrors: [],
  };
}

function validate(rows: RawImportRow[]) {
  return validateImportRows(rows, catalogs, TZ, NOW);
}

describe('validateImportRows', () => {
  it('valida una fila completa y resuelve tipo y ubicación', () => {
    const [validated] = validate([row()]);
    expect(validated.status).toBe('VALID');
    expect(validated.errors).toEqual([]);
    expect(validated.warnings).toEqual([]);
    expect(validated.resolved).toEqual({
      typeId: 'type-1',
      sedeId: 'sede-1',
      sedeName: 'Sede Central',
      locationId: 'alm-1',
      locationName: 'Almacén Central',
      locationType: 'ALMACEN',
    });
    expect(validated.data.capacityValue).toBe(6);
    expect(validated.data.capacityUnit).toBe('KG');
  });

  it('acepta códigos y enums sin distinguir mayúsculas', () => {
    const [validated] = validate([
      row({
        typeCode: 'tipo-1',
        sedeCode: 'ubi-sede',
        locationCode: 'ubi-alm',
        capacityUnit: 'kg',
        technicalCondition: 'operativo',
      }),
    ]);
    expect(validated.status).toBe('VALID');
    expect(validated.data.capacityUnit).toBe('KG');
    expect(validated.data.technicalCondition).toBe('OPERATIVO');
  });

  it('advierte cuando falta el número de serie', () => {
    const [validated] = validate([row({ serialNumber: '' })]);
    expect(validated.status).toBe('VALID');
    expect(validated.warnings.map((warning) => warning.code)).toContain(
      'SERIAL_MISSING',
    );
  });

  it('rechaza tipo inexistente o inactivo', () => {
    expect(
      validate([row({ typeCode: 'NO-EXISTE' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('TYPE_NOT_FOUND');
    expect(
      validate([row({ typeCode: 'TIPO-OFF' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('TYPE_INACTIVE');
  });

  it('rechaza sede inexistente, tipo incorrecto o inactiva', () => {
    expect(
      validate([row({ sedeCode: 'NO-EXISTE' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('SEDE_NOT_FOUND');
    expect(
      validate([row({ sedeCode: 'UBI-ALM' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('SEDE_INVALID_TYPE');
  });

  it('rechaza ubicación de taller, inactiva o de otra sede', () => {
    expect(
      validate([row({ locationCode: 'UBI-TALLER' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('LOCATION_INVALID_TYPE');
    expect(
      validate([row({ locationCode: 'UBI-AREA-OFF' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('LOCATION_INACTIVE');
    expect(
      validate([row({ locationCode: 'UBI-ALM-2' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('LOCATION_NOT_IN_SEDE');
  });

  it('rechaza NO_OPERATIVO en área', () => {
    const [validated] = validate([
      row({
        locationCode: 'UBI-AREA',
        technicalCondition: 'NO_OPERATIVO',
      }),
    ]);
    expect(validated.status).toBe('INVALID');
    expect(validated.errors.map((error) => error.code)).toContain(
      'CONDITION_NOT_ASSIGNABLE',
    );
  });

  it('aplica reglas de fechas del alta', () => {
    expect(
      validate([row({ manufactureDate: '2027-01-01' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('DATE_IN_FUTURE');
    expect(
      validate([row({ acquiredAt: '2019-01-01' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('DATE_BEFORE_EVENT');
    expect(
      validate([row({ manufactureDate: '2020-02-30' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('DATE_INVALID');
  });

  it('rechaza capacidad, unidad y condición inválidas', () => {
    expect(
      validate([row({ capacityValue: '0' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('CAPACITY_INVALID');
    expect(
      validate([row({ capacityUnit: 'GAL' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('INVALID_VALUE');
    expect(
      validate([row({ technicalCondition: 'ROTO' })])[0].errors.map(
        (error) => error.code,
      ),
    ).toContain('INVALID_VALUE');
  });

  it('reporta columnas desconocidas en JSON', () => {
    const [validated] = validate([row({ desconocida: 'x' })]);
    expect(validated.errors.map((error) => error.code)).toContain(
      'UNKNOWN_FIELD',
    );
  });
});

describe('seriales duplicados', () => {
  it('advierte duplicados en el archivo y seriales ya registrados', () => {
    const rows = validate([
      row({ serialNumber: 'SN-1' }, 1),
      row({ serialNumber: 'sn-1' }, 2),
      row({ serialNumber: 'SN-2' }, 3),
    ]);
    const warnings = applySerialWarnings(
      rows,
      new Map([['SN-2', ['EXT-000010']]]),
    );

    expect(warnings.duplicateInFile).toEqual([
      { serialNumber: 'SN-1', rows: [1, 2], assetCodes: [] },
    ]);
    expect(warnings.alreadyRegistered).toEqual([
      {
        serialNumber: 'SN-2',
        rows: [3],
        assetCodes: ['EXT-000010'],
      },
    ]);
    expect(rows[0].warnings.map((warning) => warning.code)).toContain(
      'SERIAL_DUPLICATE_IN_FILE',
    );
    expect(rows[2].warnings.map((warning) => warning.code)).toContain(
      'SERIAL_ALREADY_REGISTERED',
    );
  });
});

describe('buildImportSummary', () => {
  it('agrupa por sede y ubicación con conteos de válidos e inválidos', () => {
    const rows = validate([
      row({ serialNumber: 'SN-1' }, 1),
      row({ serialNumber: 'SN-2' }, 2),
      row(
        {
          serialNumber: 'SN-3',
          typeCode: 'NO-EXISTE',
        },
        3,
      ),
    ]);
    const summary = buildImportSummary(rows, {
      duplicateInFile: [],
      alreadyRegistered: [],
    });

    expect(summary).toMatchObject({
      totalRows: 3,
      validRows: 2,
      invalidRows: 1,
      warningRows: 0,
    });
    expect(summary.bySede).toEqual([
      {
        sedeCode: 'UBI-SEDE',
        sedeName: 'Sede Central',
        totalRows: 3,
        validRows: 2,
        invalidRows: 1,
      },
    ]);
    expect(summary.byLocation).toEqual([
      {
        sedeCode: 'UBI-SEDE',
        sedeName: 'Sede Central',
        locationCode: 'UBI-ALM',
        locationName: 'Almacén Central',
        locationType: 'ALMACEN',
        totalRows: 3,
        validRows: 2,
        invalidRows: 1,
      },
    ]);
  });
});
