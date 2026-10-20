// Contratos de la conciliación (docs/03 §E y §G). Solo depende del dominio: recibe las lecturas
// ya interpretadas de Finnegans y del maestro y nunca las modifica.
import type { BancoCatalogado, Destino } from '../domain/destino';
import type { Incidencia, NivelVisible, SourceRef, ValoresObservados } from '../domain/incidencias';
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

export type TipoDecision = 'ASIGNAR_DESTINO' | 'CONFIRMAR_REVISION';

/**
 * Datos sobre los que se toma una decisión. Si al volver a conciliar cambió cualquiera de ellos
 * (el valor observado o la huella de un archivo que la decisión miró), la decisión no se aplica.
 */
export interface Observado {
  readonly cuilTexto: string;
  readonly valores: ValoresObservados;
  /** Huella (SHA-256) de cada archivo cuyos datos observó la decisión. */
  readonly huellas: Readonly<Partial<Record<'finnegans' | 'maestro', string>>>;
}

export interface Resolucion {
  readonly decisionId: string;
  readonly tipo: TipoDecision;
  readonly momento: string;
}

export interface IncidenciaConciliada extends Incidencia {
  /** Solo en las REQUIERE_REVISION que el operador puede resolver, y con qué decisión. */
  readonly resoluble?: { readonly por: TipoDecision; readonly observado: Observado };
  /** Presente si una decisión vigente la resolvió: sigue visible y trazable (D-051). */
  readonly resolucion?: Resolucion;
}

interface DecisionBase {
  /** Identificador de la decisión, asignado por quien la registra. */
  readonly id: string;
  /** Incidencia que resuelve. */
  readonly incidenciaId: string;
  /** Copia de las referencias de la incidencia, para trazabilidad. */
  readonly refs: readonly SourceRef[];
  readonly observado: Observado;
  /** Momento en que se tomó (lo provee quien la registra; la conciliación no lee el reloj). */
  readonly momento: string;
}

/** Decisión del operador como dato puro (docs/03 §E.3). Nunca modifica las lecturas. */
export type DecisionOperador =
  /** Resuelve únicamente BANCO_VACIO: indica el destino de la fila (D-013). */
  | (DecisionBase & { readonly tipo: 'ASIGNAR_DESTINO'; readonly destino: Destino })
  /** Confirma una REQUIERE_REVISION (p. ej. legajo distinto) sin modificar ningún dato. */
  | (DecisionBase & { readonly tipo: 'CONFIRMAR_REVISION' });

export type MotivoNoAplicada =
  | 'INCIDENCIA_INEXISTENTE'
  | 'NO_RESOLUBLE_POR_ESTE_TIPO'
  | 'DATOS_CAMBIARON'
  | 'DECISIONES_EN_CONFLICTO';

export interface DecisionNoAplicada {
  readonly decision: DecisionOperador;
  readonly motivo: MotivoNoAplicada;
}

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
  /** Huellas (SHA-256) de los archivos leídos; atan las decisiones a los datos que observaron. */
  readonly huellas: { readonly finnegans: string; readonly maestro: string };
  readonly decisiones?: readonly DecisionOperador[];
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
  readonly decisiones: {
    readonly aplicadas: readonly DecisionOperador[];
    readonly noAplicadas: readonly DecisionNoAplicada[];
  };
}
