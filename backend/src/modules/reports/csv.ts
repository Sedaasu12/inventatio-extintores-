/**
 * Construcción de CSV para los reportes (D-19).
 *
 * - UTF-8 con BOM para que Excel reconozca los acentos.
 * - Separador coma y fin de línea CRLF.
 * - Comillas cuando el valor contiene coma, comilla o salto de línea.
 * - Protección contra inyección de fórmulas: un valor que empieza con
 *   `=`, `+`, `-`, `@`, tabulador o retorno de carro se prefija con `'`.
 */

const RISKY_START = /^[=+\-@\t\r]/;

export type CsvCell = string | number | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (RISKY_START.test(text)) {
    text = `'${text}`;
  }
  if (
    text.includes('"') ||
    text.includes(',') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text.startsWith(' ') ||
    text.endsWith(' ')
  ) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [
    header.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
