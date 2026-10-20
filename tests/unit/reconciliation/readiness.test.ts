// Readiness independiente por banco (docs/03 §G.3, D-032). Los contextos con configuración o
// generador habilitados son DOBLES DE TEST: en F2 el único contexto de producción es CONTEXTO_F2.
import { describe, expect, it } from 'vitest';
import {
  CONTEXTO_F2,
  decisionConfirmarRevision,
  evaluarReadiness,
  type ContextoReadiness,
} from '../../../src/reconciliation';
import {
  filaFinnegans,
  registroBna,
  registroPatagonia,
} from '../../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { escenario, gente } from './helpers.ts';

const persona = gente(10, 61);
const random = createRandom(61);
const bna = (i: number, cambios = {}) =>
  filaFinnegans(persona(i), { Banco: BANCO_NACION, ...cambios });
const pat = (i: number, cambios = {}) =>
  filaFinnegans(persona(i), { Banco: BANCO_PATAGONIA, ...cambios });

/** Doble de test: todo configurado y ambos generadores habilitados (estados futuros). */
const TODO_HABILITADO: ContextoReadiness = {
  configuracionCompleta: { BNA_GT_HABERES: true, PATAGONIA_B2: true },
  generadorHabilitado: { BNA_GT_HABERES: true, PATAGONIA_B2: true },
};

const limpio = () =>
  escenario(
    [bna(0), bna(1), pat(2)],
    [
      registroBna(persona(0), random),
      registroBna(persona(1), random),
      registroPatagonia(persona(2), random),
    ],
  );

describe('producción en F2', () => {
  it('CONTEXTO_F2 no habilita configuración ni generadores', () => {
    expect(CONTEXTO_F2).toEqual({
      configuracionCompleta: { BNA_GT_HABERES: false, PATAGONIA_B2: false },
      generadorHabilitado: { BNA_GT_HABERES: false, PATAGONIA_B2: false },
    });
  });

  it('sin mapeos de liquidación aprobados, ambos bancos quedan BLOQUEADOS (D-026)', () => {
    const resultado = escenario(
      [bna(0), pat(1)],
      [registroBna(persona(0), random), registroPatagonia(persona(1), random)],
      {
        liquidaciones: null,
      },
    );
    const { bna: b, patagonia: p } = evaluarReadiness(resultado);
    expect([b.estado, p.estado]).toEqual(['BLOQUEADO', 'BLOQUEADO']);
    expect(b.motivos).toEqual([
      'BLOQUEANTES_DEL_BANCO',
      'CONFIGURACION_INCOMPLETA',
      'GENERADOR_NO_HABILITADO',
    ]);
  });

  it('aun con todos los datos correctos, ningún banco llega a LISTO_PARA_GENERAR', () => {
    const { bna: b, patagonia: p } = evaluarReadiness(limpio());
    expect([b.estado, p.estado]).toEqual(['CONFIGURACION_INCOMPLETA', 'CONFIGURACION_INCOMPLETA']);
    expect(b.motivos).toEqual(['CONFIGURACION_INCOMPLETA', 'GENERADOR_NO_HABILITADO']);
    expect([b.pendienteHomologacion, p.pendienteHomologacion]).toEqual([true, true]);
  });
});

