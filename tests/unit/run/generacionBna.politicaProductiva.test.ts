// Profundidad de la fachada productiva: aun cuando la aptitud contractual se sustituya
// SOLO en este test con Vitest, la fachada sigue usando `POLITICA_BNA_PRODUCTIVA`, que no
// resuelve BNA-1/BNA-2/BNA-6/P-09/P-10/BNA-11. No existe ninguna opción pública para
// inyectar política ni aptitud: el mock es un mecanismo exclusivo de `tests/**`.
import { describe, expect, it, vi } from 'vitest';
import { evaluarGeneracionBna, generarBna } from '../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';

vi.mock('../../../src/banks/bna', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/banks/bna')>();
  const aptitud: import('../../../src/banks/bna').AptitudBna = {
    bloqueos: [],
    interpretacionesByte: [],
    interpretacionesSinBytes: [],
    generadorHabilitado: true,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
  return { ...actual, aptitudBna: () => aptitud };
});

describe('la fachada productiva no se habilita sustituyendo la aptitud en tests', () => {
  it('quitar BNA-1 en el mock no resuelve la política productiva', () => {
    const entrada = {
      perfil: perfilV2Golden(),
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    };
    const resultado = generarBna(entrada);
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(resultado.puntos).toEqual(['BNA-6', 'BNA-11/P-17', 'BNA-1', 'BNA-2', 'P-09/P-10']);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('la evaluación tampoco llega a LISTO_TECNICAMENTE con la política productiva', () => {
    const evaluacion = evaluarGeneracionBna({
      perfil: perfilV2Golden(),
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    });
    expect(evaluacion.estado).toBe('MAPEO_NO_RESUELTO');
  });
});
