// API pública Patagonia B.2 para CP-F6-A: contrato, spec técnica y aptitud contractual.
// No incluye mapper, totales, loteo, serialización, inspector, facade run, golden ni perfil V3.

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
