// CUIL: normalización controlada N-02 (D-052, que endurece la N-02 de D-046) y dígito
// verificador (D-024, D-050). El algoritmo del DV es un estándar EXTERNO: no proviene de los PDF
// bancarios (docs/04 §5). FUENTE OFICIAL PENDIENTE (P-18): ARCA todavía no está en references/.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

/** 11 dígitos con DV válido. Solo se obtiene con `parseCuil`. */
export type Cuil = Brand<string, 'Cuil'>;

export type ErrorCuil =
  | 'VACIO'
  /** Un carácter distinto de dígito ASCII o guion ASCII (tab, NBSP, punto, espacio interno…). */
  | 'CARACTER_NO_PERMITIDO'
  /** Solo dígitos, pero no son 11. */
  | 'LONGITUD_INVALIDA'
  /** Dígitos y guiones fuera de la representación `XX-XXXXXXXX-X`. */
  | 'FORMATO_INVALIDO'
  /** La base da resto 10: no existe DV válido para ella (docs/04 §5). */
  | 'DV_NO_ASIGNABLE'
  | 'DV_INVALIDO';

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** A) canónica: 11 dígitos ASCII consecutivos. */
const CANONICA = /^[0-9]{11}$/;
/** B) con guiones ASCII: 2 dígitos, guion, 8 dígitos, guion, 1 dígito. */
const CON_GUIONES = /^[0-9]{2}-[0-9]{8}-[0-9]$/;

function dvEsperado(digitos: string): number | null {
  let suma = 0;
  PESOS.forEach((peso, indice) => {
    suma += peso * (digitos.charCodeAt(indice) - 48);
  });
  const resto = 11 - (suma % 11);
  if (resto === 11) {
    return 0;
  }
  return resto === 10 ? null : resto;
}

/**
 * Valida un CUIL leído (N-02, D-052). Solo se quitan espacios U+0020 de los extremos; luego el
 * valor debe ser exactamente la forma canónica o la forma con guiones. No se corrige ni se acepta
 * ninguna otra representación (guiones en otra posición o repetidos, espacios internos, tab,
 * NBSP, puntos, barras, rayas Unicode, dígitos no ASCII). Después se obtienen los 11 dígitos y se
 * valida el DV. Los errores nunca incluyen el valor; el texto original lo conserva quien llama.
 */
export function parseCuil(texto: string): Result<Cuil, ErrorCuil> {
  const valor = texto.replace(/^ +| +$/g, '');
  if (valor === '') {
    return { ok: false, error: 'VACIO' };
  }
  if (/[^0-9-]/.test(valor)) {
    return { ok: false, error: 'CARACTER_NO_PERMITIDO' };
  }
  if (!CANONICA.test(valor) && !CON_GUIONES.test(valor)) {
    return { ok: false, error: /^[0-9]+$/.test(valor) ? 'LONGITUD_INVALIDA' : 'FORMATO_INVALIDO' };
  }
  const digitos = valor.replaceAll('-', '');
  const dv = dvEsperado(digitos);
  if (dv === null) {
    return { ok: false, error: 'DV_NO_ASIGNABLE' };
  }
  if (dv !== digitos.charCodeAt(10) - 48) {
    return { ok: false, error: 'DV_INVALIDO' };
  }
  return { ok: true, value: digitos as Cuil };
}

/** Formato de lectura humana `XX-XXXXXXXX-X` (plantilla prellenada, D-051). */
export function formatearCuil(cuil: Cuil): string {
  return `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`;
}
