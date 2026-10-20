// Conciliación global e invariantes (docs/03 §G.2, D-032), en cantidad y en centavos.
import { describe, expect, it } from 'vitest';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import { conciliar, decisionAsignarDestino } from '../../../src/reconciliation';
import { conciliacionGlobal } from '../../../src/reconciliation/totales';
import {
  filaFinnegans,
  finnegansLibro,
  maestroLibro,
  personas,
  registroBna,
  registroPatagonia,
  type FilaFinnegans,
  type RegistroMaestro,
} from '../../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike.ts';
import { createRandom, randomInt } from '../../fixtures/synthetic/identities.ts';
import { inlineStr } from '../../fixtures/synthetic/xlsxBuilder.ts';
import { escenario, gente, HUELLAS, TODO_MAPEADO } from './helpers.ts';

const persona = gente(10, 51);
const random = createRandom(51);
/** Fila coherente con el neto indicado (componentes que cuadran). */
const fila = (i: number, banco: string | null, neto: string) =>
  filaFinnegans(persona(i), {
    Banco: banco,
    Remunerativo: neto.startsWith('-') ? '0' : neto,
    'No remunerativo': '0',
    Descuento: neto.startsWith('-') ? neto.slice(1) : '0',
    Neto: neto,
  });

describe('totales y estado global', () => {
  it('suma cada destino, excluidas y pendientes en cantidad y centavos; los invariantes cierran', () => {
    const filas = [
      fila(0, BANCO_NACION, '1000.10'),
      fila(1, BANCO_NACION, '2000'),
      fila(2, BANCO_PATAGONIA, '300.05'),
      fila(3, BANCO_PATAGONIA, '0'),
      fila(4, null, '50'),
      fila(5, 'OTRO BANCO', '7'),
    ];
    const registros = [
      registroBna(persona(0), random),
      registroBna(persona(1), random),
      registroPatagonia(persona(2), random),
    ];
    const { global } = escenario(filas, registros);
    expect(global.finnegans).toEqual({ cantidad: 6, importe: 335_715n, filasSinImporte: 0 });
    expect(global.bna).toEqual({ cantidad: 2, importe: 300_010n, filasSinImporte: 0 });
    expect(global.patagonia).toEqual({ cantidad: 1, importe: 30_005n, filasSinImporte: 0 });
    expect(global.excluidas).toEqual({ cantidad: 1, importe: 0n, filasSinImporte: 0 });
    expect(global.pendientes).toEqual({ cantidad: 2, importe: 5_700n, filasSinImporte: 0 });
    expect([global.invarianteCantidad, global.invarianteImporte]).toEqual([true, true]);
    expect(global.invarianteSinPendientes).toBeNull();
    // Banco no soportado: bloqueante global; banco vacío: revisión global sin resolver.
    expect(global.estado).toBe('BLOQUEADA');
    expect(global.motivos).toEqual([
      'BLOQUEANTES_GLOBALES',
      'FILAS_PENDIENTES',
      'REVISIONES_GLOBALES_SIN_RESOLVER',
    ]);
    expect([global.bloqueantesGlobales, global.revisionesGlobalesSinResolver]).toEqual([1, 1]);
  });

  it('una fila con banco vacío mantiene la conciliación PENDIENTE; al asignar destino, CERRADA', () => {
    const filas = [fila(0, BANCO_NACION, '10'), fila(1, null, '20')];
    const registros = [registroBna(persona(0), random), registroBna(persona(1), random)];
    const antes = escenario(filas, registros);
    expect(antes.global.estado).toBe('PENDIENTE');
    expect(antes.global.motivos).toEqual(['FILAS_PENDIENTES', 'REVISIONES_GLOBALES_SIN_RESOLVER']);
    const bancoVacio = antes.incidencias.find((i) => i.codigo === 'BANCO_VACIO');
    if (bancoVacio === undefined) {
      throw new Error('falta BANCO_VACIO');
    }
    const decision = decisionAsignarDestino(bancoVacio, 'BNA_GT_HABERES', {
      id: 'd',
      momento: 'm',
    });
    const { global } = escenario(filas, registros, { decisiones: [decision] });
    expect(global.estado).toBe('CERRADA');
    expect(global.motivos).toEqual([]);
    expect(global.pendientes).toEqual({ cantidad: 0, importe: 0n, filasSinImporte: 0 });
    expect(global.bna).toEqual({ cantidad: 2, importe: 3_000n, filasSinImporte: 0 });
    expect(global.invarianteSinPendientes).toBe(true);
  });

  it('neto ilegible: importe null (no se fabrica), cantidades conciliadas, BLOQUEADA', () => {
    const filas = [
      fila(0, BANCO_NACION, '10'),
      filaFinnegans(persona(1), { Banco: BANCO_PATAGONIA, Neto: inlineStr('1.000,00') }),
    ];
    const { global } = escenario(filas, [
      registroBna(persona(0), random),
      registroPatagonia(persona(1), random),
    ]);
    expect(global.finnegans).toEqual({ cantidad: 2, importe: null, filasSinImporte: 1 });
    expect(global.bna).toEqual({ cantidad: 1, importe: 1_000n, filasSinImporte: 0 });
    expect(global.patagonia).toEqual({ cantidad: 1, importe: null, filasSinImporte: 1 });
    expect(global.invarianteCantidad).toBe(true);
    expect(global.invarianteImporte).toBeNull();
    expect(global.invarianteSinPendientes).toBeNull();
    expect(global.estado).toBe('BLOQUEADA');
    expect(global.motivos).toEqual(['BLOQUEANTES_GLOBALES', 'IMPORTE_NO_CALCULABLE']);
  });

  it('sin una liquidación legible: cero filas y BLOQUEADA por estructura', () => {
    const { global, filas } = escenario([], []);
    expect(filas).toEqual([]);
    expect(global.finnegans).toEqual({ cantidad: 0, importe: 0n, filasSinImporte: 0 });
    expect(global.estado).toBe('BLOQUEADA');
  });

  it('si una fila se perdiera, los invariantes de cantidad e importe lo detectan', () => {
    const resultado = escenario([fila(0, BANCO_NACION, '10'), fila(1, BANCO_NACION, '5')], []);
    const lineas = resultado.filas.map((f) => f.linea);
    const perdida = conciliacionGlobal(lineas, resultado.filas.slice(1), resultado.incidencias);
    expect([perdida.invarianteCantidad, perdida.invarianteImporte]).toEqual([false, false]);
    expect(perdida.estado).toBe('BLOQUEADA');
    expect(perdida.motivos).toEqual(
      expect.arrayContaining(['INVARIANTE_CANTIDAD', 'INVARIANTE_IMPORTE']),
    );
  });

  it('las revisiones por banco no afectan el estado global', () => {
    const filas = [
      filaFinnegans({ ...persona(0), legajo: '007' }, { Banco: BANCO_NACION, Legajo: '007' }),
    ];
    const { global } = escenario(filas, [registroBna(persona(0), random, { LEGAJO: '7' })]);
    expect(global.estado).toBe('CERRADA');
  });
});

