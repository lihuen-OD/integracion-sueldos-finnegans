export {
  ID_CAMPO_BNA_TIPO_DOCUMENTO,
  ID_REGISTRO_BNA_1,
  ID_REGISTRO_BNA_2,
  ID_REGISTRO_BNA_3,
  IDS_ISSUE_BNA,
  ISSUES_BNA,
} from './contrato';
export type { BnaIssueId, EstadoIssueBna, IssueBna } from './contrato';

export {
  REGISTRO_BNA_1,
  REGISTRO_BNA_2,
  REGISTRO_BNA_3,
  REGISTROS_BNA,
  crearSpecBna,
} from './spec';
export type { ConfiguracionTecnicaBna } from './spec';

export { aptitudBna } from './aptitud';
export type { AptitudBna } from './aptitud';

export type { PagoBna, ParametrosEnvioBna, PerfilBna } from './modelo';

export { POLITICA_BNA_PRODUCTIVA, resuelto, sinResolucion } from './politica';
export type {
  CamposBeneficiarioBna,
  DocumentoBna,
  EntidadSucursalBna,
  PoliticaBna,
  PuntoPoliticaBna,
  ResolucionBna,
} from './politica';

export {
  longitudCampoBna,
  validarAlfabetoBna,
  validarConvenioBna,
  validarDigitosBna,
  validarFechaCompensacionBna,
  validarMonedaBna,
  validarNumeroEnvioBna,
  validarTextoBna,
} from './validacion';
export type {
  ErrorConvenioBna,
  ErrorDigitosBna,
  ErrorFechaBna,
  ErrorMonedaBna,
  ErrorNumeroEnvioBna,
  ErrorTextoBna,
} from './validacion';

export {
  MAX_CANTIDAD_R2,
  MAX_IMPORTE_R2,
  MAX_TOTAL_R3,
  calcularTotalesBna,
  validarCantidadBna,
  validarImporteR2,
  validarTotalBna,
} from './totales';
export type { CodigoErrorTotalesBna, ErrorTotalesBna, TotalesBna } from './totales';

export { mapearBna } from './mapeo';
export type { CodigoErrorMapeoBna, ErrorMapeoBna, ResultadoMapeoBna } from './mapeo';

export { serializarBna } from './serializacion';
export type { ArchivoBnaGenerado, ErrorSerializacionBna } from './serializacion';

export { inspeccionarBna } from './inspeccion';
export type {
  AdvertenciaBna,
  CodigoErrorInspeccionBna,
  ErrorInspeccionBna,
  InspeccionBna,
} from './inspeccion';
