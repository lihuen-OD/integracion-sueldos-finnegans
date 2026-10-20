// Decisiones del operador como datos puros (docs/03 §E.3): aplicación, trazabilidad y
// DECISION_NO_APLICADA cuando cambian los datos observados o el archivo.
import { describe, expect, it } from 'vitest';
import type { BancoCatalogado } from '../../../src/domain/destino';
import {
  decisionAsignarDestino,
  decisionConfirmarRevision,
  type DecisionOperador,
  type IncidenciaConciliada,
  type ResultadoConciliacion,
} from '../../../src/reconciliation';
import {
  filaFinnegans,
  registroBna,
  registroPatagonia,
  textoDeCelda,
} from '../../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION } from '../../fixtures/synthetic/finnegansLike.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { escenario, gente, HUELLAS, primera, resumen } from './helpers.ts';

const persona = gente(8, 41);
const random = createRandom(41);
const MOMENTO = '2026-10-20T10:00:00-03:00';
const sinBanco = (i: number, cambios = {}) =>
  filaFinnegans(persona(i), { Banco: null, ...cambios });
const conLegajo = (i: number, legajo: string) =>
  filaFinnegans({ ...persona(i), legajo }, { Banco: BANCO_NACION, Legajo: legajo });

function incidencia(resultado: ResultadoConciliacion, codigo: string): IncidenciaConciliada {
  const encontrada = resultado.incidencias.find((i) => i.codigo === codigo);
  if (encontrada === undefined) {
    throw new Error(`no hay ${codigo}`);
  }
  return encontrada;
}

