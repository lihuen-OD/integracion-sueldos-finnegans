// API pública Patagonia B.2: contrato, spec, aptitud, modelo, política, nombre,
// validaciones, totales, loteo, mapper, serialización e inspector. No incluye la fachada
// run, el golden, el perfil V3 ni F7.

export {
  ID_CAMPO_PAT_CODIGO_BANCO,
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_RELLENO_PAT1,
  ID_CAMPO_PAT_TIPO_MOVIMIENTO,
  ID_CAMPO_PAT_VERSION_LOTE,
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
  IDS_ISSUE_PATAGONIA,
  ISSUES_PATAGONIA,
  PAT1_LONGITUD_DECLARADA_DOCUMENTAL,
  PAT1_LONGITUD_GEOMETRICA,
  PAT1_POSICION_FIN,
  PAT1_POSICION_INICIO,
  PAT_TIPO_MOVIMIENTO_FUERA_DE_ALCANCE_F6,
  PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS,
} from './contrato';
export type { IssuePatagonia, PatagoniaIssueId } from './contrato';

export { crearRegistrosPatagonia, crearSpecPatagoniaB2 } from './spec';
export type {
  ConfiguracionTecnicaPatagonia,
  HipotesisDependenciaPat2,
  HipotesisRellenoPat1,
  HipotesisTecnicasPatagonia,
  SpecPatagonia,
} from './spec';

export { aptitudPatagonia } from './aptitud';
export type { AptitudPatagonia } from './aptitud';

export type { PagoPatagonia, ParametrosEnvioPatagonia, PerfilPatagonia } from './modelo';

export { POLITICA_PATAGONIA_PRODUCTIVA, resuelto, sinResolucion } from './politica';
export type { PoliticaPatagonia, PuntoPoliticaPatagonia, ResolucionPatagonia } from './politica';

export {
  MAX_LONGITUD_NOMBRE_PATAGONIA,
  construirNombrePatagonia,
  normalizarComponenteNombre,
} from './nombre';
export type {
  DecisionNombrePatagonia,
  ErrorConstruccionNombrePatagonia,
  NombrePatagonia,
} from './nombre';

export {
  longitudCampoPatagonia,
  validarCodigoBancoPatagonia,
  validarCodigoSucursalPatagonia,
  validarComprobantePatagonia,
  validarConceptoPatagonia,
  validarDependenciaPatagonia,
  validarFechaPatagonia,
  validarNombrePatagonia,
  validarNumeroCuentaPatagonia,
  validarNumeroDocumentoPatagonia,
  validarNumeroEmpresaPatagonia,
  validarNumeroEnvioPatagonia,
  validarProvinciaDocumentoPatagonia,
  validarProvinciaNoAplicaPatagonia,
  validarTextoAsciiPatagonia,
  validarTipoCuentaPatagonia,
  validarTipoDocumentoPatagonia,
  validarTipoLiquidacionPatagonia,
  validarVersionPatagonia,
} from './validacion';
export type {
  ErrorComprobantePatagonia,
  ErrorDependenciaPatagonia,
  ErrorDigitosPatagonia,
  ErrorFechaPatagonia,
  ErrorNombrePatagonia,
  ErrorNumeroEmpresaPatagonia,
  ErrorNumeroEnvioPatagonia,
  ErrorProvinciaPatagonia,
  ErrorTextoPatagonia,
  ErrorTipoCuentaPatagonia,
  ErrorTipoDocumentoPatagonia,
  ErrorTipoLiquidacionPatagonia,
  ErrorVersionPatagonia,
} from './validacion';

export { MAX_CANTIDAD_DETALLE_LOTE, MAX_CANTIDAD_LOTES, validarLotesPatagonia } from './loteo';
export type {
  CodigoErrorLoteoPatagonia,
  ErrorLoteoPatagonia,
  EstrategiaLoteoPatagonia,
  LotePropuestoPatagonia,
} from './loteo';

export {
  MAX_IMPORTE_DETALLE_PATAGONIA,
  MAX_IMPORTE_LOTE_PATAGONIA,
  MAX_IMPORTE_TOTAL_PATAGONIA,
  calcularTotalesPatagonia,
  validarImporteLotePatagonia,
  validarImporteNetoPatagonia,
  validarTotalPatagonia,
} from './totales';
export type {
  CodigoErrorTotalesPatagonia,
  ErrorTotalesPatagonia,
  TotalesPatagonia,
} from './totales';

export { mapearPatagonia } from './mapeo';
export type {
  CodigoErrorMapeoPatagonia,
  ErrorMapeoPatagonia,
  ResultadoMapeoPatagonia,
} from './mapeo';

export { serializarPatagonia } from './serializacion';
export type { ArchivoPatagoniaGenerado, ErrorSerializacionPatagonia } from './serializacion';

export { inspeccionarPatagonia } from './inspeccion';
export type {
  CodigoErrorInspeccionPatagonia,
  ErrorInspeccionPatagonia,
  InspeccionPatagonia,
  LoteInspeccionadoPatagonia,
} from './inspeccion';
