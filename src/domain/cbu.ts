// CBU: 22 dígitos en dos bloques (8 + 14), cada uno con su dígito verificador (D-024).
// Sin normalización (D-046): espacios, guiones o cualquier carácter que no sea dígito lo
// invalidan. La división en bloques y la posición de los DV son trazables a los PDF (BNA
// p.5, 7, 8 y 11; PAT-DR p.3); el algoritmo de los DV NO: es un estándar externo
// (docs/04 §5). FUENTE OFICIAL PENDIENTE (P-18): BCRA todavía no está en references/.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

/** 22 dígitos con ambos DV válidos. Solo se obtiene con `parseCbu`. */
export type Cbu = Brand<string, 'Cbu'>;

export type ErrorCbu =
  | 'VACIO'
  | 'CARACTER_NO_PERMITIDO'
  | 'LONGITUD_INVALIDA'
  | 'DV_BLOQUE_1_INVALIDO'
  | 'DV_BLOQUE_2_INVALIDO';

/** Bloque 1: entidad (3) + sucursal (4) + DV. */
const PESOS_BLOQUE_1 = [7, 1, 3, 9, 7, 1, 3] as const;
/** Bloque 2: cuenta (13) + DV. */
const PESOS_BLOQUE_2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3] as const;

function dv(digitos: string, pesos: readonly number[]): number {
  let suma = 0;
  pesos.forEach((peso, indice) => {
    suma += peso * (digitos.charCodeAt(indice) - 48);
  });
  return (10 - (suma % 10)) % 10;
}

/** Valida un CBU tal como fue leído. Los errores nunca incluyen el valor. */
export function parseCbu(texto: string): Result<Cbu, ErrorCbu> {
  if (texto.length === 0) {
    return { ok: false, error: 'VACIO' };
  }
  if (!/^[0-9]+$/.test(texto)) {
    return { ok: false, error: 'CARACTER_NO_PERMITIDO' };
  }
  if (texto.length !== 22) {
    return { ok: false, error: 'LONGITUD_INVALIDA' };
  }
  if (dv(texto.slice(0, 7), PESOS_BLOQUE_1) !== texto.charCodeAt(7) - 48) {
    return { ok: false, error: 'DV_BLOQUE_1_INVALIDO' };
  }
  if (dv(texto.slice(8, 21), PESOS_BLOQUE_2) !== texto.charCodeAt(21) - 48) {
    return { ok: false, error: 'DV_BLOQUE_2_INVALIDO' };
  }
  return { ok: true, value: texto as Cbu };
}

/** Código de entidad: dígitos 1–3 del CBU (control de compatibilidad, docs/03 §E.2 regla 12). */
export function entidadCbu(cbu: Cbu): string {
  return cbu.slice(0, 3);
}
