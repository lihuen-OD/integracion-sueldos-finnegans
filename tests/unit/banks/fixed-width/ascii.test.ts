// Codec ASCII printable (T4-2): frontera explícita bytes/texto. Un byte admitido es
// exactamente 0x20–0x7E; fuera quedan controles (<0x20), DEL y extendidos (>0x7E),
// Unicode multibyte (acentos, ñ), BOM U+FEFF y surrogates.
import { describe, expect, it } from 'vitest';
import {
  codificarAscii,
  decodificarAscii,
  esByteAsciiPrintable,
  esDigitoAscii,
} from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';

describe('límites del alfabeto (D-074)', () => {
  it('acepta exactamente 0x20 y 0x7E y rechaza 0x1F/0x7F y cualquier otro límite', () => {
    expect(esByteAsciiPrintable(0x20)).toBe(true);
    expect(esByteAsciiPrintable(0x7e)).toBe(true);
    expect(esByteAsciiPrintable(0x1f)).toBe(false);
    expect(esByteAsciiPrintable(0x7f)).toBe(false);
    expect(esByteAsciiPrintable(0x00)).toBe(false);
    expect(esByteAsciiPrintable(0xff)).toBe(false);
  });

  it('solo dígitos ASCII para campos N', () => {
    expect(esDigitoAscii(0x30)).toBe(true);
    expect(esDigitoAscii(0x39)).toBe(true);
    expect(esDigitoAscii(0x2f)).toBe(false); // '/'
    expect(esDigitoAscii(0x3a)).toBe(false); // ':'
    expect(esDigitoAscii(0x20)).toBe(false); // espacio: también inválido en N
  });
});

describe('codificarAscii', () => {
  it('codifica ASCII 1 unidad de código == 1 byte, conservando espacios y ceros', () => {
    const codificado = codificarAscii('AB 02');
    expect(codificado.ok).toBe(true);
    if (!codificado.ok) {
      throw new Error(`se esperaba ok: ${JSON.stringify(codificado.error)}`);
    }
    expect(codificado.value).toEqual(bytesDe('AB 02'));
    expect(codificado.value.length).toBe(5);
  });

  it('acepta la cadena vacía (0 bytes)', () => {
    expect(codificarAscii('')).toEqual({ ok: true, value: new Uint8Array(0) });
  });

  it('rechaza controles menores a 0x20 (tab, LF, CR, NUL)', () => {
    for (const texto of ['\ta', '\na', '\ra', '\u0000a']) {
      expect(codificarAscii(texto)).toEqual({ ok: false, error: 'CARACTER_INVALIDO' });
    }
  });

  it('rechaza 0x7F y bytes extendidos', () => {
    expect(codificarAscii('\u007F')).toEqual({ ok: false, error: 'CARACTER_INVALIDO' });
    expect(codificarAscii('\u0080')).toEqual({ ok: false, error: 'CARACTER_INVALIDO' });
  });

  it('rechaza Unicode multibyte, BOM y surrogates', () => {
    for (const texto of ['é', 'ñ', '\uFEFF', '\uD83D\uDE00']) {
      expect(codificarAscii(texto)).toEqual({ ok: false, error: 'CARACTER_INVALIDO' });
    }
  });
});

describe('decodificarAscii', () => {
  it('invierte la codificación de bytes ASCII validados', () => {
    const bytes = bytesDe('00042AB    ');
    expect(textoDe(bytes)).toBe('00042AB    ');
    expect(decodificarAscii(bytes)).toBe(textoDe(bytes));
  });
});
