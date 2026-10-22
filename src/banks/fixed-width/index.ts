// API pública del motor fixed-width (F4). Primitivas del motor genérico SIN conocimiento
// de bancos (D-068): tipos y contratos, validación técnica de specs y de estructura,
// identificación de registros por discriminadores, serializer y parser RAW de UN registro.
// La ejecución sobre archivos completos (estructura runtime, separadores, BOM, inspector,
// aptitud) corresponde a CP-F4-C / T4-7…T4-12 y todavía no está implementada.

export type {
  ContractStatus,
  EstructuraArchivo,
  FieldSpec,
  FieldType,
  FileSpec,
  Padding,
  RecordSpec,
  ValoresPorCampo,
} from './tipos';

export { codificarAscii, decodificarAscii, esByteAsciiPrintable, esDigitoAscii } from './ascii';
export type { ErrorAscii } from './ascii';

export { validarFileSpec, validarRecordSpec } from './validacion';
export type { CodigoErrorSpec, ErrorSpec } from './validacion';

export { registrosAlcanzados, validarEstructura } from './estructura';

export { identificarRegistro } from './identificacion';
export type { ErrorIdentificacion } from './identificacion';
