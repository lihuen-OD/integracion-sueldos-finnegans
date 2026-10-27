// Loteo: validación técnica separada de la estrategia. No se crea ningún lote por default;
// la propuesta debe cubrir exactamente los mismos pagos, en orden, sin duplicar ni omitir.
import { describe, expect, it } from 'vitest';
import * as patagonia from '../../../../src/banks/patagonia-b2';
import {
  MAX_CANTIDAD_DETALLE_LOTE,
  MAX_CANTIDAD_LOTES,
  validarLotesPatagonia,
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

describe('loteo Patagonia · validación técnica', () => {
  it('acepta lotes que cubren exactamente los pagos en orden', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1), pagoSintetico(2)];
    const lotes = [loteSintetico('0001', pagos.slice(0, 2)), loteSintetico('0002', pagos.slice(2))];
    expect(validarLotesPatagonia(lotes, pagos)).toEqual({ ok: true, value: lotes });
  });

  it('rechaza lista vacía de pagos o de lotes', () => {
    expect(codigos(validarLotesPatagonia([], []))).toEqual(
      expect.arrayContaining(['SIN_PAGOS', 'SIN_LOTES']),
    );
  });

  it('rechaza números de lote inválidos, 0000 y repetidos', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1)];
    for (const numero of ['', '001', '0000', 'ABCD', '00001']) {
      expect(codigos(validarLotesPatagonia([loteSintetico(numero, pagos)], pagos))).toContain(
        'NUMERO_LOTE_INVALIDO',
      );
    }
    expect(
      codigos(
        validarLotesPatagonia(
          [
            loteSintetico('0001', [requerido(pagos[0])]),
            loteSintetico('0001', [requerido(pagos[1])]),
          ],
          pagos,
        ),
      ),
    ).toContain('NUMERO_LOTE_REPETIDO');
  });

  it('rechaza lotes sin pagos', () => {
    const pagos = [pagoSintetico(0)];
    expect(codigos(validarLotesPatagonia([loteSintetico('0001', [])], pagos))).toEqual(
      expect.arrayContaining(['LOTE_SIN_PAGOS', 'LOTEO_NO_COINCIDE_CON_PAGOS']),
    );
  });

  it('rechaza pagos omitidos, repetidos o fuera de orden', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1)];
    expect(
      codigos(validarLotesPatagonia([loteSintetico('0001', [requerido(pagos[0])])], pagos)),
    ).toContain('LOTEO_NO_COINCIDE_CON_PAGOS');
    expect(
      codigos(
        validarLotesPatagonia(
          [loteSintetico('0001', [requerido(pagos[0]), requerido(pagos[0])])],
          pagos,
        ),
      ),
    ).toContain('LOTEO_NO_COINCIDE_CON_PAGOS');
    expect(
      codigos(
        validarLotesPatagonia(
          [loteSintetico('0001', [requerido(pagos[1]), requerido(pagos[0])])],
          pagos,
        ),
      ),
    ).toContain('LOTEO_NO_COINCIDE_CON_PAGOS');
  });

  it('rechaza objetos copiados aunque tengan los mismos datos', () => {
    const pagos = [pagoSintetico(0)];
    const copia = { ...requerido(pagos[0]) };
    expect(codigos(validarLotesPatagonia([loteSintetico('0001', [copia])], pagos))).toContain(
      'LOTEO_NO_COINCIDE_CON_PAGOS',
    );
  });

  it('acepta 999 detalles y rechaza 1000', () => {
    const pagos = Array.from({ length: MAX_CANTIDAD_DETALLE_LOTE }, (_, i) => pagoSintetico(i));
    expect(validarLotesPatagonia([loteSintetico('0001', pagos)], pagos).ok).toBe(true);

    const excedidos = Array.from({ length: MAX_CANTIDAD_DETALLE_LOTE + 1 }, (_, i) =>
      pagoSintetico(i),
    );
    expect(codigos(validarLotesPatagonia([loteSintetico('0001', excedidos)], excedidos))).toContain(
      'CANTIDAD_LOTE_EXCEDIDA',
    );
  });

  it('los límites se derivan de la geometría', () => {
    expect(MAX_CANTIDAD_DETALLE_LOTE).toBe(999);
    expect(MAX_CANTIDAD_LOTES).toBe(9999);
  });

  it('no hay una estrategia de loteo exportada por default', () => {
    expect('estrategiaLoteoPatagonia' in patagonia).toBe(false);
    expect('ESTRATEGIA_LOTEO_PATAGONIA' in patagonia).toBe(false);
  });
});
