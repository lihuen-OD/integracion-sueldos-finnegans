// API pública de la conciliación.
export { conciliar } from './conciliar';
export { decisionAsignarDestino, decisionConfirmarRevision } from './decisiones';
export { SIN_MAPEOS_APROBADOS } from './tipos';
export type {
  DecisionNoAplicada,
  DecisionOperador,
  EntradaConciliacion,
  EstadoFila,
  FilaConciliada,
  IncidenciaConciliada,
  MotivoNoAplicada,
  Observado,
  PoliticaLiquidaciones,
  Resolucion,
  ResultadoConciliacion,
  TipoDecision,
} from './tipos';