describe('ASIGNAR_DESTINO (D-013): resuelve únicamente BANCO_VACIO', () => {
  const filas = [sinBanco(0)];
  const registros = [registroPatagonia(persona(0), random)];
  const antes = escenario(filas, registros);
  const decision = decisionAsignarDestino(incidencia(antes, 'BANCO_VACIO'), 'PATAGONIA_B2', {
    id: 'd-1',
    momento: MOMENTO,
  });

  it('antes de decidir, la fila está pendiente y la incidencia es resoluble con lo observado', () => {
    expect(primera(antes).estado).toEqual({ estado: 'PENDIENTE', motivo: 'BANCO_VACIO' });
    expect(incidencia(antes, 'BANCO_VACIO').resoluble).toEqual({
      por: 'ASIGNAR_DESTINO',
      observado: {
        cuilTexto: persona(0).cuil,
        valores: { finnegans: '' },
        huellas: { finnegans: HUELLAS.finnegans },
      },
    });
  });

  it('con la decisión vigente, la fila queda incluida y se aplican las reglas de ese banco', () => {
    const despues = escenario(filas, registros, { decisiones: [decision] });
    const fila = primera(despues);
    expect(fila.estado).toEqual({
      estado: 'INCLUIDA',
      destino: 'PATAGONIA_B2',
      origen: 'DECISION_OPERADOR',
    });
    expect(fila.nivel).toBe('CORRECTO');
    expect(despues.decisiones).toEqual({ aplicadas: [decision], noAplicadas: [] });
    // La incidencia sigue visible y trazable con su resolución.
    expect(incidencia(despues, 'BANCO_VACIO').resolucion).toEqual({
      decisionId: 'd-1',
      tipo: 'ASIGNAR_DESTINO',
      momento: MOMENTO,
    });
  });

  it('el destino asignado exige los datos de ese banco (BNA sin CBU → bloqueo BNA)', () => {
    const aBna = decisionAsignarDestino(incidencia(antes, 'BANCO_VACIO'), 'BNA_GT_HABERES', {
      id: 'd-2',
      momento: MOMENTO,
    });
    const fila = primera(escenario(filas, registros, { decisiones: [aBna] }));
    expect(fila.estado).toMatchObject({ estado: 'INCLUIDA', destino: 'BNA_GT_HABERES' });
    expect(resumen(fila)).toContain('CBU_FALTANTE:BLOQUEANTE:BNA_GT_HABERES');
  });

  it('un cambio en el maestro no invalida la asignación (solo observó Finnegans)', () => {
    const despues = escenario(filas, registros, {
      decisiones: [decision],
      huellas: { ...HUELLAS, maestro: 'otra-huella-maestro' },
    });
    expect(primera(despues).estado.estado).toBe('INCLUIDA');
  });

  it.each([
    [
      'cambió el archivo Finnegans',
      { huellas: { ...HUELLAS, finnegans: 'otra' } },
      [sinBanco(0)],
      'DATOS_CAMBIARON',
    ],
    ['cambió el valor observado del banco', {}, [sinBanco(0, { Banco: '  ' })], 'DATOS_CAMBIARON'],
    [
      'la fila ya no está en la misma posición',
      {},
      [filaFinnegans(persona(1)), sinBanco(0)],
      'INCIDENCIA_INEXISTENTE',
    ],
  ])(
    'no se aplica si %s: DECISION_NO_APLICADA y la fila sigue pendiente',
    (_caso, extra, nuevasFilas, motivo) => {
      const despues = escenario(nuevasFilas, registros, { decisiones: [decision], ...extra });
      expect(despues.filas.map((f) => f.estado.estado)).toContain('PENDIENTE');
      expect(despues.decisiones.noAplicadas).toEqual([{ decision, motivo }]);
      expect(despues.incidencias.at(-1)).toMatchObject({
        codigo: 'DECISION_NO_APLICADA',
        nivel: 'INFORMACION',
        alcance: 'GLOBAL',
        motivo,
        refs: decision.refs,
      });
    },
  );

  it('no resuelve un banco no soportado: nunca se reasigna', () => {
    const otro = escenario([filaFinnegans(persona(0), { Banco: 'OTRO BANCO' })], registros);
    const noSoportado = incidencia(otro, 'BANCO_NO_SOPORTADO');
    expect(() =>
      decisionAsignarDestino(noSoportado, 'PATAGONIA_B2', { id: 'x', momento: MOMENTO }),
    ).toThrow();
    const forzada: DecisionOperador = { ...decision, incidenciaId: noSoportado.id };
    const despues = escenario([filaFinnegans(persona(0), { Banco: 'OTRO BANCO' })], registros, {
      decisiones: [forzada],
    });
    expect(primera(despues).estado.estado).toBe('PENDIENTE');
    expect(despues.decisiones.noAplicadas).toEqual([
      { decision: forzada, motivo: 'NO_RESOLUBLE_POR_ESTE_TIPO' },
    ]);
  });

  it('un destino sin entrada en el catálogo no se valida a ciegas', () => {
    const soloNacion: BancoCatalogado[] = [
      {
        textoFinnegans: BANCO_NACION,
        destino: 'BNA_GT_HABERES',
        entidadEsperada: '011',
        fuente: 'test',
      },
    ];
    const fila = primera(
      escenario(filas, registros, { decisiones: [decision], catalogoBancos: soloNacion }),
    );
    expect(fila.incidencias).toContainEqual(
      expect.objectContaining({
        codigo: 'BANCO_INCOMPATIBLE_MAESTRO',
        motivo: 'DESTINO_SIN_CATALOGO',
      }),
    );
  });
});

