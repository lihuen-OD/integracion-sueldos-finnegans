// API pública del adaptador XLSX. Fuera de este directorio no se importa ExcelJS.
export { readWorkbook, writeWorkbook } from './excelAdapter';
export { diagnoseWorkbook } from './diagnostics';
export type { ColumnDiagnostic, SheetDiagnostic, WorkbookDiagnostic } from './diagnostics';
export { inspectZip } from './zipGuard';
export { DEFAULT_READ_LIMITS } from './types';
export type {
  Cell,
  CellKind,
  CellValue,
  ColumnDefinition,
  ReadError,
  ReadLimits,
  Result,
  Row,
  Sheet,
  SheetDefinition,
  SheetState,
  Workbook,
  WorkbookDefinition,
} from './types';
