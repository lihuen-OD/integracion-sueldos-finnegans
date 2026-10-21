// Integración F3 con las decisiones del operador (D-063): la huella del maestro que
// alimenta el `Observado` de F2 es la huella canónica de la REVISIÓN LÓGICA
// (MasterRevisionFingerprint), no la del archivo. Con ese único puente, F2 conserva toda
// su semántica de vigencia: las decisiones que observan solo Finnegans siguen aplicándose
// ante una revisión nueva del maestro; la que observó el maestro queda no aplicada
// (DATOS_CAMBIARON). Sin códigos ni contratos nuevos.
import { describe, expect, it } from 'vitest';
import {
  decisionAsignarDestino,
  decisionConfirmarRevision,
  type IncidenciaConciliada,
  type ResultadoConciliacion,
} from '../../../src/reconciliation';
import {
  filaFinnegans,
  registroBna,
  registroPatagonia,
} from '../../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION } from '../../fixtures/synthetic/finnegansLike.ts';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
} from '../../fixtures/synthetic/identities.ts';
import { escenario, gente, primera, type OpcionesEscenario } from '../reconciliation/helpers.ts';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import {
  huellaRevisionMaestro,
  revisionMaestroImportada,
  revisionTrasEdicion,
} from '../../../src/run/revision';
import { maestroLibro } from '../../fixtures/synthetic/escenarios.ts';

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

type RegistrosFix = Parameters<typeof maestroLibro>[0];

/** Lectura del maestro y huella de su revisión lógica 0 (mecanismo real de F3). */
function huellaDeRegistros(registros: RegistrosFix): Promise<string> {
  const lectura = parseMaestro(maestroLibro(registros, {}));
  return huellaRevisionMaestro(revisionMaestroImportada(lectura));
}

/**
 * Revisión N+1 REAL (FIX 2): atraviesa el pipeline completo
 * {@link revisionMaestroImportada} → {@link revisionTrasEdicion} →
 * {@link huellaRevisionMaestro}, con una edición lógica efectiva (cambia
 * `apellidoNombreRef`, solo referencia humana: nada que el cruce, la identidad o la
 * generación consuman, PAT-2/D-066). No es otra revisión 0 de otro fixture.
 */
async function revisarConEdicion(registros: RegistrosFix) {
  const lectura = parseMaestro(maestroLibro(registros, {}));
  const revision0 = revisionMaestroImportada(lectura);
  const huellaAntes = await huellaRevisionMaestro(revision0);
  const registrosEditados = lectura.registros.map((r) => ({
    ...r,
    apellidoNombreRef: `${r.apellidoNombreRef} · editado`,
  }));
  const resultado = revisionTrasEdicion(revision0, registrosEditados);
  if (!resultado.ok) {
    throw new Error(`la revisión N+1 real fue rechazada: ${resultado.error}`);
  }
  const huellaDespues = await huellaRevisionMaestro(resultado.value);
  return { registrosEditados, huellaAntes, huellaDespues };
}

/** Reconcilia con el puente F3: la huella del maestro es la de la revisión lógica. */
function escenarioF3(
  filas: Parameters<typeof escenario>[0],
  registros: RegistrosFix,
  huellaMaestro: Promise<string>,
  opciones: Omit<OpcionesEscenario, 'huellas'> = {},
): Promise<ResultadoConciliacion> {
  return huellaMaestro.then((huella) =>
    escenario(filas, registros, {
      ...opciones,
      huellas: { finnegans: finnegansRepetida(), maestro: huella },
    }),
  );
}

function finnegansRepetida(): string {
  return 'huella-finnegans-fija';
}