describe('los 7 estados, en el orden de docs/03 §G.3', () => {
  it('LISTO_PARA_GENERAR solo con dobles de test, y sigue PENDIENTE DE HOMOLOGACION', () => {
    const { bna: b, patagonia: p } = evaluarReadiness(limpio(), TODO_HABILITADO);
    expect(b).toEqual({
      destino: 'BNA_GT_HABERES',
      estado: 'LISTO_PARA_GENERAR',
      asignadas: { cantidad: 2, importe: 84_000_050n, filasSinImporte: 0 },
      bloqueantes: 0,
      revisionesSinResolver: 0,
      motivos: [],
      pendienteHomologacion: true,
    });
    expect(p.estado).toBe('LISTO_PARA_GENERAR');
  });

  it('GENERADOR_NO_HABILITADO', () => {
    const contexto = {
      ...TODO_HABILITADO,
      generadorHabilitado: { BNA_GT_HABERES: false, PATAGONIA_B2: true },
    };
    const { bna: b, patagonia: p } = evaluarReadiness(limpio(), contexto);
    expect([b.estado, p.estado]).toEqual(['GENERADOR_NO_HABILITADO', 'LISTO_PARA_GENERAR']);
  });

  it('CONFIGURACION_INCOMPLETA de un solo banco', () => {
    const contexto = {
      ...TODO_HABILITADO,
      configuracionCompleta: { BNA_GT_HABERES: true, PATAGONIA_B2: false },
    };
    const { bna: b, patagonia: p } = evaluarReadiness(limpio(), contexto);
    expect([b.estado, p.estado]).toEqual(['LISTO_PARA_GENERAR', 'CONFIGURACION_INCOMPLETA']);
  });

  it('REQUIERE_REVISION hasta confirmar el legajo; confirmado, LISTO', () => {
    const filas = [
      filaFinnegans({ ...persona(0), legajo: '007' }, { Banco: BANCO_NACION, Legajo: '007' }),
    ];
    const registros = [registroBna(persona(0), random, { LEGAJO: '7' })];
    const antes = escenario(filas, registros);
    expect(evaluarReadiness(antes, TODO_HABILITADO).bna).toMatchObject({
      estado: 'REQUIERE_REVISION',
      revisionesSinResolver: 1,
    });
    const legajo = antes.incidencias.find((i) => i.codigo === 'LEGAJO_NO_COINCIDE');
    if (legajo === undefined) {
      throw new Error('falta LEGAJO_NO_COINCIDE');
    }
    const decision = decisionConfirmarRevision(legajo, { id: 'c', momento: 'm' });
    const despues = escenario(filas, registros, { decisiones: [decision] });
    expect(evaluarReadiness(despues, TODO_HABILITADO).bna.estado).toBe('LISTO_PARA_GENERAR');
  });

  it('BLOQUEADO por un bloqueante del banco', () => {
    // Neto negativo (BLOQUEANTE) que además no cuadra con sus componentes (REQUIERE_REVISION):
    // el bloqueante se evalúa antes que la revisión.
    const resultado = escenario([bna(0, { Neto: '-1' })], [registroBna(persona(0), random)]);
    expect(evaluarReadiness(resultado, TODO_HABILITADO).bna).toMatchObject({
      estado: 'BLOQUEADO',
      bloqueantes: 1,
      revisionesSinResolver: 1,
      motivos: ['BLOQUEANTES_DEL_BANCO', 'REVISIONES_DEL_BANCO_SIN_RESOLVER'],
    });
  });

  it('BLOQUEADO_POR_CONCILIACION_GLOBAL en ambos bancos mientras haya un pago sin destino (P-24)', () => {
    const resultado = escenario(
      [bna(0), pat(1), filaFinnegans(persona(2), { Banco: null })],
      [registroBna(persona(0), random), registroPatagonia(persona(1), random)],
    );
    const { bna: b, patagonia: p } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect([b.estado, p.estado]).toEqual([
      'BLOQUEADO_POR_CONCILIACION_GLOBAL',
      'BLOQUEADO_POR_CONCILIACION_GLOBAL',
    ]);
    expect(b.motivos).toEqual(['CONCILIACION_GLOBAL_NO_CERRADA']);
  });

  it('SIN_REGISTROS si no hay filas asignadas al banco', () => {
    const resultado = escenario([bna(0)], [registroBna(persona(0), random)]);
    const { patagonia: p } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect(p).toMatchObject({
      estado: 'SIN_REGISTROS',
      asignadas: { cantidad: 0, importe: 0n, filasSinImporte: 0 },
    });
  });
});

describe('independencia entre bancos (D-032, D-048)', () => {
  it('un problema exclusivo de Patagonia no bloquea BNA', () => {
    const resultado = escenario(
      [bna(0), bna(1), pat(2)],
      [
        registroBna(persona(0), random),
        registroBna(persona(1), random),
        registroPatagonia(persona(2), random, { PAT_NUMERO_CUENTA: null }),
      ],
    );
    const { bna: b, patagonia: p } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect(resultado.global.estado).toBe('CERRADA');
    expect([b.estado, p.estado]).toEqual(['LISTO_PARA_GENERAR', 'BLOQUEADO']);
  });

  it('un problema exclusivo de BNA no bloquea Patagonia', () => {
    const resultado = escenario(
      [bna(0), pat(1)],
      [registroBna(persona(0), random, { CBU: null }), registroPatagonia(persona(1), random)],
    );
    const { bna: b, patagonia: p } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect([b.estado, p.estado]).toEqual(['BLOQUEADO', 'LISTO_PARA_GENERAR']);
  });

  it('un dato inválido del otro banco solo se informa: BNA con PAT_TIPO_CUENTA inválido sigue LISTO', () => {
    const resultado = escenario(
      [bna(0)],
      [registroBna(persona(0), random, { PAT_TIPO_CUENTA: 'x' })],
    );
    const { bna: b } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect(b.estado).toBe('LISTO_PARA_GENERAR');
    expect(resultado.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'DATO_PATAGONIA_INVALIDO',
        nivel: 'INFORMACION',
        alcance: 'BNA_GT_HABERES',
      }),
    ]);
  });

  it('un empleado de Patagonia sin maestro no bloquea BNA', () => {
    const resultado = escenario([bna(0), pat(1)], [registroBna(persona(0), random)]);
    const { bna: b, patagonia: p } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect([b.estado, p.estado]).toEqual(['LISTO_PARA_GENERAR', 'BLOQUEADO']);
  });
});
