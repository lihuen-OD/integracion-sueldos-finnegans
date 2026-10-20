import { describe, expect, it } from 'vitest';
import {
  aTextoDecimal,
  CERO,
  esCero,
  esNegativo,
  formatearImporte,
  MAX_DIGITOS_ENTEROS,
  parseImporte,
  restar,
  sumar,
  sumarTodos,
  type Centavos,
} from '../../../src/domain/money';
import { err, ok } from '../../../src/shared/result';
import { createRandom, randomInt } from '../../fixtures/synthetic/identities.ts';

function centavos(texto: string): Centavos {
  const resultado = parseImporte(texto);
  if (!resultado.ok) {
    throw new Error(`importe de prueba inválido: ${resultado.error}`);
  }
  return resultado.value;
}

/** Decimal canónico a partir de centavos, calculado con bigint en el test (oráculo). */
function decimalDesde(cents: bigint): string {
  const negativo = cents < 0n;
  const abs = negativo ? -cents : cents;
  const fraccion = (abs % 100n).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${(abs / 100n).toString()}.${fraccion}`;
}

describe('parseImporte', () => {
  it.each([
    ['0', 0n],
    ['5', 500n],
    ['0.5', 50n],
    ['0.05', 5n],
    ['1234.56', 123_456n],
    ['1234.5', 123_450n],
    ['-5', -500n],
    ['-0.01', -1n],
    ['-0', 0n],
    ['12345678', 1_234_567_800n],
    ['9999999999999.99', 999_999_999_999_999n],
  ])('acepta %s', (texto, esperado) => {
    expect(parseImporte(texto)).toEqual({ ok: true, value: esperado });
  });

  it.each([
    ['', 'FORMATO_INVALIDO'],
    [' 1', 'FORMATO_INVALIDO'],
    ['1 ', 'FORMATO_INVALIDO'],
    ['1,5', 'FORMATO_INVALIDO'],
    ['1.234,56', 'FORMATO_INVALIDO'],
    ['1.', 'FORMATO_INVALIDO'],
    ['.5', 'FORMATO_INVALIDO'],
    ['+1', 'FORMATO_INVALIDO'],
    ['01', 'FORMATO_INVALIDO'],
    ['--1', 'FORMATO_INVALIDO'],
    ['1e+21', 'FORMATO_INVALIDO'],
    ['1.2345678E7', 'FORMATO_INVALIDO'],
    ['1e-7', 'FORMATO_INVALIDO'],
    ['NaN', 'FORMATO_INVALIDO'],
    ['Infinity', 'FORMATO_INVALIDO'],
    ['１２', 'FORMATO_INVALIDO'],
    ['1.234', 'MAS_DE_2_DECIMALES'],
    ['0.30000000000000004', 'MAS_DE_2_DECIMALES'],
    ['1'.repeat(MAX_DIGITOS_ENTEROS + 1), 'FUERA_DE_RANGO'],
  ])('rechaza %j con %s', (texto, error) => {
    expect(parseImporte(texto)).toEqual({ ok: false, error });
  });

  it('el error nunca contiene el texto leído', () => {
    const resultado = parseImporte('1.234,56');
    expect(JSON.stringify(resultado)).not.toContain('234');
  });

  it('reproduce exactamente 100.000 importes que pasan por un double como en el adaptador', () => {
    const random = createRandom(20261020);
    const maxEnteros = 10n ** BigInt(MAX_DIGITOS_ENTEROS);
    for (let i = 0; i < 100_000; i += 1) {
      // Mezcla de magnitudes: centavos, miles, millones y el máximo de 13 enteros.
      const escala = 10n ** BigInt(randomInt(random, 2, MAX_DIGITOS_ENTEROS + 2));
      const base =
        BigInt(randomInt(random, 0, 2 ** 31 - 1)) * BigInt(randomInt(random, 1, 2 ** 21));
      const cents = (base % escala) % (maxEnteros * 100n);
      const signo = i % 10 === 0 ? -1n : 1n;
      const esperado = cents * signo;
      // El adaptador entrega String(n) del double que Excel guardó para ese decimal.
      const textoAdaptador = String(Number(decimalDesde(esperado)));
      expect(parseImporte(textoAdaptador)).toEqual({ ok: true, value: esperado });
    }
  });
});

describe('aritmética y formato', () => {
  it('suma y resta en bigint', () => {
    expect(sumar(centavos('0.10'), centavos('0.20'))).toBe(30n);
    expect(restar(centavos('1'), centavos('1.01'))).toBe(-1n);
    expect(sumarTodos([])).toBe(CERO);
  });

  it('suma 100.000 importes sin pérdida (contra un oráculo bigint)', () => {
    const random = createRandom(7);
    const importes: Centavos[] = [];
    let oraculo = 0n;
    for (let i = 0; i < 100_000; i += 1) {
      const cents = BigInt(randomInt(random, 0, 99_999_999_999));
      oraculo += cents;
      importes.push(centavos(decimalDesde(cents)));
    }
    expect(sumarTodos(importes)).toBe(oraculo);
  });

  it('distingue cero y negativos', () => {
    expect(esCero(centavos('0'))).toBe(true);
    expect(esCero(centavos('-0'))).toBe(true);
    expect(esCero(centavos('0.01'))).toBe(false);
    expect(esNegativo(centavos('-0.01'))).toBe(true);
    expect(esNegativo(centavos('0'))).toBe(false);
  });

  it.each([
    ['0', '0.00', '0,00'],
    ['0.05', '0.05', '0,05'],
    ['1000', '1000.00', '1.000,00'],
    ['1234.56', '1234.56', '1.234,56'],
    ['-1234567.89', '-1234567.89', '-1.234.567,89'],
    ['9999999999999.99', '9999999999999.99', '9.999.999.999.999,99'],
  ])('%s → %s / %s', (texto, decimal, formateado) => {
    expect(aTextoDecimal(centavos(texto))).toBe(decimal);
    expect(formatearImporte(centavos(texto))).toBe(formateado);
  });

  it('no compila mezclando centavos con number', () => {
    // @ts-expect-error -- un number nunca es Centavos
    expect(() => sumar(CERO, 1)).toThrow(TypeError);
  });
});

describe('Result compartido', () => {
  it('construye resultados', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('X')).toEqual({ ok: false, error: 'X' });
  });
});
