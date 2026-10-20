// Modelo de incidencias (docs/03 §E.1 y §H): cuatro niveles visibles (D-019) y alcance global
// o por banco (D-032). Los parsers producen `Hallazgo`s; la conciliación resuelve su alcance y
// los convierte en `Incidencia`s. Ningún `detalle` incluye valores de celdas: los valores
// observados viajan aparte, en `valores`, solo para mostrarlos al operador (nunca se registran).
import type { Destino } from './destino';

export type NivelVisible = 'CORRECTO' | 'INFORMACION' | 'REQUIERE_REVISION' | 'BLOQUEANTE';
/** Una incidencia nunca es CORRECTO. */
export type NivelIncidencia = Exclude<NivelVisible, 'CORRECTO'>;
export type AlcanceIncidencia = 'GLOBAL' | Destino;

/** Códigos de F2 (D-047). Diferidos: NETO_EXCEDE_LAYOUT, NOMBRE_*, DOCUMENTO_NO_COINCIDE_CUIL. */
export const DESCRIPCION_CODIGO = {
  ESTRUCTURA_INVALIDA: 'El archivo no tiene la estructura esperada.',
  COLUMNA_DESCONOCIDA: 'Columna no prevista en el contrato del archivo.',
  FORMULA_EN_CELDA: 'Celda con fórmula: no se evalúan fórmulas.',
  CELDA_NUMERICA_EN_TEXTO: 'Identificador guardado como número: Excel pudo perder ceros o dígitos.',
  TIPO_CELDA_INVALIDO: 'Tipo de celda no admitido para este dato.',
  FILAS_VACIAS_IGNORADAS: 'Filas totalmente vacías ignoradas.',
  VERSION_MAESTRO_NO_SOPORTADA: 'Falta la hoja Control o su VERSION_CONTRATO no es compatible.',
  CAMPO_REQUERIDO_FALTANTE: 'Falta un dato requerido.',
  CUIL_INVALIDO: 'CUIL inválido (formato o dígito verificador).',
  CUIL_REPETIDO_FINNEGANS: 'CUIL repetido en Finnegans: nunca se suman ni fusionan filas.',
  CUIL_REPETIDO_MAESTRO: 'CUIL repetido en el maestro: no se elige ningún registro.',
  LEGAJO_REPETIDO_MAESTRO: 'LEGAJO repetido en el maestro: no se elige ningún registro.',
  NETO_CERO: 'Neto igual a cero: la fila se excluye del pago.',
  IMPORTE_INVALIDO: 'Importe no interpretable.',
  NETO_NEGATIVO: 'Neto negativo.',
  SIN_MAESTRO: 'La fila no tiene registro en el maestro.',
  MAESTRO_SIN_LIQUIDACION: 'Registro del maestro sin liquidación en Finnegans.',
  LEGAJO_NO_COINCIDE: 'El legajo no coincide exactamente entre Finnegans y el maestro.',
  BANCO_VACIO: 'Banco vacío: el operador debe indicar el destino.',
  BANCO_NO_SOPORTADO: 'Banco fuera del catálogo: no se reasigna.',
  BANCO_INCOMPATIBLE_MAESTRO: 'El banco de Finnegans no es compatible con los datos del maestro.',
  CBU_FALTANTE: 'Falta el CBU.',
  CBU_INVALIDO: 'CBU inválido.',
  DATO_PATAGONIA_FALTANTE: 'Falta un dato de cuenta Patagonia.',
  DATO_PATAGONIA_INVALIDO: 'Dato de cuenta Patagonia inválido.',
  LIQUIDACION_SIN_MAPEO: 'Tipo de liquidación sin mapeo aprobado al código bancario.',
  NETO_NO_CUADRA_COMPONENTES: 'Remunerativo + No remunerativo − Descuento no coincide con el Neto.',
  LEGAJO_NOMBRE_INCONSISTENTE: 'Legajoapellidonombre no empieza con el legajo.',
  DECISION_NO_APLICADA: 'Decisión del operador que ya no corresponde a los datos actuales.',
} as const satisfies Record<string, string>;

export type CodigoIncidencia = keyof typeof DESCRIPCION_CODIGO;

export const CODIGOS_INCIDENCIA = Object.keys(DESCRIPCION_CODIGO) as readonly CodigoIncidencia[];

export type ArchivoEntrada = 'FINNEGANS' | 'MAESTRO';

