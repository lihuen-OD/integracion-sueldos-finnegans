// Codec ASCII printable (D-074): 0x20–0x7E, sin BOM ni multibyte. Primitiva neutral compartida por
// la validación de specs, el serializer y el parser. El motor está definido en BYTES: no se usa
// TextEncoder ni TextDecoder, ni se depende de UTF-16; una vez validados, los strings aquí
// tratados tienen 1 unidad de código UTF-16 == 1 byte ASCII, propiedad comprobada por tests.

import type { Result } from '../../shared/result';

export const BYTE_MINIMO_ADMITIDO = 0x20;
export const BYTE_MAXIMO_ADMITIDO = 0x7e;

export type ErrorAscii = 'CARACTER_INVALIDO';

/** Un byte es ASCII printable exactamente si está en 0x20–0x7E (BOM 0xEF… ya queda fuera). */
export function esByteAsciiPrintable(byte: number): boolean {
  return byte >= BYTE_MINIMO_ADMITIDO && byte <= BYTE_MAXIMO_ADMITIDO;
}

/** Los campos `N` admiten únicamente dígitos ASCII (docs/02, semántica RAW). */
export function esDigitoAscii(byte: number): boolean {
  return byte >= 0x30 && byte <= 0x39;
}

/**
 * Codifica texto lógico a bytes ASCII. Rechaza todo lo que no sea 0x20–0x7E, incluidos
 * controles (< 0x20), DEL/extendidos (> 0x7E), Unicode (< 0x80 no printable, acentos,
 * BOM U+FEFF, surrogates de pares sustitutos). Sin BOM: U+FEFF (0xFEFF) queda rechazado.
 */
export function codificarAscii(texto: string): Result<Uint8Array, ErrorAscii> {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const unidad = texto.charCodeAt(i);
    if (!esByteAsciiPrintable(unidad)) {
      return { ok: false, error: 'CARACTER_INVALIDO' };
    }
    bytes[i] = unidad;
  }
  return { ok: true, value: bytes };
}

/**
 * Decodifica bytes ASCII ya validados a string. Precondición: cada byte es 0x20–0x7E
 * (función interna del motor; el parser valida el ASCII antes de llamarla).
 */
export function decodificarAscii(bytes: Uint8Array): string {
  let texto = '';
  bytes.forEach((byte) => {
    texto += String.fromCharCode(byte);
  });
  return texto;
}
