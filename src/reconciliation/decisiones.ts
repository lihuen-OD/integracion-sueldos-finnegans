// Decisiones del operador (docs/03 §E.3): datos puros que resuelven REQUIERE_REVISION. Una
// decisión se aplica solo si la incidencia existe, es resoluble por ese tipo de decisión y
// siguen vigentes los datos que observó (valores y huellas de archivo). En cualquier otro caso
// se informa DECISION_NO_APLICADA: nunca se reutiliza una decisión vieja sobre datos nuevos.
import type { Destino } from '../domain/destino';
import {
  DESCRIPCION_CODIGO,
  idIncidencia,
  type CodigoIncidencia,
  type Incidencia,
} from '../domain/incidencias';
import type { PayrollLine } from '../domain/liquidacion';
import type {
  DecisionNoAplicada,
  DecisionOperador,
  IncidenciaConciliada,
  MotivoNoAplicada,
  Observado,
  TipoDecision,
} from './tipos';

/** Qué REQUIERE_REVISION puede resolverse, con qué decisión y qué archivos observa. */
const RESOLUBLES: Partial<
  Record<CodigoIncidencia, { por: TipoDecision; archivos: readonly ('finnegans' | 'maestro')[] }>
> = {
  BANCO_VACIO: { por: 'ASIGNAR_DESTINO', archivos: ['finnegans'] },
  LEGAJO_NO_COINCIDE: { por: 'CONFIRMAR_REVISION', archivos: ['finnegans', 'maestro'] },
  NETO_NO_CUADRA_COMPONENTES: { por: 'CONFIRMAR_REVISION', archivos: ['finnegans'] },
};

/** Marca la incidencia como resoluble (si corresponde) con los datos que se observan hoy. */
export function conResolubilidad(
  incidencia: Incidencia,
  linea: PayrollLine,
  huellas: { readonly finnegans: string; readonly maestro: string },
): IncidenciaConciliada {
  const regla = RESOLUBLES[incidencia.codigo];
  if (regla === undefined || incidencia.nivel !== 'REQUIERE_REVISION') {
    return incidencia;
  }
  const observado: Observado = {
    cuilTexto: linea.cuilTexto,
    valores: incidencia.valores ?? {},
    huellas: Object.fromEntries(regla.archivos.map((archivo) => [archivo, huellas[archivo]])),
  };
  return { ...incidencia, resoluble: { por: regla.por, observado } };
}

function mismoObservado(a: Observado, b: Observado): boolean {
  const clave = (o: Observado) =>
    JSON.stringify([
      o.cuilTexto,
      o.valores.finnegans ?? null,
      o.valores.maestro ?? null,
      o.huellas.finnegans ?? null,
      o.huellas.maestro ?? null,
    ]);
  return clave(a) === clave(b);
}

/** Decisiones con más de una decisión para la misma incidencia: ninguna se aplica. */
export function enConflicto(
  decisiones: readonly DecisionOperador[],
): ReadonlySet<DecisionOperador> {
  const porIncidencia = new Map<string, DecisionOperador[]>();
  for (const decision of decisiones) {
    porIncidencia.set(decision.incidenciaId, [
      ...(porIncidencia.get(decision.incidenciaId) ?? []),
      decision,
    ]);
  }
  return new Set([...porIncidencia.values()].filter((grupo) => grupo.length > 1).flat());
}

/** Busca la decisión vigente de un tipo para una incidencia resoluble. */
export function decisionVigente(
  incidencia: IncidenciaConciliada,
  decisiones: readonly DecisionOperador[],
  conflicto: ReadonlySet<DecisionOperador>,
): DecisionOperador | undefined {
  const resoluble = incidencia.resoluble;
  if (resoluble === undefined) {
    return undefined;
  }
  return decisiones.find(
    (decision) =>
      !conflicto.has(decision) &&
      decision.incidenciaId === incidencia.id &&
      decision.tipo === resoluble.por &&
      mismoObservado(decision.observado, resoluble.observado),
  );
}

/** Por qué no se aplicó una decisión, contra las incidencias finales de la conciliación. */
export function motivoNoAplicada(
  decision: DecisionOperador,
  incidencias: ReadonlyMap<string, IncidenciaConciliada>,
  conflicto: ReadonlySet<DecisionOperador>,
): MotivoNoAplicada {
  const incidencia = incidencias.get(decision.incidenciaId);
  if (conflicto.has(decision)) {
    return 'DECISIONES_EN_CONFLICTO';
  }
  if (incidencia === undefined) {
    return 'INCIDENCIA_INEXISTENTE';
  }
  return incidencia.resoluble?.por === decision.tipo
    ? 'DATOS_CAMBIARON'
    : 'NO_RESOLUBLE_POR_ESTE_TIPO';
}

/** Incidencia informativa que deja trazada una decisión no aplicada. */
export function incidenciaNoAplicada({ decision, motivo }: DecisionNoAplicada): Incidencia {
  return {
    id: `${idIncidencia('DECISION_NO_APLICADA', 'GLOBAL', decision.refs)}|${decision.id}`,
    codigo: 'DECISION_NO_APLICADA',
    nivel: 'INFORMACION',
    alcance: 'GLOBAL',
    refs: decision.refs,
    motivo,
    detalle: DESCRIPCION_CODIGO.DECISION_NO_APLICADA,
  };
}

function base(
  incidencia: IncidenciaConciliada,
  tipo: TipoDecision,
  datos: { readonly id: string; readonly momento: string },
) {
  if (incidencia.resoluble?.por !== tipo || incidencia.resolucion !== undefined) {
    throw new Error(`La incidencia no se puede resolver con ${tipo}.`);
  }
  return {
    id: datos.id,
    incidenciaId: incidencia.id,
    refs: incidencia.refs,
    observado: incidencia.resoluble.observado,
    momento: datos.momento,
  };
}

/** Arma la decisión de asignar destino a una fila con banco vacío (para la UI de F3). */
export function decisionAsignarDestino(
  incidencia: IncidenciaConciliada,
  destino: Destino,
  datos: { readonly id: string; readonly momento: string },
): DecisionOperador {
  return { ...base(incidencia, 'ASIGNAR_DESTINO', datos), tipo: 'ASIGNAR_DESTINO', destino };
}

/** Arma la confirmación explícita de una revisión (para la UI de F3). */
export function decisionConfirmarRevision(
  incidencia: IncidenciaConciliada,
  datos: { readonly id: string; readonly momento: string },
): DecisionOperador {
  return { ...base(incidencia, 'CONFIRMAR_REVISION', datos), tipo: 'CONFIRMAR_REVISION' };
}
