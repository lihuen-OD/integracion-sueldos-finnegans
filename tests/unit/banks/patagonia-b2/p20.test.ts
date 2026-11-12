// CP-F7-C2.4-A2.5 · P-20: estrategia única de lotes Patagonia. Lotes consecutivos de hasta
// 999 pagos, en el orden original, numerados desde `0001` a cuatro posiciones. Datos 100 %
// sintéticos; no se serializan bytes ni se toca ninguna compuerta productiva.
import { describe, expect, it } from 'vitest';
import {
  MAX_CANTIDAD_DETALLE_LOTE,
  MAX_CANTIDAD_LOTES,
  MAX_PAGOS_PATAGONIA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  estrategiaLotesPatagonia,
  mapearPatagonia,
  produccionPatagoniaHabilitada,
  resuelto,
  type LotePropuestoPatagonia,
  type PagoPatagonia,
} from '../../../../src/banks/patagonia-b2';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function pagos(cantidad: number): PagoPatagonia[] {
  return Array.from({ length: cantidad }, (_, indice) => pagoSintetico(indice));
}

function lotesDe(resultado: ReturnType<typeof estrategiaLotesPatagonia>): LotePropuestoPatagonia[] {
  if (!resultado.ok) {
    throw new Error(`loteo inesperado: ${resultado.error.map((error) => error.codigo).join(',')}`);
  }
  return [...resultado.value];
}

function cantidades(lotes: readonly LotePropuestoPatagonia[]): number[] {
  return lotes.map((lote) => lote.pagos.length);
}

function numeros(lotes: readonly LotePropuestoPatagonia[]): string[] {
  return lotes.map((lote) => lote.numeroLote);
}

