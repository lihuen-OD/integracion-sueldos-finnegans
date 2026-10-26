// Pruebas directas del runtime de estructura (T4-8, D-070): gramática determinista sobre
// secuencias de ids, sin backtracking ni heurística. Cubre los casos normativos
// `1 2+ 3`, `0 (1 2+)+` y `secuencia[registro A, repeticion{min:1} A]`, el cierre de
// repeticiones anidadas con contadores 1-based y la defensa `ESTRUCTURA_AMBIGUA`.
import { describe, expect, it } from 'vitest';
import { ejecutarEstructura } from '../../../../src/banks/fixed-width/estructuraRuntime';
import type { EstructuraArchivo } from '../../../../src/banks/fixed-width';
import { nodoRegistro, repeticion, secuencia } from './specsSinteticas';
import { en, estructuraInicial } from './archivoSpecs';

const item = (recordId: string) => ({ recordId });

describe('ejecutarEstructura · casos normativos', () => {
  it('ejecuta `1 2+ 3` con una repetición simple', () => {
    const resultado = ejecutarEstructura(estructuraInicial(), [
      item('H'),
      item('D'),
      item('D'),
      item('C'),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.rutas).toEqual([[], [1], [2], []]);
    }
  });

  it('ejecuta `0 (1 2+)+` y reinicia el contador interior por iteración exterior', () => {
    // Gramática: R0 (R1 R2+)+, sin registro de cierre. Tres iteraciones exteriores;
    // la última tiene dos R2: la ruta esperada es [3, 2].
    const estructura: EstructuraArchivo = secuencia(
      nodoRegistro('R0'),
      repeticion(secuencia(nodoRegistro('R1'), repeticion(nodoRegistro('R2'), 1)), 1),
    );
    const resultado = ejecutarEstructura(estructura, [
      item('R0'),
      item('R1'),
      item('R2'),
      item('R1'),
      item('R2'),
      item('R2'),
      item('R1'),
      item('R2'),
      item('R2'),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.rutas).toEqual([[], [1], [1, 1], [2], [2, 1], [2, 2], [3], [3, 1], [3, 2]]);
    }
  });

  it('ejecuta `secuencia[registro A, repeticion{min:1} A]`', () => {
    const estructura: EstructuraArchivo = secuencia(
      nodoRegistro('A'),
      repeticion(nodoRegistro('A'), 1),
    );
    const resultado = ejecutarEstructura(estructura, [item('A'), item('A'), item('A')]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.rutas).toEqual([[], [1], [2]]);
    }
  });
});

describe('ejecutarEstructura · cierres y errores', () => {
  it('no cierra una repetición antes de cumplir `min`', () => {
    const estructura = secuencia(repeticion(nodoRegistro('A'), 2), nodoRegistro('B'));
    const resultado = ejecutarEstructura(estructura, [item('A'), item('B')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({
        codigo: 'REPETICION_INCOMPLETA',
        registroId: 'B',
        ruta: [],
      });
      expect(resultado.indice).toBe(1);
    }
  });

  it('REPETICION_INCOMPLETA al agotarse los items antes de `min`', () => {
    const estructura = repeticion(nodoRegistro('A'), 2);
    const resultado = ejecutarEstructura(estructura, [item('A')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({ codigo: 'REPETICION_INCOMPLETA', ruta: [] });
      expect(resultado.indice).toBe(1);
    }
  });

  it('REGISTRO_FALTANTE al terminar la secuencia antes de lo exigido', () => {
    const resultado = ejecutarEstructura(estructuraInicial(), [item('H'), item('D')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({
        codigo: 'REGISTRO_FALTANTE',
        registroId: 'C',
        ruta: [],
      });
      expect(resultado.indice).toBe(2);
    }
  });

  it('LINEA_DEMASIADO cuando sobran items tras completar la gramática', () => {
    const resultado = ejecutarEstructura(estructuraInicial(), [
      item('H'),
      item('D'),
      item('C'),
      item('D'),
    ]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({ codigo: 'LINEA_DEMASIADO', registroId: 'D' });
      expect(resultado.indice).toBe(3);
    }
  });

  it('ORDEN_INVALIDO ante un id que no continúa ni cierra la repetición', () => {
    const resultado = ejecutarEstructura(estructuraInicial(), [item('H'), item('H'), item('C')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({
        codigo: 'ORDEN_INVALIDO',
        registroId: 'H',
        ruta: [],
      });
      expect(resultado.indice).toBe(1);
    }
  });

  it('defensa: ESTRUCTURA_AMBIGUA si el id pertenece a la parte y al FOLLOW', () => {
    // La validación estática rechaza esta estructura; el runtime no desempata y defiende.
    const estructura: EstructuraArchivo = secuencia(
      repeticion(nodoRegistro('A'), 1),
      nodoRegistro('A'),
    );
    const resultado = ejecutarEstructura(estructura, [item('A')]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toEqual({ codigo: 'ESTRUCTURA_AMBIGUA' });
      expect(resultado.indice).toBe(0);
    }
  });

  it('expone una ruta vacía para cada item fuera de repetición', () => {
    const resultado = ejecutarEstructura(nodoRegistro('A'), [item('A')]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(en(resultado.rutas, 0)).toEqual([]);
    }
  });
});
