// CP-F7-C2.4-A2.4: PAT-4 resuelto por decisión técnica interna. Con tipo distinto de 004
// la provincia es `00`; con tipo 004 se conserva exclusivamente el dato válido del maestro
// y un valor inválido bloquea sin sustituirse por `00`. Datos 100 % sintéticos.
import { describe, expect, it } from 'vitest';
import {
  POLITICA_PATAGONIA_PRODUCTIVA,
  mapearPatagonia,
  serializarPatagonia,
} from '../../../../src/banks/patagonia-b2';
import type { CodigoProvincia } from '../../../../src/domain/maestro';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function politicaConProvinciaAprobada() {
  return politicaSintetica({
    provinciaNoAplica: POLITICA_PATAGONIA_PRODUCTIVA.provinciaNoAplica,
  });
}

function r2(resultado: ReturnType<typeof mapearPatagonia>) {
  if (!resultado.ok) {
    throw new Error(`mapeo inesperado: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value.entradas.find((entrada) => entrada.recordId === 'PAT_R2');
}

describe('PAT-4 · provincia del documento', () => {
  it('la política productiva resuelve 00 y solo deja abierto PAT-7/P-09/P-10', () => {
    const pago = pagoSintetico(0);
    expect(POLITICA_PATAGONIA_PRODUCTIVA.provinciaNoAplica(pago)).toEqual({
      estado: 'RESUELTO',
      valor: '00',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.tipoLiquidacion(pago).estado).toBe('SIN_RESOLUCION');
    expect(POLITICA_PATAGONIA_PRODUCTIVA.nombre(pago).estado).toBe('RESUELTO');
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo([pago]).estado).toBe('RESUELTO');
  });

  it('documento 001 sin provincia aplicable completa 00', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '001', provinciaDocumento: null })],
      politicaConProvinciaAprobada(),
    );
    expect(r2(resultado)?.valores['r2_provinciaDocumento']).toBe('00');
  });

  it('documento 004 conserva la provincia válida del maestro y no llama a la política', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '004', provinciaDocumento: '02' })],
      politicaSintetica({
        provinciaNoAplica: () => {
          throw new Error('no debe usarse la política con tipo 004');
        },
      }),
    );
    expect(r2(resultado)?.valores['r2_provinciaDocumento']).toBe('02');
  });

  it('documento 004 con provincia inválida bloquea sin sustituirla por 00', () => {
    const provinciasInvalidas = ['99', '0', 'A1'] as unknown as readonly CodigoProvincia[];
    for (const provinciaDocumento of provinciasInvalidas) {
      const resultado = mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { tipoDocumento: '004', provinciaDocumento })],
        politicaSintetica({
          provinciaNoAplica: () => {
            throw new Error('no debe usarse la política para reemplazar un dato inválido');
          },
        }),
      );
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error).toEqual([
          expect.objectContaining({
            codigo: 'PROVINCIA_INVALIDA',
            campoId: 'r2_provinciaDocumento',
            indicePago: 0,
          }),
        ]);
      }
    }
  });

  it('documento 004 sin provincia bloquea y no usa 00', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '004', provinciaDocumento: null })],
      politicaSintetica({
        provinciaNoAplica: () => {
          throw new Error('no debe usarse la política con tipo 004');
        },
      }),
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual([
        expect.objectContaining({
          codigo: 'PROVINCIA_INVALIDA',
          campoId: 'r2_provinciaDocumento',
        }),
      ]);
    }
  });

  it('un tipo distinto de 004 con provincia informada bloquea en vez de reemplazarla', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '001', provinciaDocumento: '02' })],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual([
        expect.objectContaining({
          codigo: 'PROVINCIA_NO_CORRESPONDE',
          campoId: 'r2_provinciaDocumento',
        }),
      ]);
    }
  });

  it('serializa 00 en las posiciones 83–84 sin alterar el resto del registro', () => {
    const resultado = serializarPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '001', provinciaDocumento: null })],
      politicaConProvinciaAprobada(),
    );
    if (!resultado.ok) {
      throw new Error(`serialización inesperada: ${JSON.stringify(resultado.error)}`);
    }
    const registros = Buffer.from(resultado.value.bytes).toString('latin1').split('\n');
    expect(registros[2]?.slice(82, 84)).toBe('00');
    expect(registros[2]?.slice(0, 82)).toHaveLength(82);
    expect(registros[2]?.slice(84)).toHaveLength(116);
  });
});
