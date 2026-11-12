// Política Patagonia: frontera explícita para todo valor cuya elección todavía no está
// aprobada. La política productiva devuelve SIEMPRE ausencia de resolución para
// PAT-7/P-09/P-10. PAT-4, PAT-9/P-14, PAT-15, PAT-16 y P-20 quedan resueltos solo por
// las decisiones técnicas internas aprobadas el 2026-11-04 (CP-F7-C2.4-A2.2, A2.3, A2.4,
// A2.5 y A2.6): provincia `00` cuando el tipo no exige informarla, nombre `APELLIDO NOMBRE`
// normalizado y sin truncar, versión vacía que el serializador completa con 8 espacios en
// R0/R1, comprobante `0000000` únicamente cuando el legajo está ausente y lotes
// consecutivos de hasta 999 pagos. No son confirmaciones del banco.
// No contiene `034`, códigos de liquidación, nombres literales de personas ni estrategias
// de loteo alternativas. Las políticas sintéticas de los tests viven fuera de `src/` y no
// resuelven ninguna pregunta bancaria (D-081, D-087).
import type { NombrePatagonia } from './nombre';
import { construirNombrePatagonia, type DecisionNombrePatagonia } from './nombre';
import { estrategiaLotesPatagonia, type LotePropuestoPatagonia } from './loteo';
import type { PagoPatagonia, ParametrosEnvioPatagonia, PerfilPatagonia } from './modelo';

export type PuntoPoliticaPatagonia =
  'PAT-4' | 'PAT-7/P-09/P-10' | 'PAT-9/P-14' | 'PAT-15' | 'PAT-16' | 'P-20';

export type ResolucionPatagonia<T> =
  | { readonly estado: 'RESUELTO'; readonly valor: T }
  | { readonly estado: 'SIN_RESOLUCION'; readonly punto: PuntoPoliticaPatagonia };

export function resuelto<T>(valor: T): ResolucionPatagonia<T> {
  return { estado: 'RESUELTO', valor };
}

export function sinResolucion<T = never>(punto: PuntoPoliticaPatagonia): ResolucionPatagonia<T> {
  return { estado: 'SIN_RESOLUCION', punto };
}

export interface PoliticaPatagonia {
  /** P-20/PAT-13: división y numeración de lotes; no hay estrategia productiva. */
  readonly loteo: (
    pagos: readonly PagoPatagonia[],
  ) => ResolucionPatagonia<readonly LotePropuestoPatagonia[]>;
  /** PAT-7/P-09/P-10: código de tipo de liquidación (Anexo III). */
  readonly tipoLiquidacion: (pago: PagoPatagonia) => ResolucionPatagonia<string>;
  /** PAT-9/P-14: composición, separador y truncamiento del apellido y nombre. */
  readonly nombre: (pago: PagoPatagonia) => ResolucionPatagonia<NombrePatagonia>;
  /** PAT-4: valor de provincia cuando el tipo de documento no exige informarla. */
  readonly provinciaNoAplica: (pago: PagoPatagonia) => ResolucionPatagonia<string>;
  /** PAT-15: resuelto por decisión interna; `''` se completa con 8 espacios en R1. */
  readonly versionLote: (
    perfil: PerfilPatagonia,
    parametros: ParametrosEnvioPatagonia,
  ) => ResolucionPatagonia<string>;
  /** PAT-16: comprobante cuando el legajo está realmente ausente (`null`). */
  readonly comprobanteNoInformado: (pago: PagoPatagonia) => ResolucionPatagonia<string>;
}

/**
 * Decisión técnica interna PAT-9/P-14 (A2.6): `APELLIDO NOMBRE`, un espacio, extremos
 * recortados, espacios internos colapsados, mayúsculas, sin tildes/diéresis y Ñ→N, sin
 * truncamiento. Es la misma decisión que usa la evaluación para tipificar errores; no
 * duplica normalización ni validación, solo parametriza `construirNombrePatagonia()`.
 */
export const DECISION_NOMBRE_PATAGONIA_PRODUCTIVA: DecisionNombrePatagonia = {
  orden: 'APELLIDO_NOMBRE',
  separador: ' ',
  recortarExtremos: true,
  colapsarEspaciosInternos: true,
  truncamiento: 'RECHAZAR',
};

/**
 * Política productiva actual: PAT-4, PAT-9/P-14, PAT-15, PAT-16 y P-20 están resueltos por
 * decisiones técnicas internas (`00` cuando el tipo no exige provincia; nombre
 * `APELLIDO NOMBRE` sin truncar; 8 espacios en 189–196 de R0/R1; `0000000` solo si falta el
 * legajo; lotes consecutivos de hasta 999 pagos). Solo PAT-7/P-09/P-10 sigue abierto:
 * devolver una resolución para él sería inventar una decisión bancaria.
 */
export const POLITICA_PATAGONIA_PRODUCTIVA: PoliticaPatagonia = {
  // La estrategia es única y explícita: no hay opciones configurables de loteo. Si falla,
  // la evaluación productiva ya devolvió `LOTEO_PATAGONIA_INVALIDO` antes de consultar la
  // política; este `SIN_RESOLUCION` es solo la frontera defensiva del contrato del mapper,
  // nunca la clasificación de un exceso de capacidad en la fachada.
  loteo: (pagos) => {
    const resultado = estrategiaLotesPatagonia(pagos);
    return resultado.ok ? resuelto(resultado.value) : sinResolucion('P-20');
  },
  tipoLiquidacion: () => sinResolucion('PAT-7/P-09/P-10'),
  // Si el nombre no se puede construir, la evaluación productiva ya devolvió
  // `NOMBRE_PATAGONIA_INVALIDO` antes de consultar la política; el mapper solo ve nombres
  // construibles. La frontera sigue siendo explícita y sin defaults.
  nombre: (pago) => {
    const resultado = construirNombrePatagonia(
      pago.apellido,
      pago.nombre,
      DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
    );
    return resultado.ok ? resuelto(resultado.value) : sinResolucion('PAT-9/P-14');
  },
  // El mapper solo la invoca cuando el tipo de documento no es 004; un tipo 004 usa
  // exclusivamente la provincia del maestro y nunca cae acá.
  provinciaNoAplica: () => resuelto('00'),
  // El mapper valida el string y el motor fixed-width aplica SPACE_RIGHT hasta 8.
  versionLote: () => resuelto(''),
  // El mapper solo invoca esta política para un legajo `null`; nunca para uno inválido.
  comprobanteNoInformado: (pago) =>
    pago.legajo === null ? resuelto('0000000') : sinResolucion('PAT-16'),
};