describe('CONFIRMAR_REVISION: confirmación explícita y trazable', () => {
  const filas = [conLegajo(0, '007')];
  const registros = [registroBna(persona(0), random, { LEGAJO: '7' })];
  const antes = escenario(filas, registros);
  const legajo = incidencia(antes, 'LEGAJO_NO_COINCIDE');
  const confirmacion = decisionConfirmarRevision(legajo, { id: 'c-1', momento: MOMENTO });

  it('el legajo distinto observa ambos archivos y ambos valores', () => {
    expect(primera(antes).nivel).toBe('REQUIERE_REVISION');
    expect(legajo.resoluble?.observado).toEqual({
      cuilTexto: persona(0).cuil,
      valores: { finnegans: '007', maestro: '7' },
      huellas: HUELLAS,
    });
  });

  it('confirmada: la incidencia sigue visible con su resolución y la fila deja de requerir revisión', () => {
    const despues = escenario(filas, registros, { decisiones: [confirmacion] });
    const fila = primera(despues);
    expect(fila.nivel).toBe('CORRECTO');
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'LEGAJO_NO_COINCIDE',
        resolucion: { decisionId: 'c-1', tipo: 'CONFIRMAR_REVISION', momento: MOMENTO },
      }),
    ]);
    // No se modificó ningún dato.
    expect(fila.linea.legajo).toBe('007');
    expect(fila.registro?.legajo).toBe('7');
  });

  it.each([
    ['cambió el maestro', { huellas: { ...HUELLAS, maestro: 'otra' } }, registros],
    ['cambió el legajo del maestro', {}, [registroBna(persona(0), random, { LEGAJO: '07' })]],
  ])('no se aplica si %s', (_caso, extra, nuevosRegistros) => {
    const despues = escenario(filas, nuevosRegistros, { decisiones: [confirmacion], ...extra });
    expect(primera(despues).nivel).toBe('REQUIERE_REVISION');
    expect(despues.decisiones.noAplicadas).toEqual([
      { decision: confirmacion, motivo: 'DATOS_CAMBIARON' },
    ]);
  });

  it('confirma también un neto que no cuadra con sus componentes', () => {
    const conDiferencia = [filaFinnegans(persona(1), { Banco: BANCO_NACION, Neto: '1' })];
    const registrosB = [registroBna(persona(1), random)];
    const previo = escenario(conDiferencia, registrosB);
    const decision = decisionConfirmarRevision(incidencia(previo, 'NETO_NO_CUADRA_COMPONENTES'), {
      id: 'c-2',
      momento: MOMENTO,
    });
    expect(primera(escenario(conDiferencia, registrosB, { decisiones: [decision] })).nivel).toBe(
      'CORRECTO',
    );
  });

  it('un BLOQUEANTE no se resuelve con una confirmación: hay que corregir la fuente', () => {
    const sinMaestro = escenario([filaFinnegans(persona(2), { Banco: BANCO_NACION })], []);
    const bloqueante = incidencia(sinMaestro, 'SIN_MAESTRO');
    expect(bloqueante.resoluble).toBeUndefined();
    expect(() => decisionConfirmarRevision(bloqueante, { id: 'x', momento: MOMENTO })).toThrow();
    const forzada: DecisionOperador = { ...confirmacion, incidenciaId: bloqueante.id };
    const despues = escenario([filaFinnegans(persona(2), { Banco: BANCO_NACION })], [], {
      decisiones: [forzada],
    });
    expect(despues.decisiones.noAplicadas[0]?.motivo).toBe('NO_RESOLUBLE_POR_ESTE_TIPO');
    expect(primera(despues).nivel).toBe('BLOQUEANTE');
  });

  it('una confirmación no asigna destino a un banco vacío', () => {
    const pendiente = escenario([sinBanco(3)], []);
    const forzada: DecisionOperador = {
      ...confirmacion,
      incidenciaId: incidencia(pendiente, 'BANCO_VACIO').id,
    };
    const despues = escenario([sinBanco(3)], [], { decisiones: [forzada] });
    expect(primera(despues).estado.estado).toBe('PENDIENTE');
    expect(despues.decisiones.noAplicadas[0]?.motivo).toBe('NO_RESOLUBLE_POR_ESTE_TIPO');
  });

  it('una incidencia ya resuelta no admite otra decisión del helper', () => {
    const despues = escenario(filas, registros, { decisiones: [confirmacion] });
    expect(() =>
      decisionConfirmarRevision(incidencia(despues, 'LEGAJO_NO_COINCIDE'), {
        id: 'c-3',
        momento: MOMENTO,
      }),
    ).toThrow();
  });
});

