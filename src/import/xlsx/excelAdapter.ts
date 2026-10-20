// Único punto de contacto con ExcelJS (aprobado en D-040; confinado por D-038).
import { ValueType, Workbook as ExcelWorkbook, type Cell as ExcelCell } from 'exceljs';
import {
  DEFAULT_READ_LIMITS,
  type Cell,
  type CellValue,
  type ReadError,
  type ReadLimits,
  type Result,
  type Row,
  type Sheet,
  type Workbook,
  type WorkbookDefinition,
} from './types';
import { inspectZip } from './zipGuard';

/** Texto decimal mínimo que reproduce exactamente el mismo double (Number::toString). */
function numberText(value: number): CellValue {
  return Number.isFinite(value) ? { kind: 'number', text: String(value) } : { kind: 'unsupported' };
}

function richText(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText: readonly { text: string }[] }).richText;
    return parts.map((part) => part.text).join('');
  }
  return undefined;
}

function toCellValue(cell: ExcelCell): CellValue {
  const value: unknown = cell.value;
  switch (cell.type) {
    case ValueType.Merge:
      return { kind: 'merged' };
    case ValueType.Number:
      return typeof value === 'number' ? numberText(value) : { kind: 'unsupported' };
    case ValueType.String:
    case ValueType.SharedString:
      return typeof value === 'string' ? { kind: 'text', text: value } : { kind: 'unsupported' };
    case ValueType.RichText: {
      const text = richText(value);
      return text === undefined ? { kind: 'unsupported' } : { kind: 'text', text };
    }
    case ValueType.Hyperlink: {
      const text =
        typeof value === 'object' && value !== null && 'text' in value ? value.text : undefined;
      if (typeof text === 'string') {
        return { kind: 'text', text };
      }
      const nested = richText(text);
      return nested === undefined ? { kind: 'unsupported' } : { kind: 'text', text: nested };
    }
    case ValueType.Boolean:
      return typeof value === 'boolean' ? { kind: 'boolean', value } : { kind: 'unsupported' };
    case ValueType.Date:
      return { kind: 'date' };
    case ValueType.Formula:
      return { kind: 'formula' };
    case ValueType.Error: {
      const code =
        typeof value === 'object' && value !== null && 'error' in value
          ? String(value.error)
          : 'desconocido';
      return { kind: 'error', code };
    }
    default:
      return { kind: 'unsupported' };
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * Lee un XLSX. Valida antes el contenedor (zipGuard) y aplica límites de filas/columnas.
 * No confía en la dimensión declarada por el archivo: recorre las filas reales.
 */
export async function readWorkbook(
  bytes: Uint8Array,
  limits: ReadLimits = DEFAULT_READ_LIMITS,
): Promise<Result<Workbook, ReadError>> {
  const guard = inspectZip(bytes, limits);
  if (!guard.ok) {
    return guard;
  }

  const workbook = new ExcelWorkbook();
  try {
    await workbook.xlsx.load(toArrayBuffer(bytes));
  } catch {
    return { ok: false, error: { kind: 'PARSE_FAILED' } };
  }

  const sheets: Sheet[] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: Row[] = [];
    let error: ReadError | undefined;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (error !== undefined) {
        return;
      }
      if (rows.length >= limits.maxRowsPerSheet) {
        error = { kind: 'TOO_MANY_ROWS', sheet: worksheet.name, limit: limits.maxRowsPerSheet };
        return;
      }
      const cells: Cell[] = [];
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (column > limits.maxColumns) {
          error ??= { kind: 'TOO_MANY_COLUMNS', sheet: worksheet.name, limit: limits.maxColumns };
          return;
        }
        cells.push({ column, value: toCellValue(cell) });
      });
      if (cells.length > 0) {
        rows.push({ rowNumber, cells });
      }
    });
    if (error !== undefined) {
      return { ok: false, error };
    }
    sheets.push({ name: worksheet.name, state: worksheet.state, rows });
  }
  return { ok: true, value: { sheets } };
}

const TEXT_FORMAT = '@';

/** Escribe un libro. Todos los valores se escriben como texto: nunca como fórmula. */
export async function writeWorkbook(definition: WorkbookDefinition): Promise<Uint8Array> {
  const workbook = new ExcelWorkbook();
  workbook.creator = 'Conversor de Haberes';
  workbook.lastModifiedBy = 'Conversor de Haberes';

  for (const sheet of definition.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name, {
      state: sheet.state ?? 'visible',
      views: sheet.freezeHeader === true ? [{ state: 'frozen', ySplit: 1 }] : [],
    });
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      width: column.width ?? 18,
      ...(column.format === 'text' ? { style: { numFmt: TEXT_FORMAT } } : {}),
    }));
    worksheet.getRow(1).font = { bold: true };

    sheet.rows.forEach((values, index) => {
      const row = worksheet.getRow(index + 2);
      values.forEach((value, columnIndex) => {
        if (value !== null) {
          // Asignar un string nunca crea una fórmula (protección contra formula injection).
          row.getCell(columnIndex + 1).value = value;
        }
      });
    });

    const preparedRows = Math.max(sheet.preparedRows ?? 0, sheet.rows.length);
    sheet.columns.forEach((column, columnIndex) => {
      for (let rowNumber = 2; rowNumber <= preparedRows + 1; rowNumber += 1) {
        const cell = worksheet.getCell(rowNumber, columnIndex + 1);
        if (column.format === 'text') {
          cell.numFmt = TEXT_FORMAT;
        }
        if (column.allowedValues !== undefined) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${column.allowedValues.join(',')}"`],
            showErrorMessage: true,
            errorTitle: 'Valor no permitido',
            error: `Valores permitidos: ${column.allowedValues.join(', ')}`,
          };
        }
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
