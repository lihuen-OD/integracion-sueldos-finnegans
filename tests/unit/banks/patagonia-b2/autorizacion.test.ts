// Compuerta de autorización productiva Patagonia (CP-F7-C2.0). La producción
// está cerrada por construcción: no hay estado aprobado ni evidencia que la abra.
import { describe, expect, it } from 'vitest';
import { produccionPatagoniaHabilitada } from '../../../../src/banks/patagonia-b2';

describe('autorización productiva Patagonia B.2', () => {
  it('la compuerta no habilita producción', () => {
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });

  it('no se abre con argumentos extra ni con un estado aprobado falsificado', () => {
    expect(
      Reflect.apply(produccionPatagoniaHabilitada, undefined, [
        { generadorHabilitado: true, bloqueos: [] },
        { estado: 'HOMOLOGACION_APROBADA', evidencia: 'HOM-PAT-2026-001' },
      ]),
    ).toBe(false);
  });
});
