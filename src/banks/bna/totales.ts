// Totales y límites BNA (D-082). Dinero exclusivamente `Centavos`/`bigint`; la cantidad
// es un conteo entero. Los totales se calculan sobre la MISMA lista de pagos que luego se
// mapea/serializa, nunca sobre strings ya formateados ni sobre otra colección.
import { CERO, type Centavos } from '../../domain/money';
import type { Result } from '../../shared/result';
import type { PagoBna } from './modelo';

/** 10 dígitos = 8 enteros + 2 decimales (docs/04 §2.3). */
export const MAX_IMPORTE_R2 = 9_999_999_999n as Centavos;
/** 15 dígitos = 13 enteros + 2 decimales. */
export const MAX_TOTAL_R3 = 999_999_999_999_999n as Centavos;
/** 7 dígitos para la cantidad de registros tipo 2. */
export const MAX_CANTIDAD_R2 = 9_999_999;

export type CodigoErrorTotalesBna =
  | 'SIN_PAGOS'
  | 'NETO_NEGATIVO'
  | 'NETO_EXCEDE_LAYOUT'
  | 'TOTAL_EXCEDE_LAYOUT'
  | 'CANTIDAD_EXCEDE_LAYOUT'
  | 'CANTIDAD_INVALIDA';

export interface ErrorTotalesBna {
  readonly codigo: CodigoErrorTotalesBna;
  readonly indicePago?: number;
}

export interface TotalesBna {
  readonly totalImporte: Centavos;
  readonly cantidad: number;
}

export function validarImporteR2(importe: Centavos): Result<Centavos, ErrorTotalesBna> {
  if (importe < CERO) {
    return { ok: false, error: { codigo: 'NETO_NEGATIVO' } };
  }
  if (importe > MAX_IMPORTE_R2) {
    return { ok: false, error: { codigo: 'NETO_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: importe };
}

export function validarTotalBna(total: Centavos): Result<Centavos, ErrorTotalesBna> {
  if (total > MAX_TOTAL_R3) {
    return { ok: false, error: { codigo: 'TOTAL_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: total };
}

export function validarCantidadBna(cantidad: number): Result<number, ErrorTotalesBna> {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
    return { ok: false, error: { codigo: 'CANTIDAD_INVALIDA' } };
  }
  if (cantidad > MAX_CANTIDAD_R2) {
    return { ok: false, error: { codigo: 'CANTIDAD_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: cantidad };
}

/**
 * Calcula cantidad y suma exacta. Una lista vacía no es un archivo BNA válido porque
 * la estructura canónica exige al menos un registro 2.
 */
export function calcularTotalesBna(
  pagos: readonly PagoBna[],
): Result<TotalesBna, readonly ErrorTotalesBna[]> {
  if (pagos.length === 0) {
    return { ok: false, error: [{ codigo: 'SIN_PAGOS' }] };
  }
  const errores: ErrorTotalesBna[] = [];
  const cantidad = validarCantidadBna(pagos.length);
  if (!cantidad.ok) {
    errores.push(cantidad.error);
  }
  let total: bigint = CERO;
  pagos.forEach((pago, indice) => {
    const importe = validarImporteR2(pago.neto);
    if (importe.ok) {
      total += importe.value;
    } else {
      errores.push({ ...importe.error, indicePago: indice });
    }
  });
  const totalValidado = validarTotalBna(total as Centavos);
  if (!totalValidado.ok) {
    errores.push(totalValidado.error);
  }
  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: { totalImporte: total as Centavos, cantidad: pagos.length },
  };
}
