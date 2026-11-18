import { ApiError } from '../../../common/errors/api-error';
import { ErrorCodes } from '../../../common/errors/error-codes';

/** Límite operativo del archivo y de filas por carga (D-22). */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;

export enum ImportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
}

/**
 * Columnas admitidas. Los nombres son estables y en camelCase para que el
 * mismo formato sirva a CSV y JSON.
 */
export const IMPORT_COLUMNS = [
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

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const ALLOWED_COLUMNS = new Set<string>(IMPORT_COLUMNS);

export const REQUIRED_IMPORT_COLUMNS: readonly ImportColumn[] = [
  'typeCode',
  'capacityValue',
  'capacityUnit',
  'sedeCode',
  'locationCode',
  'technicalCondition',
];

export interface RowStructureError {
  code: string;
  message: string;
}

export interface RawImportRow {
  /** Número de fila de datos, 1-based, sin contar la cabecera. */
  row: number;
  /** Línea física del archivo, útil para CSV. */
  line: number;
  values: Record<string, unknown>;
  structureErrors: RowStructureError[];
}

export interface ParsedImportFile {
  rows: RawImportRow[];
}

function invalidFile(message: string, details?: unknown): ApiError {
  return ApiError.unprocessable(
    ErrorCodes.IMPORT_FILE_INVALID,
    message,
    details,
  );
}

function decodeUtf8(buffer: Buffer): string {
  const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (content.includes('\uFFFD')) {
    throw invalidFile(
      'El archivo debe estar codificado en UTF-8 sin caracteres dañados.',
      { field: 'file' },
    );
  }
  return content;
}

export function parseImportFile(input: {
  format: ImportFormat;
  buffer: Buffer;
}): ParsedImportFile {
  const content = decodeUtf8(input.buffer);
  const rows =
    input.format === ImportFormat.CSV ? parseCsv(content) : parseJson(content);

  if (rows.length === 0) {
    throw invalidFile('El archivo no contiene filas de datos.', {
      field: 'file',
    });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw invalidFile(
      `El archivo supera el máximo de ${MAX_IMPORT_ROWS} filas por carga.`,
      { field: 'file', maxRows: MAX_IMPORT_ROWS, rows: rows.length },
    );
  }

  return { rows };
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

interface CsvRow {
  line: number;
  values: string[];
}

/**
 * Parser CSV mínimo con soporte de comillas, comillas escapadas (`""`),
 * saltos de línea dentro de campos y delimitador `,` o `;`.
 */
function tokenizeCsv(content: string, delimiter: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const finishRow = (): void => {
    row.push(field);
    field = '';
    rows.push({ line: rowStartLine, values: row });
    row = [];
    rowStartLine = line;
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
        if (char === '\n') {
          line += 1;
        }
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\r') {
      if (content[index + 1] === '\n') {
        continue;
      }
      finishRow();
      line += 1;
      rowStartLine = line;
      continue;
    }
    if (char === '\n') {
      finishRow();
      line += 1;
      rowStartLine = line;
      continue;
    }
    field += char;
  }

  if (inQuotes) {
    throw invalidFile('El archivo CSV tiene comillas sin cerrar.', {
      field: 'file',
      line: rowStartLine,
    });
  }
  if (field.length > 0 || row.length > 0) {
    finishRow();
  }

  return rows;
}

function isBlankCsvRow(row: CsvRow): boolean {
  return row.values.every((value) => value.trim() === '');
}

function parseCsv(content: string): RawImportRow[] {
  const delimiter = detectDelimiter(content);
  const csvRows = tokenizeCsv(content, delimiter).filter(
    (row) => !isBlankCsvRow(row),
  );

  const headerRow = csvRows.shift();
  if (headerRow === undefined) {
    return [];
  }

  const headers = headerRow.values.map((value) => value.trim());
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  const unknownHeaders = headers.filter(
    (header) => !ALLOWED_COLUMNS.has(header),
  );
  const missingHeaders = REQUIRED_IMPORT_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (
    headers.some((header) => header === '') ||
    duplicateHeaders.length > 0 ||
    unknownHeaders.length > 0 ||
    missingHeaders.length > 0
  ) {
    throw invalidFile(
      'La cabecera del archivo CSV no es válida. Usa exactamente las columnas documentadas.',
      {
        field: 'file',
        duplicateHeaders,
        unknownHeaders,
        missingHeaders,
      },
    );
  }

  return csvRows.map((csvRow, index) => {
    const values: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      values[header] = csvRow.values[columnIndex]?.trim() ?? '';
    });

    const structureErrors: RowStructureError[] = [];
    if (csvRow.values.length !== headers.length) {
      structureErrors.push({
        code: 'COLUMN_COUNT_MISMATCH',
        message: `La fila tiene ${csvRow.values.length} columnas y la cabecera ${headers.length}.`,
      });
    }

    return {
      row: index + 1,
      line: csvRow.line,
      values,
      structureErrors,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(content: string): RawImportRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw invalidFile('El archivo JSON no es válido.', { field: 'file' });
  }

  let list: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (isRecord(parsed) && Array.isArray(parsed.rows)) {
    list = parsed.rows;
  }

  if (list === null) {
    throw invalidFile(
      'El JSON debe ser un arreglo de filas o un objeto con la propiedad "rows".',
      { field: 'file' },
    );
  }

  return list.map((item, index) => {
    if (!isRecord(item)) {
      return {
        row: index + 1,
        line: index + 1,
        values: {},
        structureErrors: [
          {
            code: 'INVALID_ROW',
            message:
              'Cada fila debe ser un objeto con las columnas documentadas.',
          },
        ],
      };
    }
    return {
      row: index + 1,
      line: index + 1,
      values: item,
      structureErrors: [],
    };
  });
}
