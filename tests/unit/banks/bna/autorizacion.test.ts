// Compuerta de autorización productiva BNA GT Haberes. La producción está cerrada por
// construcción: no hay estado aprobado, evidencia ni flag que la abra. Se prueba con
// argumentos falsificados para demostrar que ningún valor de entrada la habilita.
import { describe, expect, it } from 'vitest';
import { produccionBnaHabilitada } from '../../../../src/banks/bna';

describe('autorización productiva BNA GT Haberes', () => {
  it('la compuerta no habilita producción', () => {
    expect(produccionBnaHabilitada()).toBe(false);
  });

  it('no se abre con argumentos extra ni con un estado aprobado falsificado', () => {
    expect(
      Reflect.apply(produccionBnaHabilitada, undefined, [
        { generadorHabilitado: true, bloqueos: [] },
        { estado: 'HOMOLOGACION_APROBADA', evidencia: 'HOM-BNA-2026-001' },
        true,
      ]),
    ).toBe(false);
  });

  it('no depende de variables de entorno', () => {
    const variable = 'BNA_PRODUCCION_HABILITADA';
    const anterior = process.env[variable];
    process.env[variable] = 'true';
    try {
      expect(produccionBnaHabilitada()).toBe(false);
    } finally {
      if (anterior === undefined) {
        Reflect.deleteProperty(process.env, variable);
      } else {
        process.env[variable] = anterior;
      }
    }
  });
});
