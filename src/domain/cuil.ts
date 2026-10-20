// CUIL: normalización controlada N-02 y dígito verificador (D-024, D-046, D-050).
// El algoritmo del DV es un estándar EXTERNO: no proviene de los PDF bancarios (docs/04 §5).
// FUENTE OFICIAL PENDIENTE (P-18): ARCA todavía no está incorporada a references/.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

/** 11 dígitos con DV válido. Solo se obtiene con `parseCuil`. */
export type Cuil = Brand<string, 'Cuil'>;

export type ErrorCuil =
  | 'VACIO'
  | 'CARACTER_NO_PERMITIDO'
  | 'LONGITUD_INVALIDA'
  /** La base da resto 10: no existe DV válido para ella (docs/04 §5). */
  | 'DV_NO_ASIGNABLE'
  | 'DV_INVALIDO';

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * N-02: quita únicamente el guion `-` (U+002D) y el espacio U+0020. Cualquier otro
 * carácter (tab, NBSP, punto, barra, letras, dígitos no ASCII) se conserva para que la
 * validación lo rechace.
 */
export function normalizarCuil(texto: string): string {
  return texto.replace(/[- ]/g, '');
}

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

/** Valida un CUIL leído (con o sin guiones). Los errores nunca incluyen el valor. */
export function parseCuil(texto: string): Result<Cuil, ErrorCuil> {
  const digitos = normalizarCuil(texto);
  if (digitos.length === 0) {
    return { ok: false, error: 'VACIO' };
  }
  if (!/^[0-9]+$/.test(digitos)) {
    return { ok: false, error: 'CARACTER_NO_PERMITIDO' };
  }
  if (digitos.length !== 11) {
    return { ok: false, error: 'LONGITUD_INVALIDA' };
  }
  const dv = dvEsperado(digitos);
  if (dv === null) {
    return { ok: false, error: 'DV_NO_ASIGNABLE' };
  }
  if (dv !== digitos.charCodeAt(10) - 48) {
    return { ok: false, error: 'DV_INVALIDO' };
  }
  return { ok: true, value: digitos as Cuil };
}

/** Formato de lectura humana `PP-DDDDDDDD-V` (plantilla prellenada, D-051). */
export function formatearCuil(cuil: Cuil): string {
  return `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`;
}