describe('P-20 · estrategia de lotes Patagonia', () => {
  it('los límites se derivan de la geometría de la spec', () => {
    expect(MAX_CANTIDAD_DETALLE_LOTE).toBe(999);
    expect(MAX_CANTIDAD_LOTES).toBe(9999);
    expect(MAX_PAGOS_PATAGONIA).toBe(999 * 9999);
    expect(MAX_PAGOS_PATAGONIA).toBe(9_989_001);
  });

  it('0 pagos devuelve error tipado y no genera lotes', () => {
    const resultado = estrategiaLotesPatagonia([]);
    expect(resultado).toEqual({ ok: false, error: [{ codigo: 'SIN_PAGOS' }] });
    expect('value' in resultado).toBe(false);
  });

  it('1 pago genera un único lote 0001', () => {
    const entrada = pagos(1);
    const lotes = lotesDe(estrategiaLotesPatagonia(entrada));
    expect(numeros(lotes)).toEqual(['0001']);
    expect(cantidades(lotes)).toEqual([1]);
    expect(lotes[0]?.pagos[0]).toBe(entrada[0]);
  });

  it('999 pagos generan un único lote completo', () => {
    const lotes = lotesDe(estrategiaLotesPatagonia(pagos(999)));
    expect(numeros(lotes)).toEqual(['0001']);
    expect(cantidades(lotes)).toEqual([999]);
  });

  it('1.000 pagos generan dos lotes: 999 + 1', () => {
    const lotes = lotesDe(estrategiaLotesPatagonia(pagos(1000)));
    expect(numeros(lotes)).toEqual(['0001', '0002']);
    expect(cantidades(lotes)).toEqual([999, 1]);
  });

  it('1.998 pagos generan dos lotes completos', () => {
    const lotes = lotesDe(estrategiaLotesPatagonia(pagos(1998)));
    expect(numeros(lotes)).toEqual(['0001', '0002']);
    expect(cantidades(lotes)).toEqual([999, 999]);
  });

  it('1.999 pagos generan tres lotes: 999 + 999 + 1', () => {
    const lotes = lotesDe(estrategiaLotesPatagonia(pagos(1999)));
    expect(numeros(lotes)).toEqual(['0001', '0002', '0003']);
    expect(cantidades(lotes)).toEqual([999, 999, 1]);
  });

  it('la capacidad máxima representable usa 9.999 lotes completos', () => {
    const pago = pagoSintetico(0);
    const entrada = new Array<PagoPatagonia>(MAX_PAGOS_PATAGONIA).fill(pago);
    const lotes = lotesDe(estrategiaLotesPatagonia(entrada));

    expect(lotes).toHaveLength(MAX_CANTIDAD_LOTES);
    expect(lotes.every((lote) => lote.pagos.length === MAX_CANTIDAD_DETALLE_LOTE)).toBe(true);
    expect(lotes[0]?.numeroLote).toBe('0001');
    expect(lotes.at(-1)?.numeroLote).toBe(String(MAX_CANTIDAD_LOTES).padStart(4, '0'));
    expect(lotes.reduce((total, lote) => total + lote.pagos.length, 0)).toBe(MAX_PAGOS_PATAGONIA);
  });

  it('un pago por encima de la capacidad se rechaza con error tipado', () => {
    const pago = pagoSintetico(0);
    const entrada = new Array<PagoPatagonia>(MAX_PAGOS_PATAGONIA + 1).fill(pago);
    expect(estrategiaLotesPatagonia(entrada)).toEqual({
      ok: false,
      error: [{ codigo: 'CANTIDAD_LOTES_EXCEDIDA' }],
    });
  });

  it('conserva el orden, la identidad y las referencias de todos los pagos', () => {
    const entrada = pagos(1999);
    const lotes = lotesDe(estrategiaLotesPatagonia(entrada));
    const aplanados = lotes.flatMap((lote) => lote.pagos);

    expect(aplanados).toHaveLength(entrada.length);
    expect(aplanados.every((pago, indice) => pago === entrada[indice])).toBe(true);
    expect(aplanados.map((pago) => pago.ref)).toEqual(entrada.map((pago) => pago.ref));
  });

  it('no duplica ni omite pagos', () => {
    const entrada = pagos(1999);
    const lotes = lotesDe(estrategiaLotesPatagonia(entrada));
    const aplanados = lotes.flatMap((lote) => lote.pagos);

    const refsEntrada = entrada.map((pago) => [pago.ref.hoja, pago.ref.fila].join(':'));
    const refsLotes = aplanados.map((pago) => [pago.ref.hoja, pago.ref.fila].join(':'));
    expect(new Set(refsLotes).size).toBe(entrada.length);
    expect(refsLotes).toEqual(refsEntrada);
  });

  it('preserva la secuencia recibida aunque dos pagos compartan referencia; no deduplica', () => {
    const primero = pagoSintetico(0);
    const segundo = { ...pagoSintetico(0) };
    const entrada = [primero, segundo];
    const lotes = lotesDe(estrategiaLotesPatagonia(entrada));
    const aplanados = lotes.flatMap((lote) => lote.pagos);

    expect(aplanados).toHaveLength(2);
    expect(aplanados[0]).toBe(primero);
    expect(aplanados[1]).toBe(segundo);
    expect(aplanados[0]?.ref).toEqual(aplanados[1]?.ref);
    // La unicidad de referencias es una garantía de A0, no de esta estrategia.
  });

  it('los totales y cantidades de R0, R1 y R2 coinciden', () => {
    const entrada = pagos(1000);
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      entrada,
      politicaSintetica({
        loteo: (lista) => {
          const lotes = estrategiaLotesPatagonia(lista);
          if (!lotes.ok) {
            throw new Error(
              `loteo inesperado: ${lotes.error.map((error) => error.codigo).join(',')}`,
            );
          }
          return resuelto(lotes.value);
        },
      }),
    );
    if (!resultado.ok) {
      throw new Error(
        `mapeo inesperado: ${resultado.error.map((error) => error.codigo).join(',')}`,
      );
    }

    const { entradas, totales } = resultado.value;
    const r0 = entradas.filter((registro) => registro.recordId === 'PAT_R0');
    const r1 = entradas.filter((registro) => registro.recordId === 'PAT_R1');
    const r2 = entradas.filter((registro) => registro.recordId === 'PAT_R2');

    expect(totales.cantidadPagos).toBe(1000);
    expect(totales.cantidadLotes).toBe(2);
    expect(r0).toHaveLength(1);
    expect(r0[0]?.valores['r0_cantidadLotes']).toBe('2');
    expect(r1).toHaveLength(2);
    expect(r1.map((registro) => registro.valores['r1_numeroLote'])).toEqual(['0001', '0002']);
    expect(r1.map((registro) => registro.valores['r1_cantidadLote'])).toEqual(['999', '1']);
    expect(
      r1.reduce((total, registro) => total + Number(registro.valores['r1_cantidadLote']), 0),
    ).toBe(1000);
    expect(r2).toHaveLength(1000);
    expect(r2.filter((registro) => registro.valores['r2_numeroLote'] === '0001')).toHaveLength(999);
    expect(r2.filter((registro) => registro.valores['r2_numeroLote'] === '0002')).toHaveLength(1);
  });

  it('la política productiva usa exclusivamente la estrategia aprobada', () => {
    const entrada = pagos(1999);
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo(entrada)).toEqual({
      estado: 'RESUELTO',
      valor: lotesDe(estrategiaLotesPatagonia(entrada)),
    });
  });

  it('la producción sigue bloqueada', () => {
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
