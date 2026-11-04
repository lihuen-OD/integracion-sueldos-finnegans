// Loteo Patagonia: validación técnica separada de la estrategia de división (PAT-13/P-20).
// No hay estrategia por default: la creación de lotes es una decisión explícita de la
// política. Este módulo solo verifica que una propuesta sea técnicamente representable y
// que use exactamente los mismos pagos, en el mismo orden, sin duplicar ni omitir.
import type { Result } from '../../shared/result';
import type { PagoPatagonia } from './modelo';
import { longitudCampoPatagonia } from './validacion';

export interface LotePropuestoPatagonia {
  /** Número de lote de 4 dígitos, distinto de `0000`. */
  readonly numeroLote: string;
  /** Pagos del lote, en el orden en que se emitirán los registros 2. */
  readonly pagos: readonly PagoPatagonia[];
}

export type CodigoErrorLoteoPatagonia =
  | 'SIN_PAGOS'
  | 'SIN_LOTES'
  | 'LOTE_SIN_PAGOS'
  | 'CANTIDAD_LOTE_EXCEDIDA'
  | 'NUMERO_LOTE_INVALIDO'
  | 'NUMERO_LOTE_REPETIDO'
  | 'CANTIDAD_LOTES_EXCEDIDA'
  | 'LOTEO_NO_COINCIDE_CON_PAGOS';

export interface ErrorLoteoPatagonia {
  readonly codigo: CodigoErrorLoteoPatagonia;
  readonly indiceLote?: number;
  readonly numeroLote?: string;
}

export const MAX_CANTIDAD_DETALLE_LOTE = 10 ** longitudCampoPatagonia('r1_cantidadLote') - 1;
export const MAX_CANTIDAD_LOTES = 10 ** longitudCampoPatagonia('r0_cantidadLotes') - 1;
export const MAX_PAGOS_PATAGONIA = MAX_CANTIDAD_DETALLE_LOTE * MAX_CANTIDAD_LOTES;

/**
 * Contrato de una estrategia de división. La estrategia productiva es explícita y única;
 * una estrategia sintética de tests también debe declararse explícitamente.
 */
export type EstrategiaLoteoPatagonia = (
  pagos: readonly PagoPatagonia[],
) => Result<readonly LotePropuestoPatagonia[], readonly ErrorLoteoPatagonia[]>;

/**
 * P-20 (decisión interna del 2026-11-04): lotes consecutivos de hasta 999 pagos, en el
 * orden original, numerados `0001`, `0002`, … y completados a cuatro posiciones. No hay
 * opciones configurables ni otra estrategia. Los errores se devuelven tipados; no se
 * lanzan excepciones por entradas vacías ni por exceso de capacidad.
 *
 * Preserva exactamente la secuencia recibida: no elimina, reordena ni deduplica pagos,
 * tampoco cuando dos entradas comparten referencia. La unicidad de referencias la garantiza
 * A0 en la fachada (`COBERTURA_PAGOS_INCOMPLETA` / `refsUnicas`), antes de evaluar aptitud.
 * Esta función no revalida la conciliación ni promete corregir duplicados de entrada.
 */
export function estrategiaLotesPatagonia(
  pagos: readonly PagoPatagonia[],
): Result<readonly LotePropuestoPatagonia[], readonly ErrorLoteoPatagonia[]> {
  if (pagos.length === 0) {
    return { ok: false, error: [{ codigo: 'SIN_PAGOS' }] };
  }
  if (pagos.length > MAX_PAGOS_PATAGONIA) {
    return { ok: false, error: [{ codigo: 'CANTIDAD_LOTES_EXCEDIDA' }] };
  }

  const lotes: LotePropuestoPatagonia[] = [];
  for (let inicio = 0; inicio < pagos.length; inicio += MAX_CANTIDAD_DETALLE_LOTE) {
    const numeroLote = String(lotes.length + 1).padStart(4, '0');
    lotes.push({
      numeroLote,
      pagos: pagos.slice(inicio, inicio + MAX_CANTIDAD_DETALLE_LOTE),
    });
  }
  return validarLotesPatagonia(lotes, pagos);
}

function numeroLoteValido(numeroLote: string): boolean {
  return /^[0-9]{4}$/.test(numeroLote) && numeroLote !== '0000';
}

/**
 * Valida estructura y cobertura. No decide cómo dividir: recibe una propuesta ya resuelta.
 * La igualdad de pagos es por identidad y orden para que totales, mapper y loteo operen
 * sobre exactamente la misma lista.
 */
export function validarLotesPatagonia(
  lotes: readonly LotePropuestoPatagonia[],
  pagos: readonly PagoPatagonia[],
): Result<readonly LotePropuestoPatagonia[], readonly ErrorLoteoPatagonia[]> {
  const errores: ErrorLoteoPatagonia[] = [];
  if (pagos.length === 0) {
    errores.push({ codigo: 'SIN_PAGOS' });
  }
  if (lotes.length === 0) {
    errores.push({ codigo: 'SIN_LOTES' });
  }
  if (lotes.length > MAX_CANTIDAD_LOTES) {
    errores.push({ codigo: 'CANTIDAD_LOTES_EXCEDIDA' });
  }

  const numeros = new Set<string>();
  const pagosVistos: PagoPatagonia[] = [];
  lotes.forEach((lote, indiceLote) => {
    const numeroLote = typeof lote.numeroLote === 'string' ? lote.numeroLote : '';
    if (!numeroLoteValido(numeroLote)) {
      errores.push({ codigo: 'NUMERO_LOTE_INVALIDO', indiceLote, numeroLote });
    } else if (numeros.has(numeroLote)) {
      errores.push({ codigo: 'NUMERO_LOTE_REPETIDO', indiceLote, numeroLote });
    } else {
      numeros.add(numeroLote);
    }
    if (!Array.isArray(lote.pagos)) {
      errores.push({ codigo: 'LOTE_SIN_PAGOS', indiceLote, numeroLote });
      return;
    }
    const pagosDelLote = lote.pagos as readonly PagoPatagonia[];
    if (pagosDelLote.length === 0) {
      errores.push({ codigo: 'LOTE_SIN_PAGOS', indiceLote, numeroLote });
    } else if (pagosDelLote.length > MAX_CANTIDAD_DETALLE_LOTE) {
      errores.push({ codigo: 'CANTIDAD_LOTE_EXCEDIDA', indiceLote, numeroLote });
    }
    for (const pago of pagosDelLote) {
      pagosVistos.push(pago);
    }
  });

  const coincide =
    pagosVistos.length === pagos.length &&
    pagosVistos.every((pago, indice) => pago === pagos[indice]);
  if (!coincide) {
    errores.push({ codigo: 'LOTEO_NO_COINCIDE_CON_PAGOS' });
  }

  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return { ok: true, value: lotes };
}
