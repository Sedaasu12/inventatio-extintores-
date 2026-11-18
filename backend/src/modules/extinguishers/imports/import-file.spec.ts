import { ApiError } from '../../../common/errors/api-error';
import { ImportFormat, MAX_IMPORT_ROWS, parseImportFile } from './import-file';

function csv(content: string) {
  return parseImportFile({
    format: ImportFormat.CSV,
    buffer: Buffer.from(content, 'utf8'),
  });
}

function json(value: unknown) {
  return parseImportFile({
    format: ImportFormat.JSON,
    buffer: Buffer.from(JSON.stringify(value), 'utf8'),
  });
}

const HEADER =
  'serialNumber,typeCode,brand,model,capacityValue,capacityUnit,manufactureDate,acquiredAt,commissionedAt,manufacturerExpiryDate,sedeCode,locationCode,technicalCondition,notes';

describe('parseImportFile', () => {
  it('parsea CSV con comillas, comillas escapadas y CRLF', () => {
    const parsed = csv(
      `\uFEFF${HEADER}\r\n` +
        `SN-1,PQS-6KG,"ACME, Perú","Modelo ""A""",6,KG,2020-01-01,,,2035-01-01,UBI-1,UBI-2,OPERATIVO,"Nota\r\ncon salto"\r\n`,
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      row: 1,
      line: 2,
      values: {
        serialNumber: 'SN-1',
        typeCode: 'PQS-6KG',
        brand: 'ACME, Perú',
        model: 'Modelo "A"',
        capacityValue: '6',
        capacityUnit: 'KG',
        sedeCode: 'UBI-1',
        locationCode: 'UBI-2',
        technicalCondition: 'OPERATIVO',
        notes: 'Nota\r\ncon salto',
      },
      structureErrors: [],
    });
  });

  it('detecta el delimitador punto y coma', () => {
    const parsed = csv(
      HEADER.replace(/,/g, ';') +
        '\nSN-1;PQS-6KG;ACME;A;6;KG;;;;;UBI-1;UBI-2;OPERATIVO;\n',
    );
    expect(parsed.rows[0].values.typeCode).toBe('PQS-6KG');
    expect(parsed.rows[0].values.notes).toBe('');
  });

  it('ignora líneas en blanco intermedias', () => {
    const parsed = csv(
      `${HEADER}\n\nSN-1,PQS-6KG,ACME,A,6,KG,,,,,UBI-1,UBI-2,OPERATIVO,\n`,
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].line).toBe(3);
  });

  it('acepta JSON como arreglo y como objeto con rows', () => {
    const row = {
      serialNumber: 'SN-1',
      typeCode: 'PQS-6KG',
      capacityValue: 6,
      capacityUnit: 'KG',
      sedeCode: 'UBI-1',
      locationCode: 'UBI-2',
      technicalCondition: 'OPERATIVO',
    };
    expect(json([row]).rows[0].values).toMatchObject(row);
    expect(json({ rows: [row] }).rows[0].values).toMatchObject(row);
  });

  it('reporta filas JSON que no son objetos', () => {
    const parsed = json([{ typeCode: 'PQS-6KG' }, 'texto']);
    expect(parsed.rows[1].structureErrors).toEqual([
      {
        code: 'INVALID_ROW',
        message: expect.stringContaining('objeto') as string,
      },
    ]);
  });

  it('rechaza archivos vacíos', () => {
    expect(() => csv(`${HEADER}\n`)).toThrow(ApiError);
    expect(() => json([])).toThrow(ApiError);
  });

  it('rechaza cabeceras desconocidas, duplicadas o faltantes', () => {
    expect(() => csv(`${HEADER},extra\n`)).toThrow(/cabecera/);
    expect(() => csv(`${HEADER},brand\n`)).toThrow(/cabecera/);
    expect(() => csv(HEADER.replace('typeCode,', ''))).toThrow(/cabecera/);
  });

  it('rechaza comillas sin cerrar', () => {
    expect(() => csv(`${HEADER}\n"SN-1,PQS-6KG`)).toThrow(/comillas/);
  });

  it('rechaza JSON inválido o sin filas', () => {
    expect(() =>
      parseImportFile({
        format: ImportFormat.JSON,
        buffer: Buffer.from('{', 'utf8'),
      }),
    ).toThrow(/JSON/);
    expect(() => json({ rows: 'no' })).toThrow(/arreglo/);
  });

  it('reporta columnas de más en una fila', () => {
    const parsed = csv(
      `${HEADER}\nSN-1,PQS-6KG,ACME,A,6,KG,,,,,UBI-1,UBI-2,OPERATIVO,nota,extra\n`,
    );
    expect(parsed.rows[0].structureErrors[0].code).toBe(
      'COLUMN_COUNT_MISMATCH',
    );
  });

  it(`rechaza más de ${MAX_IMPORT_ROWS} filas`, () => {
    const line = 'SN,PQS-6KG,ACME,A,6,KG,,,,,UBI-1,UBI-2,OPERATIVO,\n';
    const content = `${HEADER}\n${line.repeat(MAX_IMPORT_ROWS + 1)}`;
    expect(() => csv(content)).toThrow(/máximo/);
  });
});
