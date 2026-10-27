// Política Patagonia: frontera explícita para todo valor cuya elección todavía no está
// aprobada. La política productiva devuelve SIEMPRE ausencia de resolución para PAT-4,
// PAT-7/P-09/P-10, PAT-9/P-14, PAT-15, PAT-16 y P-20. No contiene `00`, `034`, `0000`,
// códigos de liquidación, nombres ni estrategias de loteo por default. Las políticas
// sintéticas de los tests viven fuera de `src/` y no resuelven ninguna pregunta bancaria
// (D-081, D-087).
import type { NombrePatagonia } from './nombre';
import type { LotePropuestoPatagonia } from './loteo';
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
  /** PAT-15: contenido de la versión del registro 1. */
  readonly versionLote: (
    perfil: PerfilPatagonia,
    parametros: ParametrosEnvioPatagonia,
  ) => ResolucionPatagonia<string>;
  /** PAT-16: comprobante cuando el legajo no se puede usar directamente. */
  readonly comprobanteNoInformado: (pago: PagoPatagonia) => ResolucionPatagonia<string>;
}

/**
 * Política productiva actual: no hay respuestas aprobadas para los puntos abiertos.
 * Devolver una resolución acá sería inventar una decisión bancaria.
 */
export const POLITICA_PATAGONIA_PRODUCTIVA: PoliticaPatagonia = {
  loteo: () => sinResolucion('P-20'),
  tipoLiquidacion: () => sinResolucion('PAT-7/P-09/P-10'),
  nombre: () => sinResolucion('PAT-9/P-14'),
  provinciaNoAplica: () => sinResolucion('PAT-4'),
  versionLote: () => sinResolucion('PAT-15'),
  comprobanteNoInformado: () => sinResolucion('PAT-16'),
};
