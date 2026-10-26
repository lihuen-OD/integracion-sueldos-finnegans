// API pública del motor fixed-width (F4). Primitivas del motor genérico SIN conocimiento
// de bancos (D-068): tipos y contratos, validación técnica de specs y de estructura,
// identificación de registros por discriminadores, serializer y parser RAW de UN registro,
// serialización y parseo de ARCHIVOS con estructura runtime, inspector y aptitud
// (D-075). Sin persistencia, sin red, sin UI (D-022).

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

export { serializarRegistro } from './serializer';
export type { CodigoErrorValor, ErrorValor } from './serializer';

export { parsearRegistro } from './parser';
export type { CampoCrudo, CodigoErrorParser, ErrorParser, RegistroCrudo } from './parser';

export { serializarArchivo } from './serializerArchivo';
export type { CodigoErrorArchivo, EntradaRegistro, ErrorArchivo } from './serializerArchivo';

export { parsearArchivo } from './parserArchivo';
export type {
  ArchivoParseado,
  CampoArchivo,
  CodigoErrorParseoArchivo,
  ErrorParseoArchivo,
  RegistroArchivo,
} from './parserArchivo';

export { inspeccionarArchivo } from './inspector';

export { hallarBloqueosGeneracion } from './aptitud';
export type { BloqueoGeneracion } from './aptitud';
