import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINOS } from '../../../src/domain/destino';
import {
  aIncidencia,
  claveRef,
  CODIGOS_INCIDENCIA,
  compararNiveles,
  DESCRIPCION_CODIGO,
  idIncidencia,
  nivelMasGrave,
  type Hallazgo,
  type NivelVisible,
  type SourceRef,
} from '../../../src/domain/incidencias';

const fila = (n: number, columna?: string): SourceRef => ({
  archivo: 'FINNEGANS',
  hoja: 'hoja1',
  fila: n,
  ...(columna === undefined ? {} : { columna }),
});

describe('niveles (D-019)', () => {
  it('ordena CORRECTO < INFORMACION < REQUIERE_REVISION < BLOQUEANTE', () => {
    const orden: NivelVisible[] = ['CORRECTO', 'INFORMACION', 'REQUIERE_REVISION', 'BLOQUEANTE'];
    for (let i = 0; i + 1 < orden.length; i += 1) {
      const [menor, mayor] = [orden[i] ?? 'CORRECTO', orden[i + 1] ?? 'CORRECTO'];
      expect(compararNiveles(menor, mayor)).toBeLessThan(0);
      expect(compararNiveles(mayor, menor)).toBeGreaterThan(0);
      expect(compararNiveles(menor, menor)).toBe(0);
    }
  });

  it('el nivel visible es el más grave, o CORRECTO si no hay incidencias', () => {
    expect(nivelMasGrave([])).toBe('CORRECTO');
    expect(nivelMasGrave(['INFORMACION'])).toBe('INFORMACION');
    expect(nivelMasGrave(['INFORMACION', 'BLOQUEANTE', 'REQUIERE_REVISION'])).toBe('BLOQUEANTE');
    expect(nivelMasGrave(['REQUIERE_REVISION', 'INFORMACION'])).toBe('REQUIERE_REVISION');
  });
});

describe('códigos de incidencia', () => {
  it('cada código tiene una descripción para el operador', () => {
    for (const codigo of CODIGOS_INCIDENCIA) {
      expect(DESCRIPCION_CODIGO[codigo].length).toBeGreaterThan(10);
    }
  });

  it('coinciden con el contrato documentado en docs/03 §H', () => {
    const docs = readFileSync('docs/03_DATOS_Y_MAESTRO.md', 'utf8');
    // Las líneas `| '...'` que siguen a la declaración del tipo en el bloque de §H.
    const bloque = /type CodigoIncidencia =.*\n((?:\s+\|.*\n)+)/.exec(docs)?.[1] ?? '';
    const documentados = [...bloque.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect([...CODIGOS_INCIDENCIA].sort()).toEqual(documentados.sort());
  });

  it('no incluye los controles diferidos (D-047)', () => {
    for (const diferido of [
      'NETO_EXCEDE_LAYOUT',
      'NOMBRE_TRANSFORMADO',
      'NOMBRE_CARACTER_NO_SOPORTADO',
      'DOCUMENTO_NO_COINCIDE_CUIL',
    ]) {
      expect(CODIGOS_INCIDENCIA).not.toContain(diferido);
    }
  });
});

describe('referencias e identificadores', () => {
  it('claveRef identifica archivo, hoja, fila y columna', () => {
    expect(claveRef(fila(7, 'A'))).toBe('FINNEGANS:hoja1:7:A');
    expect(claveRef({ archivo: 'MAESTRO' })).toBe('MAESTRO:::');
  });

  it('idIncidencia es determinista y distingue código, alcance, refs y campo', () => {
    const base = idIncidencia('LEGAJO_NO_COINCIDE', 'BNA_GT_HABERES', [fila(2)], 'Legajo');
    expect(idIncidencia('LEGAJO_NO_COINCIDE', 'BNA_GT_HABERES', [fila(2)], 'Legajo')).toBe(base);
    expect(
      new Set([
        base,
        idIncidencia('LEGAJO_NO_COINCIDE', 'PATAGONIA_B2', [fila(2)], 'Legajo'),
        idIncidencia('LEGAJO_NO_COINCIDE', 'BNA_GT_HABERES', [fila(3)], 'Legajo'),
        idIncidencia('LEGAJO_NO_COINCIDE', 'BNA_GT_HABERES', [fila(2)]),
        idIncidencia('SIN_MAESTRO', 'BNA_GT_HABERES', [fila(2)], 'Legajo'),
      ]).size,
    ).toBe(5);
  });
});

describe('aIncidencia', () => {
  const hallazgo: Hallazgo = {
    codigo: 'CBU_INVALIDO',
    nivel: 'BLOQUEANTE',
    objetivo: 'REGISTRO',
    refs: [{ archivo: 'MAESTRO', hoja: 'Empleados', fila: 4, columna: 'D' }],
    campo: 'CBU',
    motivo: 'DV_BLOQUE_2_INVALIDO',
    detalle: DESCRIPCION_CODIGO.CBU_INVALIDO,
  };

  it('conserva los datos del hallazgo y agrega alcance e id', () => {
    for (const destino of DESTINOS) {
      const incidencia = aIncidencia(hallazgo, destino);
      expect(incidencia).toEqual({
        id: idIncidencia('CBU_INVALIDO', destino, hallazgo.refs, 'CBU'),
        codigo: 'CBU_INVALIDO',
        nivel: 'BLOQUEANTE',
        alcance: destino,
        refs: hallazgo.refs,
        campo: 'CBU',
        motivo: 'DV_BLOQUE_2_INVALIDO',
        detalle: hallazgo.detalle,
      });
    }
  });

  it('permite ajustar el nivel (p. ej. campo del otro destino → INFORMACION, D-048)', () => {
    expect(aIncidencia(hallazgo, 'BNA_GT_HABERES', 'INFORMACION').nivel).toBe('INFORMACION');
  });

  it('no agrega propiedades opcionales ausentes y conserva los valores observados', () => {
    const minimo = aIncidencia(
      {
        codigo: 'LEGAJO_NO_COINCIDE',
        nivel: 'REQUIERE_REVISION',
        objetivo: 'FILA',
        refs: [fila(2)],
        valores: { finnegans: '007', maestro: '7' },
        detalle: DESCRIPCION_CODIGO.LEGAJO_NO_COINCIDE,
      },
      'GLOBAL',
    );
    expect(Object.keys(minimo).sort()).toEqual(
      ['alcance', 'codigo', 'detalle', 'id', 'nivel', 'refs', 'valores'].sort(),
    );
    expect(minimo.valores).toEqual({ finnegans: '007', maestro: '7' });
  });
});
