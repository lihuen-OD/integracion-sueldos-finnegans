// Proyección presentacional (correctivo UX CP-F3-B): el dominio conserva una incidencia
// por fila (P-29.9); acá se prueba que el agrupado no pierde nada, separa resueltas y
// genera una clave determinista. Datos sintéticos construidos en runtime.
import { describe, expect, it } from 'vitest';
import type { IncidenciaConciliada } from '../../../src/reconciliation';
import type { CodigoIncidencia, NivelIncidencia } from '../../../src/domain/incidencias';
import {
  claveDeGrupoPresentacional,
  proyectarIncidencias,
  textoIncidencia,
} from '../../../src/ui/proyeccion';

function incidencia(
  id: string,
  codigo: CodigoIncidencia,
  nivel: NivelIncidencia,
  opciones: Partial<IncidenciaConciliada> = {},
): IncidenciaConciliada {
  return {
    id,
    codigo,
    nivel,
    alcance: 'GLOBAL',
    refs: [],
    detalle: '',
    valores: { finnegans: 'JULIO Agrario' },
    ...opciones,
  };
}

describe('proyectarIncidencias (proyección presentacional)', () => {
  it('agrupa los casos repetidos conservando la cantidad exacta del motor', () => {
    const repetida = () => incidencia('i-1', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE');
    const proyeccion = proyectarIncidencias([repetida(), repetida(), repetida()]);
    expect(proyeccion.bloqueosAgrupados).toHaveLength(1);
    const grupo = proyeccion.bloqueosAgrupados[0];
    if (grupo === undefined) {
      throw new Error('falta el grupo esperado');
    }
    expect(grupo.cantidad).toBe(3);
    expect(grupo.incidencias).toHaveLength(3);
    expect(proyeccion.accionables).toHaveLength(0);
    expect(proyeccion.resueltas).toHaveLength(0);
    expect(proyeccion.restantes).toHaveLength(3);
  });

  it('separa por valores observados: tipos de liquidación distintos no comparten grupo', () => {
    const proyeccion = proyectarIncidencias([
      incidencia('i-1', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE'),
      incidencia('i-2', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE', {
        valores: { finnegans: 'JULIO Comercio ' },
      }),
    ]);
    expect(proyeccion.bloqueosAgrupados).toHaveLength(2);
  });

  it('separa lo accionable, lo resuelto y lo informativo sin mezclar niveles', () => {
    const proyeccion = proyectarIncidencias([
      incidencia('i-1', 'BANCO_VACIO', 'REQUIERE_REVISION', {
        resoluble: {
          por: 'ASIGNAR_DESTINO',
          observado: { cuilTexto: 'x', valores: {}, huellas: {} },
        },
      }),
      incidencia('i-2', 'NETO_CERO', 'INFORMACION'),
      incidencia('i-3', 'LEGAJO_NO_COINCIDE', 'REQUIERE_REVISION', {
        resoluble: {
          por: 'CONFIRMAR_REVISION',
          observado: { cuilTexto: 'x', valores: {}, huellas: {} },
        },
        resolucion: {
          decisionId: 'd-1',
          tipo: 'CONFIRMAR_REVISION',
          momento: '2026-10-21T10:00:00Z',
        },
      }),
    ]);
    expect(proyeccion.accionables.map((i) => i.id)).toEqual(['i-1']);
    expect(proyeccion.resueltas.map((i) => i.id)).toEqual(['i-3']);
    expect(proyeccion.informacionAgrupada.map((g) => g.codigo)).toEqual(['NETO_CERO']);
    expect(proyeccion.bloqueosAgrupados).toHaveLength(0);
  });

  it('la clave de agrupación es determinista y sensible a valores y resolución', () => {
    const base = incidencia('i-1', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE');
    const misma = incidencia('i-2', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE');
    const otroValor = incidencia('i-3', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE', {
      valores: { finnegans: 'JULIO Liq Final' },
    });
    const resuelta = incidencia('i-4', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE', {
      resolucion: {
        decisionId: 'd-9',
        tipo: 'CONFIRMAR_REVISION',
        momento: '2026-10-21T10:00:00Z',
      },
    });
    expect(claveDeGrupoPresentacional(base)).toBe(claveDeGrupoPresentacional(misma));
    expect(claveDeGrupoPresentacional(base)).not.toBe(claveDeGrupoPresentacional(otroValor));
    expect(claveDeGrupoPresentacional(base)).not.toBe(claveDeGrupoPresentacional(resuelta));
  });

  it('textoIncidencia usa el detalle del motor o la descripción del código, una sola frase', () => {
    expect(textoIncidencia(incidencia('i-1', 'LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE'))).toBe(
      'Tipo de liquidación sin mapeo aprobado al código bancario.',
    );
    expect(textoIncidencia(incidencia('i-2', 'NETO_CERO', 'INFORMACION', { detalle: 'X' }))).toBe(
      'X',
    );
  });
});
