// Totales: solo bigint, límites derivados del layout y cálculo sobre exactamente los
// mismos pagos/lotes que consume el mapper.
import { describe, expect, it } from 'vitest';
import type { Centavos } from '../../../../src/domain/money';
import {
  MAX_IMPORTE_DETALLE_PATAGONIA,
  MAX_IMPORTE_LOTE_PATAGONIA,
  MAX_IMPORTE_TOTAL_PATAGONIA,
  calcularTotalesPatagonia,
  validarImporteLotePatagonia,
  validarImporteNetoPatagonia,
  validarTotalPatagonia,
} from '../../../../src/banks/patagonia-b2';
import { loteSintetico, pagoSintetico } from './auxiliares';

function codigos(resultado: { ok: boolean; error?: readonly { codigo: string }[] }): string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function requerido<T>(valor: T | undefined): T {
  if (valor === undefined) {
    throw new Error('valor requerido ausente');
  }
  return valor;
}

describe('totales Patagonia · límites de layout', () => {
  it('deriva los máximos de la geometría', () => {
    expect(MAX_IMPORTE_DETALLE_PATAGONIA).toBe(99_999_999_999n);
    expect(MAX_IMPORTE_LOTE_PATAGONIA).toBe(999_999_999_999_999n);
    expect(MAX_IMPORTE_TOTAL_PATAGONIA).toBe(999_999_999_999_999n);
  });

  it('exige neto > 0 y hasta el máximo del registro 2', () => {
    expect(validarImporteNetoPatagonia(0n as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'NETO_NO_POSITIVO' },
    });
    expect(validarImporteNetoPatagonia(-1n as Centavos).ok).toBe(false);
    expect(validarImporteNetoPatagonia(MAX_IMPORTE_DETALLE_PATAGONIA).ok).toBe(true);
    expect(validarImporteNetoPatagonia((MAX_IMPORTE_DETALLE_PATAGONIA + 1n) as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'NETO_EXCEDE_LAYOUT' },
    });
  });

  it('valida importe de lote y total sin floats', () => {
    expect(validarImporteLotePatagonia(1n as Centavos).ok).toBe(true);
    expect(validarImporteLotePatagonia(0n as Centavos).ok).toBe(false);
    expect(validarImporteLotePatagonia((MAX_IMPORTE_LOTE_PATAGONIA + 1n) as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'LOTE_EXCEDE_LAYOUT' },
    });
    expect(validarTotalPatagonia(1n as Centavos).ok).toBe(true);
    expect(validarTotalPatagonia(0n as Centavos).ok).toBe(false);
    expect(validarTotalPatagonia((MAX_IMPORTE_TOTAL_PATAGONIA + 1n) as Centavos)).toEqual({
      ok: false,
      error: { codigo: 'TOTAL_EXCEDE_LAYOUT' },
    });
  });
});

describe('totales Patagonia · cálculo exacto', () => {
  it('suma por lote y total sobre la misma lista', () => {
    const pagos = [
      pagoSintetico(0, { neto: 100_000n as Centavos }),
      pagoSintetico(1, { neto: 23_456n as Centavos }),
    ];
    const lotes = [loteSintetico('0001', pagos)];
    const resultado = calcularTotalesPatagonia(pagos, lotes);
    expect(resultado).toEqual({
      ok: true,
      value: {
        totalImporte: 123_456n,
        cantidadPagos: 2,
        cantidadLotes: 1,
        importesPorLote: [123_456n],
      },
    });
    if (resultado.ok) {
      expect(typeof resultado.value.totalImporte).toBe('bigint');
      expect(typeof resultado.value.importesPorLote[0]).toBe('bigint');
    }
  });

  it('mantiene la alineación de importes con lotes múltiples', () => {
    const pagos = [
      pagoSintetico(0, { neto: 10n as Centavos }),
      pagoSintetico(1, { neto: 20n as Centavos }),
      pagoSintetico(2, { neto: 30n as Centavos }),
    ];
    const lotes = [
      loteSintetico('0001', [requerido(pagos[0])]),
      loteSintetico('0002', [requerido(pagos[1]), requerido(pagos[2])]),
    ];
    const resultado = calcularTotalesPatagonia(pagos, lotes);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.importesPorLote).toEqual([10n, 50n]);
      expect(resultado.value.totalImporte).toBe(60n);
      expect(resultado.value.cantidadLotes).toBe(2);
      expect(resultado.value.cantidadPagos).toBe(3);
    }
  });

  it('rechaza netos no positivos sin sumarlos', () => {
    const pagos = [pagoSintetico(0, { neto: 0n as Centavos })];
    const resultado = calcularTotalesPatagonia(pagos, [loteSintetico('0001', pagos)]);
    expect(codigos(resultado)).toContain('NETO_NO_POSITIVO');
  });

  it('rechaza un loteo que no coincide con los pagos', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1)];
    const resultado = calcularTotalesPatagonia(pagos, [
      loteSintetico('0001', [requerido(pagos[0])]),
    ]);
    expect(codigos(resultado)).toContain('LOTEO_NO_COINCIDE_CON_PAGOS');
  });

  it('detecta el desborde del total del envío con la lista real', () => {
    const pagos: ReturnType<typeof pagoSintetico>[] = [];
    const lotes = Array.from({ length: 11 }, (_, lote) => {
      const delLote = Array.from({ length: 999 }, (_, indice) =>
        pagoSintetico(lote * 999 + indice, {
          neto: MAX_IMPORTE_DETALLE_PATAGONIA,
        }),
      );
      pagos.push(...delLote);
      return loteSintetico(String(lote + 1).padStart(4, '0'), delLote);
    });
    const resultado = calcularTotalesPatagonia(pagos, lotes);
    expect(codigos(resultado)).toContain('TOTAL_EXCEDE_LAYOUT');
  });
});
