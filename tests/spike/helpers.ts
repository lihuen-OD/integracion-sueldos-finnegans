import type { CellValue, ReadError, Result, Workbook } from '../../src/import/xlsx';

/**
 * Conversión estricta de texto decimal a centavos, solo para verificar el spike.
 * La versión de producción se diseña en F2 (dominio). Rechaza más de 2 decimales
 * y la notación científica.
 */
export function decimalToCents(text: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) {
    return null;
  }
  const [, whole = '0', fraction = ''] = match;
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function unwrap(result: Result<Workbook, ReadError>): Workbook {
  if (!result.ok) {
    throw new Error(`Lectura fallida: ${result.error.kind}`);
  }
  return result.value;
}

/** Valor de una celda por fila y columna (1-based); `undefined` si la celda no existe. */
export function cellAt(
  workbook: Workbook,
  sheetIndex: number,
  rowNumber: number,
  column: number,
): CellValue | undefined {
  return workbook.sheets[sheetIndex]?.rows
    .find((row) => row.rowNumber === rowNumber)
    ?.cells.find((cell) => cell.column === column)?.value;
}

export function textAt(
  workbook: Workbook,
  sheetIndex: number,
  rowNumber: number,
  column: number,
): string | undefined {
  const value = cellAt(workbook, sheetIndex, rowNumber, column);
  return value?.kind === 'text' || value?.kind === 'number' ? value.text : undefined;
}
