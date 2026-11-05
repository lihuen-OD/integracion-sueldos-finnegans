// BNA-B2: la evaluación técnica solo consume el identificador que fue usado por la
// conciliación exacta. La aptitud contractual se habilita únicamente en este test para
// observar P-09/P-10; las demás resoluciones y la compuerta productiva son las reales.
import { describe, expect, it, vi } from 'vitest';
import type { AptitudBna } from '../../../src/banks/bna';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import type { SnapshotSeleccionIdentificadorHaberesBna } from '../../../src/run/seleccionIdentificadorHaberesBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';
import {
  evidenciaSeleccionBnaSintetica,
  type EvidenciaSeleccionBnaSintetica,
} from '../../fixtures/synthetic/seleccionBna';

vi.mock('../../../src/banks/bna', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/banks/bna')>();
  const habilitada: AptitudBna = {
    bloqueos: [],
    interpretacionesByte: [],
    interpretacionesSinBytes: [],
    generadorHabilitado: true,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
  return { ...actual, aptitudBna: () => habilitada };
});

const { POLITICA_BNA_PRODUCTIVA, produccionBnaHabilitada } = await import('../../../src/banks/bna');
const { evaluarGeneracionBna, generarBna, pagosBnaDesdeConciliacion } =
  await import('../../../src/run/generacionBna');

function entrada(
  conciliacion: ResultadoConciliacion,
  evidencia?: Pick<
    EvidenciaSeleccionBnaSintetica,
    'seleccionIdentificadorHaberesBna' | 'huellaFinnegans'
  >,
) {
  const base = {
    perfil: perfilV2Golden(),
    conciliacion,
    parametros: parametrosGoldenBna(),
  };
  return evidencia === undefined
    ? base
    : {
        ...base,
        seleccionIdentificadorHaberesBna: evidencia.seleccionIdentificadorHaberesBna,
        huellaFinnegans: evidencia.huellaFinnegans,
      };
}

function puntos(
  conciliacion: ResultadoConciliacion,
  evidencia?: Pick<
    EvidenciaSeleccionBnaSintetica,
    'seleccionIdentificadorHaberesBna' | 'huellaFinnegans'
  >,
): readonly string[] {
  const evaluacion = evaluarGeneracionBna(entrada(conciliacion, evidencia));
  expect(evaluacion.estado).toBe('MAPEO_NO_RESUELTO');
  return evaluacion.estado === 'MAPEO_NO_RESUELTO' ? evaluacion.puntos : [];
}

describe('BNA-B2 · revisión de conciliación y evaluación técnica', () => {
  it('resuelve únicamente P-09/P-10 cuando snapshot, huella y revisión coinciden', () => {
    const evidencia = evidenciaSeleccionBnaSintetica(conciliacionGoldenBna());
    const resultado = puntos(evidencia.conciliacion, evidencia);

    expect(resultado).not.toContain('P-09/P-10');
    expect(new Set(resultado)).toEqual(new Set(['BNA-1', 'BNA-2', 'BNA-6']));
    for (const pago of pagosBnaDesdeConciliacion(evidencia.conciliacion)) {
      expect(POLITICA_BNA_PRODUCTIVA.identificadorPrestamo(pago)).toEqual({
        estado: 'SIN_RESOLUCION',
        punto: 'P-09/P-10',
      });
    }
  });

  it('falla cerrado sin snapshot o sin revisión BNA en conciliación', () => {
    const base = conciliacionGoldenBna();
    const evidencia = evidenciaSeleccionBnaSintetica(base);

    expect(puntos(base)).toContain('P-09/P-10');
    expect(
      puntos(
        { ...evidencia.conciliacion, revisionSeleccionIdentificadorHaberesBna: null },
        evidencia,
      ),
    ).toContain('P-09/P-10');
  });

  it('rechaza revisión distinta, snapshot manipulado y huella vencida', () => {
    const evidencia = evidenciaSeleccionBnaSintetica(conciliacionGoldenBna());
    const snapshot = evidencia.seleccionIdentificadorHaberesBna;
    const manipulado: SnapshotSeleccionIdentificadorHaberesBna = {
      ...snapshot,
      cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
        ...cantidad,
        cantidadFilasBna: cantidad.cantidadFilasBna + 1,
      })),
    };

    expect(
      puntos(
        {
          ...evidencia.conciliacion,
          revisionSeleccionIdentificadorHaberesBna: 'revision-distinta',
        },
        evidencia,
      ),
    ).toContain('P-09/P-10');
    expect(
      puntos(evidencia.conciliacion, {
        seleccionIdentificadorHaberesBna: manipulado,
        huellaFinnegans: evidencia.huellaFinnegans,
      }),
    ).toContain('P-09/P-10');
    expect(
      puntos(evidencia.conciliacion, {
        seleccionIdentificadorHaberesBna: snapshot,
        huellaFinnegans: 'otra-huella',
      }),
    ).toContain('P-09/P-10');
  });

  it('una decisión cambiada después de conciliar no reutiliza la conciliación anterior', () => {
    const base = conciliacionGoldenBna();
    const anterior = evidenciaSeleccionBnaSintetica(base, 'misma-huella', '0000');
    const nueva = evidenciaSeleccionBnaSintetica(base, 'misma-huella', '0003');

    expect(anterior.conciliacion.revisionSeleccionIdentificadorHaberesBna).not.toBe(
      nueva.conciliacion.revisionSeleccionIdentificadorHaberesBna,
    );
    expect(
      puntos(anterior.conciliacion, {
        seleccionIdentificadorHaberesBna: nueva.seleccionIdentificadorHaberesBna,
        huellaFinnegans: nueva.huellaFinnegans,
      }),
    ).toContain('P-09/P-10');
  });

  it('la política y la generación productivas continúan cerradas y sin bytes', () => {
    const evidencia = evidenciaSeleccionBnaSintetica(conciliacionGoldenBna());
    const resultado = generarBna(entrada(evidencia.conciliacion, evidencia));

    expect(produccionBnaHabilitada()).toBe(false);
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    expect('bytes' in resultado).toBe(false);
  });
});
