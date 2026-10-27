// Fuerza un fallo del motor F4 para comprobar que la serialización no devuelve bytes
// parciales. El mock vive SOLO bajo tests/** y no modifica la API pública.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/banks/fixed-width', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/banks/fixed-width')>();
  return {
    ...actual,
    serializarArchivo: () => ({ ok: false as const, error: [{ codigo: 'SPEC_INVALIDA' }] }),
  };
});

import { serializarPatagonia } from '../../../../src/banks/patagonia-b2';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

describe('serialización Patagonia B.2 con fallo técnico de F4', () => {
  it('devuelve ERROR_SERIALIZACION sin bytes ni totales', () => {
    const resultado = serializarPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(false);
    expect('value' in resultado).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual([
        { codigo: 'ERROR_SERIALIZACION', errores: [{ codigo: 'SPEC_INVALIDA' }] },
      ]);
    }
  });
});