describe('conflictos y pureza', () => {
  it('dos decisiones para la misma incidencia: no se aplica ninguna (no se elige)', () => {
    const filas = [sinBanco(0)];
    const antes = escenario(filas, []);
    const bancoVacio = incidencia(antes, 'BANCO_VACIO');
    const a = decisionAsignarDestino(bancoVacio, 'BNA_GT_HABERES', { id: 'a', momento: MOMENTO });
    const b = decisionAsignarDestino(bancoVacio, 'PATAGONIA_B2', { id: 'b', momento: MOMENTO });
    const despues = escenario(filas, [], { decisiones: [a, b] });
    expect(primera(despues).estado.estado).toBe('PENDIENTE');
    expect(despues.decisiones.noAplicadas.map((n) => n.motivo)).toEqual([
      'DECISIONES_EN_CONFLICTO',
      'DECISIONES_EN_CONFLICTO',
    ]);
    const ids = despues.incidencias.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('las decisiones no modifican las lecturas', () => {
    const filas = [sinBanco(0), conLegajo(1, '007')];
    const registros = [registroBna(persona(1), random, { LEGAJO: '7' })];
    const antes = escenario(filas, registros);
    const decisiones = [
      decisionAsignarDestino(incidencia(antes, 'BANCO_VACIO'), 'BNA_GT_HABERES', {
        id: 'a',
        momento: MOMENTO,
      }),
      decisionConfirmarRevision(incidencia(antes, 'LEGAJO_NO_COINCIDE'), {
        id: 'b',
        momento: MOMENTO,
      }),
    ];
    const despues = escenario(filas, registros, { decisiones });
    expect(despues.filas.map((f) => f.linea)).toEqual(antes.filas.map((f) => f.linea));
    expect(despues.filas.map((f) => f.registro)).toEqual(antes.filas.map((f) => f.registro));
    expect(despues.decisiones.aplicadas).toHaveLength(2);
  });
});

describe('P-29.5: una confirmación tomada bajo un destino no se reutiliza en otro', () => {
  // Banco vacío y legajo distinto; el maestro tiene datos de ambos bancos.
  const filas = [filaFinnegans({ ...persona(4), legajo: '007' }, { Banco: null, Legajo: '007' })];
  const cbuBna = textoDeCelda(registroBna(persona(4), random).CBU);
  const registros = [registroPatagonia(persona(4), random, { LEGAJO: '7', CBU: cbuBna })];

  it('destino A + confirmación; al cambiar a destino B la confirmación no se aplica y queda trazada', () => {
    const inicial = escenario(filas, registros);
    const bancoVacio = incidencia(inicial, 'BANCO_VACIO');
    const aBna = decisionAsignarDestino(bancoVacio, 'BNA_GT_HABERES', {
      id: 'a',
      momento: MOMENTO,
    });

    // Destino A (BNA): aparece la revisión de legajo bajo BNA y se confirma.
    const conBna = escenario(filas, registros, { decisiones: [aBna] });
    const legajoBna = incidencia(conBna, 'LEGAJO_NO_COINCIDE');
    expect(legajoBna.alcance).toBe('BNA_GT_HABERES');
    const confirmacion = decisionConfirmarRevision(legajoBna, { id: 'c', momento: MOMENTO });
    const confirmada = escenario(filas, registros, { decisiones: [aBna, confirmacion] });
    expect(incidencia(confirmada, 'LEGAJO_NO_COINCIDE').resolucion?.decisionId).toBe('c');
    expect(primera(confirmada).nivel).toBe('CORRECTO');

    // Destino B (Patagonia) en lugar de A: la confirmación anterior no se reutiliza.
    const aPatagonia = decisionAsignarDestino(bancoVacio, 'PATAGONIA_B2', {
      id: 'b',
      momento: MOMENTO,
    });
    const cambiada = escenario(filas, registros, { decisiones: [aPatagonia, confirmacion] });
    const fila = primera(cambiada);
    expect(fila.estado).toEqual({
      estado: 'INCLUIDA',
      destino: 'PATAGONIA_B2',
      origen: 'DECISION_OPERADOR',
    });
    const legajoPatagonia = incidencia(cambiada, 'LEGAJO_NO_COINCIDE');
    expect(legajoPatagonia.alcance).toBe('PATAGONIA_B2');
    expect(legajoPatagonia.resolucion).toBeUndefined();
    expect(fila.nivel).toBe('REQUIERE_REVISION');
    expect(cambiada.decisiones.aplicadas).toEqual([aPatagonia]);
    expect(cambiada.decisiones.noAplicadas).toEqual([
      { decision: confirmacion, motivo: 'INCIDENCIA_INEXISTENTE' },
    ]);
    expect(incidencia(cambiada, 'DECISION_NO_APLICADA')).toMatchObject({
      nivel: 'INFORMACION',
      alcance: 'GLOBAL',
      motivo: 'INCIDENCIA_INEXISTENTE',
      refs: confirmacion.refs,
    });
  });
});
