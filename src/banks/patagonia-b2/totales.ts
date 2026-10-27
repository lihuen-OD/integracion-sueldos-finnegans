// Totales y límites Patagonia B.2 (CP-F6-B). Dinero exclusivamente `Centavos`/`bigint`;
// las cantidades son conteos enteros. Los totales se calculan sobre EXACTAMENTE los pagos
// y lotes que luego consume el mapper, nunca sobre strings formateados ni otra colección.
import { CERO, type Centavos } from '../../domain/money';
import type { Result } from '../../shared/result';
import {
  validarLotesPatagonia,
  type CodigoErrorLoteoPatagonia,
  type ErrorLoteoPatagonia,
  type LotePropuestoPatagonia,
} from './loteo';
import type { PagoPatagonia } from './modelo';
import { longitudCampoPatagonia } from './validacion';

/** 11 dígitos = 9 enteros + 2 decimales (R2 importe neto). */
export const MAX_IMPORTE_DETALLE_PATAGONIA = (10n **
  BigInt(longitudCampoPatagonia('r2_importeNeto')) -
  1n) as Centavos;
/** 15 dígitos = 13 enteros + 2 decimales (R1 importe del lote). */
export const MAX_IMPORTE_LOTE_PATAGONIA = (10n ** BigInt(longitudCampoPatagonia('r1_importeLote')) -
  1n) as Centavos;
/** 15 dígitos = 13 enteros + 2 decimales (R0 importe total de lotes). */
export const MAX_IMPORTE_TOTAL_PATAGONIA = (10n **
  BigInt(longitudCampoPatagonia('r0_importeLotes')) -
  1n) as Centavos;

export type CodigoErrorTotalesPatagonia =
  | 'SIN_PAGOS'
  | 'NETO_NO_POSITIVO'
  | 'NETO_EXCEDE_LAYOUT'
  | 'LOTE_EXCEDE_LAYOUT'
  | 'TOTAL_EXCEDE_LAYOUT'
  | CodigoErrorLoteoPatagonia;

export interface ErrorTotalesPatagonia {
  readonly codigo: CodigoErrorTotalesPatagonia;
  readonly indicePago?: number;
  readonly indiceLote?: number;
}

export interface TotalesPatagonia {
  readonly totalImporte: Centavos;
  readonly cantidadPagos: number;
  readonly cantidadLotes: number;
  /** Importe de cada lote, alineado con el orden de los lotes recibidos. */
  readonly importesPorLote: readonly Centavos[];
}

export function validarImporteNetoPatagonia(
  importe: Centavos,
): Result<Centavos, ErrorTotalesPatagonia> {
  if (importe <= CERO) {
    return { ok: false, error: { codigo: 'NETO_NO_POSITIVO' } };
  }
  if (importe > MAX_IMPORTE_DETALLE_PATAGONIA) {
    return { ok: false, error: { codigo: 'NETO_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: importe };
}

export function validarImporteLotePatagonia(
  importe: Centavos,
): Result<Centavos, ErrorTotalesPatagonia> {
  if (importe <= CERO) {
    return { ok: false, error: { codigo: 'LOTE_EXCEDE_LAYOUT' } };
  }
  if (importe > MAX_IMPORTE_LOTE_PATAGONIA) {
    return { ok: false, error: { codigo: 'LOTE_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: importe };
}

export function validarTotalPatagonia(total: Centavos): Result<Centavos, ErrorTotalesPatagonia> {
  if (total <= CERO) {
    return { ok: false, error: { codigo: 'TOTAL_EXCEDE_LAYOUT' } };
  }
  if (total > MAX_IMPORTE_TOTAL_PATAGONIA) {
    return { ok: false, error: { codigo: 'TOTAL_EXCEDE_LAYOUT' } };
  }
  return { ok: true, value: total };
}

function agregarLoteo(
  errores: ErrorTotalesPatagonia[],
  erroresLoteo: readonly ErrorLoteoPatagonia[],
): void {
  for (const error of erroresLoteo) {
    errores.push({
      codigo: error.codigo,
      ...(error.indiceLote === undefined ? {} : { indiceLote: error.indiceLote }),
    });
  }
}

/**
 * Calcula cantidad de pagos, cantidad de lotes, importe por lote y total exacto. Una lista
 * vacía, un neto no positivo, un lote/total fuera de layout o un loteo que no cubre los
 * mismos pagos se rechazan.
 */
export function calcularTotalesPatagonia(
  pagos: readonly PagoPatagonia[],
  lotes: readonly LotePropuestoPatagonia[],
): Result<TotalesPatagonia, readonly ErrorTotalesPatagonia[]> {
  const validacionLotes = validarLotesPatagonia(lotes, pagos);
  if (!validacionLotes.ok) {
    const errores: ErrorTotalesPatagonia[] = [];
    agregarLoteo(errores, validacionLotes.error);
    return { ok: false, error: errores };
  }

  const errores: ErrorTotalesPatagonia[] = [];
  let total: bigint = CERO;
  let indicePago = 0;
  const importesPorLote: Centavos[] = [];

  lotes.forEach((lote, indiceLote) => {
    let subtotal: bigint = CERO;
    for (const pago of lote.pagos) {
      const importe = validarImporteNetoPatagonia(pago.neto);
      if (importe.ok) {
        subtotal += importe.value;
      } else {
        errores.push({ ...importe.error, indicePago });
      }
      indicePago += 1;
    }
    const subtotalCentavos = subtotal as Centavos;
    if (!validarImporteLotePatagonia(subtotalCentavos).ok) {
      errores.push({ codigo: 'LOTE_EXCEDE_LAYOUT', indiceLote });
    }
    importesPorLote.push(subtotalCentavos);
    total += subtotal;
  });

  const totalCentavos = total as Centavos;
  if (!validarTotalPatagonia(totalCentavos).ok) {
    errores.push({ codigo: 'TOTAL_EXCEDE_LAYOUT' });
  }

  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      totalImporte: totalCentavos,
      cantidadPagos: pagos.length,
      cantidadLotes: lotes.length,
      importesPorLote,
    },
  };
}