/** Ubicación en un archivo de entrada. `fila` es 1-based; `columna`, la letra de Excel. */
export interface SourceRef {
  readonly archivo: ArchivoEntrada;
  readonly hoja?: string;
  readonly fila?: number;
  readonly columna?: string;
}

/** Valores observados en cada fuente, para mostrarlos todos (p. ej. legajo `007` vs `7`). */
export type ValoresObservados = Readonly<Partial<Record<'finnegans' | 'maestro', string>>>;

/**
 * A qué se refiere un hallazgo, para resolver su alcance en la conciliación:
 * - `GLOBAL`: alcance global fijo (estructura de un archivo, importe que impide el total).
 * - `FILA`: una fila de Finnegans (`refs[0]`); alcance = destino de la fila, o global si no
 *   tiene destino o está excluida.
 * - `REGISTRO`: un registro del maestro (`refs[0]`); alcance = destino de las filas que lo
 *   usan; si ninguna fila lo usa, se informa como INFORMACION (docs/03 §B.3).
 */
export type ObjetivoHallazgo = 'GLOBAL' | 'FILA' | 'REGISTRO';

export interface Hallazgo {
  readonly codigo: CodigoIncidencia;
  readonly nivel: NivelIncidencia;
  readonly objetivo: ObjetivoHallazgo;
  readonly refs: readonly SourceRef[];
  /** Columna o campo afectado (encabezado del archivo). */
  readonly campo?: string;
  /** Subcódigo técnico (p. ej. `DV_INVALIDO`); nunca el valor. */
  readonly motivo?: string;
  readonly valores?: ValoresObservados;
  /** Texto para el operador, sin valores de celdas. */
  readonly detalle: string;
}

/** Un hallazgo con su alcance ya resuelto. */
export interface Incidencia {
  /** Determinista: lo referencian las decisiones del operador. */
  readonly id: string;
  readonly codigo: CodigoIncidencia;
  readonly nivel: NivelIncidencia;
  readonly alcance: AlcanceIncidencia;
  readonly refs: readonly SourceRef[];
  readonly campo?: string;
  readonly motivo?: string;
  readonly valores?: ValoresObservados;
  readonly detalle: string;
}

const SEVERIDAD: Readonly<Record<NivelVisible, number>> = {
  CORRECTO: 0,
  INFORMACION: 1,
  REQUIERE_REVISION: 2,
  BLOQUEANTE: 3,
};

/** Negativo si `a` es menos grave que `b`, positivo si es más grave. */
export function compararNiveles(a: NivelVisible, b: NivelVisible): number {
  return SEVERIDAD[a] - SEVERIDAD[b];
}

/** El más grave de los niveles, o CORRECTO si no hay ninguno (docs/03 §E.1). */
export function nivelMasGrave(niveles: Iterable<NivelVisible>): NivelVisible {
  let resultado: NivelVisible = 'CORRECTO';
  for (const nivel of niveles) {
    if (compararNiveles(nivel, resultado) > 0) {
      resultado = nivel;
    }
  }
  return resultado;
}

export function claveRef(ref: SourceRef): string {
  return [
    ref.archivo,
    ref.hoja ?? '',
    ref.fila === undefined ? '' : String(ref.fila),
    ref.columna ?? '',
  ].join(':');
}

export function idIncidencia(
  codigo: CodigoIncidencia,
  alcance: AlcanceIncidencia,
  refs: readonly SourceRef[],
  campo?: string,
): string {
  return [codigo, alcance, refs.map(claveRef).join(','), campo ?? ''].join('|');
}

/**
 * Convierte un hallazgo en incidencia con el alcance resuelto por la conciliación. El nivel
 * puede ajustarse cuando la regla lo indica (p. ej. un registro del maestro que no usa
 * ninguna fila, o un campo exclusivo del otro destino: INFORMACION, D-048).
 */
export function aIncidencia(
  hallazgo: Hallazgo,
  alcance: AlcanceIncidencia,
  nivel: NivelIncidencia = hallazgo.nivel,
): Incidencia {
  return {
    id: idIncidencia(hallazgo.codigo, alcance, hallazgo.refs, hallazgo.campo),
    codigo: hallazgo.codigo,
    nivel,
    alcance,
    refs: hallazgo.refs,
    ...(hallazgo.campo === undefined ? {} : { campo: hallazgo.campo }),
    ...(hallazgo.motivo === undefined ? {} : { motivo: hallazgo.motivo }),
    ...(hallazgo.valores === undefined ? {} : { valores: hallazgo.valores }),
    detalle: hallazgo.detalle,
  };
}
