// Diagnóstico estructural de un libro: solo conteos y encabezados, nunca valores de datos.
import type { CellKind, Workbook } from './types';

export interface ColumnDiagnostic {
  readonly column: number;
  /** Texto de la fila 1 (encabezado), si es texto. */
  readonly header: string | null;
  /** Cantidad de celdas por tipo, desde la fila 2. */
  readonly kinds: Readonly<Partial<Record<CellKind, number>>>;
}

export interface SheetDiagnostic {
  readonly name: string;
  readonly state: string;
  readonly dataRows: number;
  readonly columns: readonly ColumnDiagnostic[];
}

export interface WorkbookDiagnostic {
  readonly sheets: readonly SheetDiagnostic[];
}

export function diagnoseWorkbook(workbook: Workbook): WorkbookDiagnostic {
  return {
    sheets: workbook.sheets.map((sheet) => {
      const [header, ...data] = sheet.rows;
      const columns = new Map<number, { header: string | null; kinds: Map<CellKind, number> }>();
      const columnFor = (column: number) => {
        let entry = columns.get(column);
        if (entry === undefined) {
          entry = { header: null, kinds: new Map() };
          columns.set(column, entry);
        }
        return entry;
      };
      for (const cell of header?.rowNumber === 1 ? header.cells : []) {
        columnFor(cell.column).header = cell.value.kind === 'text' ? cell.value.text : null;
      }
      const dataRows = header?.rowNumber === 1 ? data : sheet.rows;
      for (const row of dataRows) {
        for (const cell of row.cells) {
          const kinds = columnFor(cell.column).kinds;
          kinds.set(cell.value.kind, (kinds.get(cell.value.kind) ?? 0) + 1);
        }
      }
      return {
        name: sheet.name,
        state: sheet.state,
        dataRows: dataRows.length,
        columns: [...columns.entries()]
          .sort(([a], [b]) => a - b)
          .map(([column, entry]) => ({
            column,
            header: entry.header,
            kinds: Object.fromEntries(entry.kinds),
          })),
      };
    }),
  };
}