/** Escenario aleatorio con su oráculo independiente (estado esperado y total en centavos). */
function aleatorio(semilla: number): {
  filas: FilaFinnegans[];
  registros: RegistroMaestro[];
  esperado: string[];
  /** Total exacto en centavos, o null si hay algún neto ilegible. */
  total: bigint | null;
} {
  const r = createRandom(semilla);
  const cantidad = randomInt(r, 0, 40);
  const lista = personas(cantidad, semilla);
  const filas: FilaFinnegans[] = [];
  const registros: RegistroMaestro[] = [];
  const esperado: string[] = [];
  let total: bigint | null = 0n;
  lista.forEach((p, i) => {
    const banco =
      [BANCO_NACION, BANCO_NACION, BANCO_PATAGONIA, BANCO_PATAGONIA, null, 'OTRO', '  '][
        randomInt(r, 0, 6)
      ] ?? null;
    const tipo = randomInt(r, 0, 19);
    const cents = BigInt(randomInt(r, 1, 99_999_999));
    const neto =
      tipo === 0
        ? '0'
        : tipo === 1
          ? null
          : `${tipo === 2 ? '-' : ''}${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`;
    const cuil = i > 0 && randomInt(r, 0, 19) === 0 ? (lista[i - 1]?.cuil ?? p.cuil) : p.cuil;
    filas.push(
      filaFinnegans({ ...p, cuil }, { Banco: banco, Neto: neto ?? inlineStr('ilegible') }),
    );
    if (neto === null || total === null) {
      total = null;
    } else {
      total += (neto.startsWith('-') ? -1n : 1n) * BigInt(neto.replace(/[-.]/g, ''));
    }
    esperado.push(
      neto === '0'
        ? 'EXCLUIDA'
        : banco === BANCO_NACION
          ? 'INCLUIDA:BNA_GT_HABERES'
          : banco === BANCO_PATAGONIA
            ? 'INCLUIDA:PATAGONIA_B2'
            : 'PENDIENTE',
    );
    const dado = randomInt(r, 0, 9);
    if (dado < 6) {
      registros.push(banco === BANCO_PATAGONIA ? registroPatagonia(p, r) : registroBna(p, r));
    } else if (dado === 6) {
      registros.push(registroBna(p, r), registroBna(p, r));
    }
  });
  return { filas, registros, esperado, total };
}

describe('propiedades sobre 200 escenarios aleatorios (semillas fijas)', () => {
  it('ninguna fila se pierde, cada una en un solo estado, y los invariantes valen siempre', () => {
    for (let semilla = 1; semilla <= 200; semilla += 1) {
      const { filas, registros, esperado, total } = aleatorio(semilla);
      const finnegans = parseFinnegans(finnegansLibro(filas));
      const resultado = conciliar({
        finnegans,
        maestro: parseMaestro(maestroLibro(registros)),
        huellas: HUELLAS,
        liquidaciones: TODO_MAPEADO,
      });
      const { global } = resultado;
      expect(resultado.filas.map((f) => f.linea)).toEqual(finnegans.lineas);
      expect(
        resultado.filas.map((f) =>
          f.estado.estado === 'INCLUIDA' ? `INCLUIDA:${f.estado.destino}` : f.estado.estado,
        ),
      ).toEqual(esperado);
      expect(global.invarianteCantidad).toBe(true);
      expect(global.finnegans.importe).toBe(total);
      expect(global.invarianteImporte).toBe(total === null ? null : true);
      if (global.pendientes.cantidad === 0 && total !== null) {
        expect(global.invarianteSinPendientes).toBe(true);
      }
      const bloqueada = global.motivos.some((m) =>
        [
          'BLOQUEANTES_GLOBALES',
          'IMPORTE_NO_CALCULABLE',
          'INVARIANTE_CANTIDAD',
          'INVARIANTE_IMPORTE',
        ].includes(m),
      );
      expect(global.estado).toBe(
        bloqueada ? 'BLOQUEADA' : global.motivos.length > 0 ? 'PENDIENTE' : 'CERRADA',
      );
      const ids = resultado.incidencias.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
