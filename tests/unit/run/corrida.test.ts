// Estado de corrida solo en memoria (plan F3, D-062): funciones puras, sin almacenamiento.
import { describe, expect, it } from 'vitest';
import type { LecturaFinnegans } from '../../../src/domain/liquidacion';
import type { LecturaMaestro } from '../../../src/domain/maestro';
import {
  conDecision,
  conFinnegans,
  conMaestro,
  conRevisionMaestro,
  nuevaCorrida,
  reiniciarCorrida,
} from '../../../src/run/corrida';
import { revisionMaestroImportada } from '../../../src/run/revision';
import type { DecisionOperador } from '../../../src/reconciliation';

const LECTURA_FINNEGANS_VACIA: LecturaFinnegans = {
  hoja: null,
  visibilidadHoja: null,
  lineas: [],
  hallazgos: [],
};

const LECTURA_MAESTRO_VACIA: LecturaMaestro = {
  hoja: null,
  versionContrato: null,
  registros: [],
  hallazgos: [],
};

const DECISION = {
  id: 'd1',
  tipo: 'ASIGNAR_DESTINO',
  destino: 'BNA_GT_HABERES',
  incidenciaId: 'inc-1',
  observado: { cuilTexto: '', valores: {}, huellas: {} },
  refs: [],
  momento: '2026-01-01T00:00:00Z',
} as unknown as DecisionOperador;

describe('EstadoCorrida · memoria pura y determinística', () => {
  it('arranca vacía y las cargas devuelven estados nuevos sin mutar el anterior', () => {
    const base = nuevaCorrida();
    expect(base).toEqual({
      finnegans: null,
      huellaFinnegans: null,
      maestro: null,
      huellaMaestro: null,
      perfil: null,
      decisiones: [],
    });
    const conArchivo = conFinnegans(base, LECTURA_FINNEGANS_VACIA, 'huella-f');
    expect(base.finnegans).toBeNull();
    expect(conArchivo.finnegans).toBe(LECTURA_FINNEGANS_VACIA);
    expect(conArchivo.huellaFinnegans).toBe('huella-f');
    expect(base).not.toBe(conArchivo);
  });

  it('dirige estado en pasos: maestro, y las decisiones se acumulan sin mutar', () => {
    let estado = nuevaCorrida();
    const pasos = [estado];
    estado = conMaestro(estado, LECTURA_MAESTRO_VACIA, 'huella-m');
    pasos.push(estado);
    estado = conDecision(estado, DECISION);
    expect(estado.decisiones).toHaveLength(1);
    expect(estado.maestro).toBe(LECTURA_MAESTRO_VACIA);
    expect(pasos[0]?.decisiones).toHaveLength(0);
    expect(pasos[1]?.decisiones).toHaveLength(0);
  });

  it('el maestro importado crea la revisión 0; la nueva revisión reemplaza (D-062)', () => {
    const base = conMaestro(nuevaCorrida(), LECTURA_MAESTRO_VACIA, 'huella-m');
    const revision = revisionMaestroImportada(LECTURA_MAESTRO_VACIA);
    expect(base.maestroRevision).toEqual(revision);
    const siguiente = conRevisionMaestro(base, { ...revision, numero: 1 });
    expect(siguiente.maestroRevision?.numero).toBe(1);
    expect(base.maestroRevision?.numero).toBe(0);
  });

  it('el reinicio explícito descarta todo el estado sin dejar rastros', () => {
    const estadoActual = reiniciarCorrida();
    expect(estadoActual.decisiones).toEqual([]);
    expect(estadoActual.finnegans).toBeNull();
    expect(estadoActual.maestroRevision).toBeNull();
  });
});
