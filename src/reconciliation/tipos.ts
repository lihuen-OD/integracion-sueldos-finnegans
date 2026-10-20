// Contratos de la conciliación (docs/03 §E y §G). Solo depende del dominio: recibe las lecturas
// ya interpretadas de Finnegans y del maestro y nunca las modifica.
import type { BancoCatalogado, Destino } from '../domain/destino';
import type { Incidencia, NivelVisible } from '../domain/incidencias';
import type { DescripcionLiquidacion, LecturaFinnegans, PayrollLine } from '../domain/liquidacion';
import type { LecturaMaestro, MasterRecord } from '../domain/maestro';

/** Cada fila de Finnegans termina exactamente en uno de estos estados (docs/03 §G.1). */
export type EstadoFila =
  | {
      readonly estado: 'INCLUIDA';
      readonly destino: Destino;
      /** El destino sale de `Banco` o de una decisión registrada del operador (D-013). */
      readonly origen: 'BANCO_FINNEGANS' | 'DECISION_OPERADOR';
    }
  /** Único motivo automático aprobado (D-036). */
  | { readonly estado: 'EXCLUIDA'; readonly motivo: 'NETO_CERO' }
  /** Destino no determinado: no se infiere ni se reasigna (D-013, D-014). */
  | { readonly estado: 'PENDIENTE'; readonly motivo: 'BANCO_VACIO' | 'BANCO_NO_SOPORTADO' };

export type IncidenciaConciliada = Incidencia;

export interface FilaConciliada {
  readonly linea: PayrollLine;
  /** Único registro del maestro cruzado por CUIL, o null (sin maestro, ambiguo o no aplica). */
  readonly registro: MasterRecord | null;
  readonly estado: EstadoFila;
  readonly incidencias: readonly IncidenciaConciliada[];
  /** El más grave de las incidencias de la fila, o CORRECTO (docs/03 §E.1). */
  readonly nivel: NivelVisible;
}

/**
 * Mapeo aprobado de liquidaciones a códigos bancarios (D-026). En F2 no hay ninguno: la
 * producción usa SIN_MAPEOS_APROBADOS y toda fila incluida queda con LIQUIDACION_SIN_MAPEO.
 * Los tests pueden usar dobles explícitos; nunca se inventan códigos.
 */
export interface PoliticaLiquidaciones {
  tieneMapeoAprobado(descripcion: DescripcionLiquidacion, destino: Destino): boolean;
}

export const SIN_MAPEOS_APROBADOS: PoliticaLiquidaciones = {
  tieneMapeoAprobado: () => false,
};

export interface EntradaConciliacion {
  readonly finnegans: LecturaFinnegans;
  readonly maestro: LecturaMaestro;
  /** Por defecto, el catálogo cerrado aprobado (D-012, D-049). */
  readonly catalogoBancos?: readonly BancoCatalogado[];
  /** Por defecto, SIN_MAPEOS_APROBADOS. */
  readonly liquidaciones?: PoliticaLiquidaciones;
}

export interface ResultadoConciliacion {
  /** Una por cada PayrollLine, en el mismo orden: ninguna fila desaparece. */
  readonly filas: readonly FilaConciliada[];
  /** Todas las incidencias, sin repetir id: de archivo, de fila y del maestro. */
  readonly incidencias: readonly IncidenciaConciliada[];
}
