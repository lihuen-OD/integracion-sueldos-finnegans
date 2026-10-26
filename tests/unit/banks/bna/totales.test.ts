// Totales y límites BNA (D-082): dinero exacto en centavos, sin Number/float, y la
// misma lista de pagos que después se mapea. No se calculan totales desde strings.
import { describe, expect, it } from 'vitest';
import {
  MAX_CANTIDAD_R2,
  MAX_IMPORTE_R2,
  MAX_TOTAL_R3,
  calcularTotalesBna,
  validarCantidadBna,
  validarImporteR2,
  validarTotalBna,
} from '../../../../src/banks/bna/totales';
import type { Centavos } from '../../../../src/domain/money';
import { pagoSintetico } from './auxiliares';

describe('límites BNA', () => {
  it('los máximos corresponden a la geometría documentada', () => {
    expect(MAX_IMPORTE_R2).toBe(9_999_999_999n);
    expect(MAX_TOTAL_R3).toBe(999_999_999_999_999n);
    expect(MAX_CANTIDAD_R2).toBe(9_999_999);
  });

  it('validarImporteR2 acepta 0 y el máximo exacto, rechaza negativo y máximo + 1', () => {
    expect(validarImporteR2(0n as Centavos)).toEqual({ ok: true, value: 0n });
    expect(validarImporteR2(MAX_IMPORTE_R2)).toEqual({
      ok: true,
      value: MAX_IMPORTE_R2,
    });
    expect(validarImporteR2(-1n as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'NETO_NEGATIVO' },
    });
    expect(validarImporteR2((MAX_IMPORTE_R2 + 1n) as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'NETO_EXCEDE_LAYOUT' },
    });
  });

  it('validarTotalBna acepta el máximo y rechaza máximo + 1', () => {
    expect(validarTotalBna(MAX_TOTAL_R3).ok).toBe(true);
    expect(validarTotalBna((MAX_TOTAL_R3 + 1n) as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'TOTAL_EXCEDE_LAYOUT' },
    });
  });

  it('validarCantidadBna acepta 0 y el máximo, rechaza exceso y valores inválidos', () => {
    expect(validarCantidadBna(0)).toEqual({ ok: true, value: 0 });
    expect(validarCantidadBna(MAX_CANTIDAD_R2)).toEqual({
      ok: true,
      value: MAX_CANTIDAD_R2,
    });
    expect(validarCantidadBna(MAX_CANTIDAD_R2 + 1)).toEqual({
      ok: false,
      error: { codigo: 'CANTIDAD_EXCEDE_LAYOUT' },
    });
    expect(validarCantidadBna(-1)).toEqual({
      ok: false,
      error: { codigo: 'CANTIDAD_INVALIDA' },
    });
    expect(validarCantidadBna(1.5)).toEqual({
      ok: false,
      error: { codigo: 'CANTIDAD_INVALIDA' },
    });
    expect(validarCantidadBna(Number.NaN)).toEqual({
      ok: false,
      error: { codigo: 'CANTIDAD_INVALIDA' },
    });
  });
});

describe('calcularTotalesBna · suma exacta sobre la misma lista', () => {
  it('rechaza una lista vacía porque no hay registro 2', () => {
    expect(calcularTotalesBna([])).toEqual({
      ok: false,
      error: [{ codigo: 'SIN_PAGOS' }],
    });
  });

  it('suma bigint exacto y cuenta los R2', () => {
    const pagos = [
      pagoSintetico(1, { neto: 1n as Centavos }),
      pagoSintetico(2, { neto: 2n as Centavos }),
      pagoSintetico(3, { neto: 3n as Centavos }),
    ];
    expect(calcularTotalesBna(pagos)).toEqual({
      ok: true,
      value: { totalImporte: 6n, cantidad: 3 },
    });
  });

  it('no usa Number ni redondeo: conserva centavos impares', () => {
    const pagos = [
      pagoSintetico(1, { neto: 1_000_000_001n as Centavos }),
      pagoSintetico(2, { neto: 2n as Centavos }),
    ];
    const resultado = calcularTotalesBna(pagos);
    expect(resultado.ok && resultado.value.totalImporte).toBe(1_000_000_003n);
  });

  it('devuelve todos los errores de importe con su índice', () => {
    const pagos = [
      pagoSintetico(1, { neto: -1n as Centavos }),
      pagoSintetico(2, { neto: 5n as Centavos }),
      pagoSintetico(3, { neto: (MAX_IMPORTE_R2 + 1n) as Centavos }),
    ];
    const resultado = calcularTotalesBna(pagos);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) {
      throw new Error('lista inválida aceptada');
    }
    expect(resultado.error).toEqual([
      { codigo: 'NETO_NEGATIVO', indicePago: 0 },
      { codigo: 'NETO_EXCEDE_LAYOUT', indicePago: 2 },
    ]);
  });

  it('detecta el total que excede 15 dígitos aunque cada importe sea válido', () => {
    const pago = pagoSintetico(1, { neto: MAX_IMPORTE_R2 });
    const pagos = Array.from({ length: 100_001 }, () => pago);
    const resultado = calcularTotalesBna(pagos);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) {
      throw new Error('total excedido aceptado');
    }
    expect(resultado.error.some((error) => error.codigo === 'TOTAL_EXCEDE_LAYOUT')).toBe(true);
  });
});