describe('ASIGNAR_DESTINO observa solo Finnegans: sobrevive a la revisión N+1 (D-063)', () => {
  it('la decisión sigue aplicada cuando la revisión lógica del maestro cambia', async () => {
    const filas = [sinBanco(0)];
    const registros = [registroPatagonia(persona(0), random)];
    const antes = await escenarioF3(filas, registros, huellaDeRegistros(registros));
    const decision = decisionAsignarDestino(incidencia(antes, 'BANCO_VACIO'), 'PATAGONIA_B2', {
      id: 'a-1',
      momento: MOMENTO,
    });
    // Revisión N+1 REAL (FIX 2): pipeline completo con edición lógica efectiva
    // (apellidoNombreRef es display-only): el contenido lógico cambia de verdad.
    const { huellaAntes, huellaDespues } = await revisarConEdicion(registros);
    expect(huellaAntes).not.toBe(huellaDespues);
    const despues = await escenarioF3(filas, registros, Promise.resolve(huellaDespues), {
      decisiones: [decision],
    });
    const fila = primera(despues);
    expect(fila.estado.estado).toBe('INCLUIDA');
    expect(despues.decisiones.aplicadas.map((d) => d.id)).toContain('a-1');
  });
});

describe('CONFIRMAR_REVISION que observó el maestro: queda no aplicada en N+1 (D-063)', () => {
  it('LEGAJO_NO_COINCIDE vuelve a REQUIERE_REVISION tras una revisión lógica nueva', async () => {
    const filas = [conLegajo(0, '007'), filaFinnegans(persona(1))];
    const registros = [
      registroBna(persona(0), random, { LEGAJO: '7' }),
      registroBna(persona(1), random),
    ];
    const antes = await escenarioF3(filas, registros, huellaDeRegistros(registros));
    const confirmacion = decisionConfirmarRevision(incidencia(antes, 'LEGAJO_NO_COINCIDE'), {
      id: 'c-1',
      momento: MOMENTO,
    });
    const vigente = await escenarioF3(filas, registros, huellaDeRegistros(registros), {
      decisiones: [confirmacion],
    });
    expect(primera(vigente).nivel).toBe('CORRECTO');
    // Nueva revisión: cambia el CBU del otro registro (valido, otra cuenta); la fila
    // LEGAJO_NO_COINCIDE sigue emparejada con el mismo registro y la misma fila.
    const editados = [
      registroBna(persona(0), random, { LEGAJO: '7' }),
      registroBna(persona(1), random, {
        CBU: syntheticCbu('011', '9999', syntheticCuenta(random)),
      }),
    ] as RegistrosFix;
    const despues = await escenarioF3(filas, editados, huellaDeRegistros(editados), {
      decisiones: [confirmacion],
    });
    expect(primera(despues).nivel).toBe('REQUIERE_REVISION');
    expect(despues.decisiones.noAplicadas).toEqual([
      { decision: confirmacion, motivo: 'DATOS_CAMBIARON' },
    ]);
  });
});

describe('CONFIRMAR_REVISION que observa solo Finnegans: sobrevive a la revisión N+1', () => {
  it('NETO_NO_CUADRA_COMPONENTES sigue aplicada aunque el maestro tenga revisión nueva', async () => {
    const filas = [
      filaFinnegans(persona(0), { Banco: BANCO_NACION, Neto: '1' }),
      filaFinnegans(persona(1)),
    ];
    const registros = [registroBna(persona(1), random)];
    const antes = await escenarioF3(filas, registros, huellaDeRegistros(registros));
    const decision = decisionConfirmarRevision(incidencia(antes, 'NETO_NO_CUADRA_COMPONENTES'), {
      id: 'n-1',
      momento: MOMENTO,
    });
    // Revisión N+1 REAL (FIX 2): pipeline completo con edición lógica efectiva, no una
    // revisión 0 disfrazada; el contenido cambia de verdad y la huella con él.
    const { huellaAntes, huellaDespues } = await revisarConEdicion(registros);
    expect(huellaAntes).not.toBe(huellaDespues);
    const despues = await escenarioF3(filas, registros, Promise.resolve(huellaDespues), {
      decisiones: [decision],
    });
    expect(despues.decisiones.aplicadas.map((d) => d.id)).toContain('n-1');
    expect(despues.decisiones.noAplicadas).toEqual([]);
  });
});
