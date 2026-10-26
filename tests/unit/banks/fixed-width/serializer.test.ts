// Serializer de UN registro (T4-4). Valores lógicos → representación física exacta.
// Las expectativas físicas están definidas MANUALMENTE ( nunca comparando contra otra
// llamada al serializer). N: solo dígitos, vacío → error, ZERO_LEFT, overflow → error.
// A: ASCII printable, vacío → espacios, SPACE_RIGHT. Nunca trunca. fixedValue aporta la spec.
import { describe, expect, it } from 'vitest';
import { serializarRegistro } from '../../../../src/banks/fixed-width';
import type { RecordSpec } from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';
import { campo, fijo, registro } from './specsSinteticas';

/** R1 sintético de 12 bytes: fijo 'R' pos1; N 2..6 (5); A 7..12 (6). */
const R1: RecordSpec = registro('R1', 12, [
  fijo('TIPO', 1, 1, 'R'),
  campo('NUM', 2, 6, 'N'),
  campo('NOMBRE', 7, 12),
]);

const VALORES = { NUM: '42', NOMBRE: 'AB' };

/** Acceso estrechado para el caso feliz; los errores se prueban con `codigos`. */
function bytesOk(valores: Record<string, string>, spec: RecordSpec = R1): Uint8Array {
  const resultado = serializarRegistro(spec, valores);
  if (!resultado.ok) {
    throw new Error(`se esperaba ok, se obtuvo: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

describe('serializarRegistro · salida física exacta', () => {
  it('arma la línea completa con relleno y fijo de la spec (expectativa manual)', () => {
    const resultado = serializarRegistro(R1, VALORES);
    expect(resultado).toEqual({ ok: true, value: bytesDe('R00042AB    ') });
    expect(bytesOk(VALORES).length).toBe(12);
    expect(textoDe(bytesOk(VALORES))).toBe('R00042AB    ');
  });

  it('ZERO_LEFT rellena con ceros a la izquierda; valor exacto no se altera', () => {
    expect(textoDe(bytesOk({ NUM: '5', NOMBRE: 'AB' }))).toBe('R00005AB    ');
    expect(textoDe(bytesOk({ NUM: '00042', NOMBRE: 'AB' }))).toBe('R00042AB    ');
  });

  it('A vacío → espacios; los espacios recibidos son caracteres significativos', () => {
    expect(textoDe(bytesOk({ NUM: '1', NOMBRE: '' }))).toBe('R00001      ');
    expect(textoDe(bytesOk({ NUM: '1', NOMBRE: '  AB' }))).toBe('R00001  AB  ');
    expect(textoDe(bytesOk({ NUM: '1', NOMBRE: 'AB CD' }))).toBe('R00001AB CD ');
  });

  it('determinismo: mismas entradas → mismos bytes', () => {
    const a = Array.from(bytesOk(VALORES));
    const b = Array.from(bytesOk(VALORES));
    expect(a).toEqual(b);
  });
});

describe('serializarRegistro · errores acumulables (deterministas)', () => {
  function codigos(resultado: { ok: boolean; error?: readonly unknown[] }): string[] {
    if (resultado.ok || resultado.error === undefined) {
      return [];
    }
    return resultado.error.map((e) => (e as { codigo: string }).codigo);
  }

  it('N vacío → VACIO_NO_PERMITIDO; N con espacios o letra → DIGITO_INVALIDO', () => {
    expect(codigos(serializarRegistro(R1, { NUM: '', NOMBRE: 'AB' }))).toEqual([
      'VACIO_NO_PERMITIDO',
    ]);
    expect(codigos(serializarRegistro(R1, { NUM: ' 1', NOMBRE: 'AB' }))).toEqual([
      'DIGITO_INVALIDO',
    ]);
    expect(codigos(serializarRegistro(R1, { NUM: 'a1', NOMBRE: 'AB' }))).toEqual([
      'DIGITO_INVALIDO',
    ]);
  });

  it('overflow → LONGITUD_EXCEDIDA, sin truncar', () => {
    expect(codigos(serializarRegistro(R1, { NUM: '123456', NOMBRE: 'AB' }))).toEqual([
      'LONGITUD_EXCEDIDA',
    ]);
    expect(codigos(serializarRegistro(R1, { NUM: '12', NOMBRE: 'ABCDEF7' }))).toEqual([
      'LONGITUD_EXCEDIDA',
    ]);
  });

  it('caracteres fuera del alfabeto → CARACTER_INVALIDO (tab, acento, BOM)', () => {
    expect(codigos(serializarRegistro(R1, { NUM: '1', NOMBRE: 'é' }))).toEqual([
      'CARACTER_INVALIDO',
    ]);
    expect(codigos(serializarRegistro(R1, { NUM: '1', NOMBRE: 'A\tB' }))).toEqual([
      'CARACTER_INVALIDO',
    ]);
  });

  it('clave de campo variable ausente → VALOR_FALTANTE ("" distinto de ausente)', () => {
    expect(codigos(serializarRegistro(R1, { NOMBRE: 'AB' }))).toEqual(['VALOR_FALTANTE']);
    const detalle = serializarRegistro(R1, { NOMBRE: 'AB' });
    if (detalle.ok) {
      throw new Error('se esperaba error');
    }
    expect(detalle.error).toEqual([{ codigo: 'VALOR_FALTANTE', campoId: 'NUM' }]);
  });

  it('clave para campo fijo → VALOR_EN_CAMPO_FIJO; clave desconocida → VALOR_DESCONOCIDO', () => {
    expect(codigos(serializarRegistro(R1, { NUM: '1', NOMBRE: 'AB', TIPO: 'X' }))).toEqual([
      'VALOR_EN_CAMPO_FIJO',
    ]);
    expect(codigos(serializarRegistro(R1, { NUM: '1', NOMBRE: 'AB', EXTRA: 'Y' }))).toEqual([
      'VALOR_DESCONOCIDO',
    ]);
  });

  it('acumula varios errores en orden determinista', () => {
    const resultado = serializarRegistro(R1, { NOMBRE: 'é', EXTRA: 'Y', OTRO: 'Z' });
    expect(codigos(resultado)).toEqual([
      'VALOR_DESCONOCIDO', // EXTRA (alfabético antes que OTRO)
      'VALOR_DESCONOCIDO', // OTRO
      'VALOR_FALTANTE', // NUM (orden de la spec)
      'CARACTER_INVALIDO', // NOMBRE
    ]);
  });

  it('rechaza specs inválidas: { codigo: SPEC_INVALIDA } (D-075: el estado no repara)', () => {
    const solapada = registro('R1', 8, [campo('A', 1, 4), campo('B', 3, 8)]);
    expect(serializarRegistro(solapada, { A: 'ab', B: 'cd' })).toEqual({
      ok: false,
      error: [{ codigo: 'SPEC_INVALIDA' }],
    });
  });
});
