// Parser RAW de UN registro (T4-5). Bytes → vistas literales por campo: sin trim,
// sin parseInt/Number, sin quitar ceros ('00000' queda '00000', espacios preservados),
// sin semántica bancaria. Los bytes de entrada están escritos MANUALMENTE en cada caso.
// Errores acumulables con ubicación técnica ({campoId?, posicion 1-based}) y NUNCA el
// contenido del registro. Este test conoce el contrato real: códigos LONGITUD_INVALIDA /
// CARACTER_NO_ADMITIDO / DIGITO_INVALIDO / VALOR_FIJO_INCORRECTO / SPEC_INVALIDA.
import { describe, expect, it } from 'vitest';
import { parsearRegistro } from '../../../../src/banks/fixed-width';
import type { RegistroCrudo, RecordSpec } from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';
import { campo, fijo, registro } from './specsSinteticas';

/** R1 sintético de 12 bytes: fijo 'R' pos1; N 'NUM' 2..6 (5); A 'NOMBRE' 7..12 (6). */
const R1: RecordSpec = registro('R1', 12, [
  fijo('TIPO', 1, 1, 'R'),
  campo('NUM', 2, 6, 'N'),
  campo('NOMBRE', 7, 12),
]);

function parsear(raw: string, spec: RecordSpec = R1) {
  return parsearRegistro(spec, bytesDe(raw));
}

function campoParseado(raw: string, campoId: string): string {
  const parseado = parsear(raw);
  if (!parseado.ok) {
    throw new Error(`se esperaba ok, se obtuvo: ${JSON.stringify(parseado.error)}`);
  }
  const valor = parseado.value.valores[campoId];
  if (valor === undefined) {
    throw new Error(`la spec no contiene el campo ${campoId}`);
  }
  return valor;
}

describe('parsearRegistro · vistas RAW (sin trim ni canonicalización)', () => {
  it('expone los tres segmentos tal cual se escribieron (`R00042AB    `)', () => {
    const parseado = parsear('R00042AB    ');
    expect(parseado.ok).toBe(true);
    if (!parseado.ok) {
      throw new Error('se esperaba ok');
    }
    expect(parseado.value.valores).toEqual({ NUM: '00042', NOMBRE: 'AB    ', TIPO: 'R' });
    expect(parseado.value.campos).toEqual(
      expect.arrayContaining([
        { campoId: 'TIPO', bytes: bytesDe('R') },
        { campoId: 'NUM', bytes: bytesDe('00042') },
        { campoId: 'NOMBRE', bytes: bytesDe('AB    ') },
      ]),
    );
  });

  it('NO recorta N: los ceros cuentan y el valor no se normaliza a 0', () => {
    // raw = 'R' + NUM(2..6) + NOMBRE(7..12): 1 + 5 + 6 = 12 bytes
    expect(campoParseado('R00000      ', 'NUM')).toBe('00000');
    expect(campoParseado('R00042AB    ', 'NUM')).toBe('00042');
    expect(campoParseado('R70042      ', 'NUM')).toBe('70042');
  });

  it('NO recorta A: espacios iniciales, internos y finales quedan preservados', () => {
    expect(campoParseado('R00042    AB', 'NOMBRE')).toBe('    AB');
    expect(campoParseado('R00042  A   ', 'NOMBRE')).toBe('  A   ');
    expect(campoParseado('R00042AB CD ', 'NOMBRE')).toBe('AB CD ');
  });

  it('las vistas de bytes y las cadenas decodificadas son la misma información', () => {
    const parseado = parsear('R00700ZZ    ');
    expect(parseado.ok).toBe(true);
    if (!parseado.ok) {
      throw new Error('se esperaba ok');
    }
    expect(parsearRegistroRaw(parseado.value, 'NUM')).toBe(parseado.value.valores['NUM']);
    expect(parsearRegistroRaw(parseado.value, 'NOMBRE')).toBe(parseado.value.valores['NOMBRE']);
  });

  it('el id del RegistroCrudo es el id de la RecordSpec', () => {
    const parseado = parsear('R00042AB    ');
    expect(parseado.ok).toBe(true);
    if (!parseado.ok) {
      throw new Error('se esperaba ok');
    }
    expect(parseado.value.registroId).toBe('R1');
  });
});

function parsearRegistroRaw(crudo: RegistroCrudo, campoId: string): string {
  const vista = crudo.campos.find((campo) => campo.campoId === campoId);
  if (vista === undefined) {
    throw new Error(`la lista no contiene ${campoId}`);
  }
  return textoDe(vista.bytes);
}

