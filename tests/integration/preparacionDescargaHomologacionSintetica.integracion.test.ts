import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { produccionBnaHabilitada } from '../../src/banks/bna';
import { produccionPatagoniaHabilitada } from '../../src/banks/patagonia-b2';
import {
  NOMBRE_ARCHIVO_BNA_SINTETICO,
  NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
  componerBnaHomologacionSintetica,
  componerPatagoniaHomologacionSintetica,
} from '../../src/run/composicionHomologacionSintetica';
import { prepararDescargaHomologacionSintetica } from '../../src/run/preparacionDescargaHomologacionSintetica';

const prepararRuntime = prepararDescargaHomologacionSintetica as (
  ...argumentos: readonly unknown[]
) => ReturnType<typeof prepararDescargaHomologacionSintetica>;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('CP-F8-C · preparación browser-safe de descargas sintéticas', () => {
  it.each([
    [
      'BNA',
      NOMBRE_ARCHIVO_BNA_SINTETICO,
      'b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de',
    ],
    [
      'PATAGONIA',
      NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
      '004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d',
    ],
  ] as const)('prepara %s con nombre, inspección y SHA exactos', async (banco, nombre, hash) => {
    const resultado =
      banco === 'BNA'
        ? await prepararDescargaHomologacionSintetica('BNA', 'VALIDA')
        : await prepararDescargaHomologacionSintetica('PATAGONIA', 'VALIDA');
    expect(resultado.estado).toBe('PREPARADA');
    if (resultado.estado !== 'PREPARADA') return;
    expect(resultado.nombreArchivo).toBe(nombre);
    expect(resultado.cantidadBytes).toBe(803);
    expect(resultado.sha256).toBe(hash);
    expect(sha256(resultado.bytes)).toBe(hash);
    expect(resultado.inspeccion).toMatchObject({ estado: 'OK', cantidadPagos: 2 });
    expect(resultado.inspeccion.cantidadRegistros).toBeGreaterThan(0);
    expect(resultado.productivo).toBe(false);
    expect(resultado.homologado).toBe(false);
  });

  it('conserva identidad byte a byte con el compositor compartido D1-A/D1-B', async () => {
    const [bna, patagonia] = await Promise.all([
      prepararDescargaHomologacionSintetica('BNA', 'VALIDA'),
      prepararDescargaHomologacionSintetica('PATAGONIA', 'VALIDA'),
    ]);
    const composicionBna = componerBnaHomologacionSintetica('VALIDA');
    const composicionPatagonia = componerPatagoniaHomologacionSintetica('VALIDA');
    expect(bna.estado).toBe('PREPARADA');
    expect(patagonia.estado).toBe('PREPARADA');
    expect(composicionBna.estado).toBe('COMPUESTA_EN_MEMORIA');
    expect(composicionPatagonia.estado).toBe('COMPUESTA_EN_MEMORIA');
    if (
      bna.estado !== 'PREPARADA' ||
      patagonia.estado !== 'PREPARADA' ||
      composicionBna.estado !== 'COMPUESTA_EN_MEMORIA' ||
      composicionPatagonia.estado !== 'COMPUESTA_EN_MEMORIA'
    ) {
      return;
    }
    expect(bna.bytes).toEqual(composicionBna.bytes);
    expect(patagonia.bytes).toEqual(composicionPatagonia.bytes);
  });

  it('rechaza bancos, variantes, objetos, aridad extra y datos externos', async () => {
    await expect(prepararRuntime()).resolves.toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'ARGUMENTOS_INVALIDOS',
    });
    await expect(prepararRuntime('OTRO', 'VALIDA')).resolves.toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'BANCO_NO_ADMITIDO',
    });
    await expect(prepararRuntime('PATAGONIA', 'REFERENCIA_DUPLICADA')).resolves.toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'VARIANTE_NO_ADMITIDA',
    });
    await expect(prepararRuntime('BNA', 'VALIDA', 'EXTRA')).resolves.toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'ARGUMENTOS_INVALIDOS',
    });
    await expect(
      prepararRuntime({
        banco: 'BNA',
        variante: 'VALIDA',
        pagos: [],
        cuil: 'externo',
        cbu: 'externo',
        archivo: new Uint8Array([1]),
      }),
    ).resolves.toMatchObject({ estado: 'RECHAZADA', codigo: 'ARGUMENTOS_INVALIDOS' });
  });

  it('mantiene ambas compuertas productivas cerradas', () => {
    expect(produccionBnaHabilitada()).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
