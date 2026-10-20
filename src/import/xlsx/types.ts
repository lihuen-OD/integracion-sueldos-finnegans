// Contrato del adaptador XLSX, independiente de la librería usada (D-038).
// El resto de la app solo conoce estos tipos; ExcelJS queda confinado a este directorio.

/**
 * Valor de una celda tal como está en el archivo, sin interpretar.
 * Los números se entregan como el texto decimal mínimo que reproduce exactamente el
 * mismo double (`String(n)`); la conversión a centavos ocurre en el dominio (F2).
 * Las fórmulas nunca se evalúan ni se expone su resultado en caché.
 */
export type CellValue =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'number'; readonly text: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'date' }
  | { readonly kind: 'formula' }
  | { readonly kind: 'error'; readonly code: string }
  | { readonly kind: 'merged' }
  | { readonly kind: 'unsupported' };

export type CellKind = CellValue['kind'];

export interface Cell {
  /** Columna 1-based. */
  readonly column: number;
  readonly value: CellValue;
}

export interface Row {
  /** Fila 1-based. */
  readonly rowNumber: number;
  readonly cells: readonly Cell[];
}

export type SheetState = 'visible' | 'hidden' | 'veryHidden';

export interface Sheet {
  readonly name: string;
  readonly state: SheetState;
  /** Solo filas con al menos una celda no vacía. */
  readonly rows: readonly Row[];
}

export interface Workbook {
  readonly sheets: readonly Sheet[];
}

export interface ReadLimits {
  /** Tamaño máximo del archivo comprimido. */
  readonly maxFileBytes: number;
  /** Suma máxima de bytes descomprimidos (protección contra zip bombs). */
  readonly maxUncompressedBytes: number;
  readonly maxEntries: number;
  readonly maxRowsPerSheet: number;
  readonly maxColumns: number;
}

export const DEFAULT_READ_LIMITS: ReadLimits = {
  maxFileBytes: 20 * 1024 * 1024,
  maxUncompressedBytes: 100 * 1024 * 1024,
  maxEntries: 500,
  maxRowsPerSheet: 20_000,
  maxColumns: 200,
};

/** Errores de lectura. Nunca incluyen contenido de celdas. */
export type ReadError =
  | { readonly kind: 'FILE_TOO_LARGE'; readonly limitBytes: number }
  | { readonly kind: 'NOT_A_ZIP' }
  | { readonly kind: 'CORRUPT_ZIP' }
  | { readonly kind: 'TOO_MANY_ENTRIES'; readonly limit: number }
  | { readonly kind: 'UNCOMPRESSED_TOO_LARGE'; readonly limitBytes: number }
  | { readonly kind: 'NOT_XLSX' }
  | { readonly kind: 'PARSE_FAILED' }
  | { readonly kind: 'TOO_MANY_ROWS'; readonly sheet: string; readonly limit: number }
  | { readonly kind: 'TOO_MANY_COLUMNS'; readonly sheet: string; readonly limit: number };

export type { Result } from '../../shared/result';

/** Definición de un libro a escribir (plantillas, reportes). Todo valor se escribe como texto. */
export interface ColumnDefinition {
  readonly header: string;
  readonly width?: number;
  /** `text` aplica el formato Texto (`@`) a la columna completa. */
  readonly format: 'text' | 'general';
  /** Lista desplegable de valores permitidos (validación de datos de Excel). */
  readonly allowedValues?: readonly string[];
}

export interface SheetDefinition {
  readonly name: string;
  readonly state?: 'visible' | 'hidden';
  readonly columns: readonly ColumnDefinition[];
  /** Filas de datos (sin encabezado). `null` deja la celda vacía. */
  readonly rows: readonly (readonly (string | null)[])[];
  /** Cantidad de filas, debajo del encabezado, que reciben formato y validaciones. */
  readonly preparedRows?: number;
  readonly freezeHeader?: boolean;
}

export interface WorkbookDefinition {
  readonly sheets: readonly SheetDefinition[];
}