describe('parsearRegistro · errores con ubicación técnica (sin contenido)', () => {
  it('un byte distinto del fixedValue → VALOR_FIJO_INCORRECTO con posición 1-based', () => {
    expect(parsear('X00042AB    ')).toEqual({
      ok: false,
      error: [{ codigo: 'VALOR_FIJO_INCORRECTO', campoId: 'TIPO', posicion: 1 }],
    });
  });

  it('byte no dígito en campo N, con posición 1-based exacta', () => {
    expect(parsear('R00 42AB CD ')).toEqual({
      ok: false,
      error: [{ codigo: 'DIGITO_INVALIDO', campoId: 'NUM', posicion: 4 }],
    });
    expect(parsear('R0004 AB CD ')).toEqual({
      ok: false,
      error: [{ codigo: 'DIGITO_INVALIDO', campoId: 'NUM', posicion: 6 }],
    });
  });

  it('byte fuera del alfabeto ASCII (0x1F) → CARACTER_NO_ADMITIDO, por posición', () => {
    const bytes = bytesDe('R00042AB    ');
    bytes[9] = 0x1f;
    expect(parsearRegistro(R1, bytes)).toEqual({
      ok: false,
      error: [{ codigo: 'CARACTER_NO_ADMITIDO', posicion: 10 }],
    });
    // 0x7F (DEL) es igualmente inadmitido
    const del = bytesDe('R00042AB    ');
    del[0] = 0x7f;
    const delParseado = parsearRegistro(R1, del);
    expect(delParseado.ok).toBe(false);
    if (delParseado.ok) {
      throw new Error('se esperaba error');
    }
    expect(delParseado.error[0]?.codigo).toBe('CARACTER_NO_ADMITIDO');
  });

  it('acumula múltiples violaciones en orden determinista y sin contenido del registro', () => {
    const bytes = bytesDe('X0004 AB CD ');
    // X (fijo) + espacio en posición 6 de NUM: dos errores, en ese orden
    expect(parsearRegistro(R1, bytes)).toEqual({
      ok: false,
      error: [
        { codigo: 'VALOR_FIJO_INCORRECTO', campoId: 'TIPO', posicion: 1 },
        { codigo: 'DIGITO_INVALIDO', campoId: 'NUM', posicion: 6 },
      ],
    });
    expect(JSON.stringify(parsearRegistro(R1, bytes))).not.toContain('0004');
  });

  it('el detalle del error no incluye el contenido del registro ni la línea', () => {
    const parseado = parsear('X00042AB    ');
    expect(JSON.stringify(parseado)).not.toContain('00042');
    expect(JSON.stringify(parseado)).not.toContain('"X"');
  });
});

describe('parsearRegistro · alias con el buffer de entrada', () => {
  it('RegistroCrudo es el estado observado en el parse: mutar el buffer original no lo altera', () => {
    const buffer = bytesDe('R00042AB    '); // raw manual
    const parseado = parsearRegistro(R1, buffer);
    expect(parseado.ok).toBe(true);
    if (!parseado.ok) {
      throw new Error('se esperaba ok');
    }
    const crudo = parseado.value;
    expect(crudo.valores).toEqual({ TIPO: 'R', NUM: '00042', NOMBRE: 'AB    ' });
    expect(crudo.campos).toEqual(
      expect.arrayContaining([
        { campoId: 'TIPO', bytes: bytesDe('R') },
        { campoId: 'NUM', bytes: bytesDe('00042') },
        { campoId: 'NOMBRE', bytes: bytesDe('AB    ') },
      ]),
    );

    // mutación del buffer original DESPUÉS del parse: bytes inadmitidos en todo el registro
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] = 0x1f;
    }
    expect(crudo.valores).toEqual({ TIPO: 'R', NUM: '00042', NOMBRE: 'AB    ' });
    expect(crudo.campos).toEqual(
      expect.arrayContaining([
        { campoId: 'TIPO', bytes: bytesDe('R') },
        { campoId: 'NUM', bytes: bytesDe('00042') },
        { campoId: 'NOMBRE', bytes: bytesDe('AB    ') },
      ]),
    );
  });
});

describe('parsearRegistro · longitud exacta y specs inválidas', () => {
  it('más corto que recordLength → { codigo: LONGITUD_INVALIDA }', () => {
    expect(parsearRegistro(R1, bytesDe('R00042AB    ').slice(0, 11))).toEqual({
      ok: false,
      error: [{ codigo: 'LONGITUD_INVALIDA' }],
    });
    expect(parsearRegistro(R1, bytesDe('R00042AB    ').slice(0, 9))).toEqual({
      ok: false,
      error: [{ codigo: 'LONGITUD_INVALIDA' }],
    });
  });

  it('más largo que recordLength → { codigo: LONGITUD_INVALIDA }', () => {
    expect(parsearRegistro(R1, bytesDe('R00042AB    X'))).toEqual({
      ok: false,
      error: [{ codigo: 'LONGITUD_INVALIDA' }],
    });
  });

  it('longitud válida y después formato incorrecto: solo errores de contenido', () => {
    // recordLength con bytes más cortos pero dígitos válidos: se comprueba que la
    // longitud no se mezcla con la validación de contenido
    expect(parsearRegistro(R1, bytesDe('R00042AB    ').slice(6))).toEqual({
      ok: false,
      error: [{ codigo: 'LONGITUD_INVALIDA' }],
    });
  });

  it('rechaza specs inválidas: solapamiento y fixedValue más corto que declaredLength', () => {
    const solapada = registro('R1', 8, [campo('A', 1, 4), campo('B', 3, 8)]);
    expect(parsearRegistro(solapada, bytesDe('abcdefgh'))).toEqual({
      ok: false,
      error: [{ codigo: 'SPEC_INVALIDA' }],
    });
    const fijoCorto = registro('R1', 5, [fijo('F', 1, 3, 'AB'), campo('V', 4, 5)]);
    expect(parsearRegistro(fijoCorto, bytesDe('ABCde'))).toEqual({
      ok: false,
      error: [{ codigo: 'SPEC_INVALIDA' }],
    });
  });
});
