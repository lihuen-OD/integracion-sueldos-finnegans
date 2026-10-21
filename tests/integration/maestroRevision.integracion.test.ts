// Integración CP-F3-C (correctivo de auditoría): revisión 0 → edición válida → revisión 1
// → conciliarCorrida() → segunda edición válida → revisión 2 → conciliarCorrida(). La
// conciliación siempre observa la REVISIÓN VIGENTE a través de lecturaMaestroVigente()
// → estado.maestroRevision.registros → conciliar() (sin caminos alternativos) y
// estado.maestro.registros sigue representando el archivo original (D-062/D-063).
// Datos 100 % sintéticos (D-042).
import { describe, expect, it } from 'vitest';
import { parseFinnegans } from '../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../src/import/master/parseMaestro';
import { readWorkbook } from '../../src/import/xlsx';
import { conFinnegans, conMaestro, nuevaCorrida, type EstadoCorrida } from '../../src/run/corrida';
import { editarMaestro } from '../../src/run/edicionMaestro';
import { conciliarCorrida } from '../../src/ui/orquestacion';
import {
  filaFinnegans,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroBna,
  type RegistroMaestro,
} from '../fixtures/synthetic/escenarios.ts';
import { createRandom, syntheticCbu, syntheticCuenta } from '../fixtures/synthetic/identities.ts';

const NACION = 'BANCO DE LA NACION ARGENTINA';

/** Lecturas sintéticas reales de archivo (mismo pipeline que el navegador). */
async function correrPar(): Promise<EstadoCorrida> {
  const random = createRandom(675);
  const [una, dos] = personas(2, 675);
  if (una === undefined || dos === undefined) {
    throw new Error('personas esperadas');
  }
  const registrosMaestro: RegistroMaestro[] = [registroBna(una, random), registroBna(dos, random)];
  const [libroF, libroM] = await Promise.all([
    readWorkbook(
      finnegansXlsx([filaFinnegans(una, { Banco: NACION }), filaFinnegans(dos, { Banco: NACION })]),
    ),
    readWorkbook(maestroXlsx(registrosMaestro)),
  ]);
  if (!libroF.ok || !libroM.ok) {
    throw new Error('fixtures ilegibles');
  }
  return conMaestro(
    conFinnegans(nuevaCorrida(), parseFinnegans(libroF.value), 'huella-finnegans-sintetica'),
    parseMaestro(libroM.value),
    'huella-maestro-sintetica',
  );
}

const bloqueoBanco = (incidencias: readonly { codigo: string }[]): boolean =>
  incidencias.some((i) => i.codigo === 'BANCO_INCOMPATIBLE_MAESTRO');

describe('revisión 0 → 1 → 2 usada por la conciliación (lecturaMaestroVigente)', () => {
  it('revisión 0: sin bloqueo de banco incompatible y archivo original como vigente', async () => {
    const estado = await correrPar();
    expect(estado.maestroRevision?.numero).toBe(0);
    const r = await conciliarCorrida(estado);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(bloqueoBanco(r.value.incidencias)).toBe(false);
    }
  });

  it('revisión 1: CBU a otra entidad → la conciliación observa el valor editado (bloqueo BNA)', async () => {
    const estado = await correrPar();
    const registro0 = estado.maestro?.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    const editado = editarMaestro(
      estado,
      registro0,
      'CBU',
      syntheticCbu('028', '0521', syntheticCuenta(createRandom(676))),
    );
    expect(editado.ok).toBe(true);
    if (!editado.ok) {
      throw new Error('edición de prueba falló'); // ok: guarda el error del runtime
    }
    const estado1 = editado.value.estado;
    expect(estado1.maestroRevision?.numero).toBe(1);
    const r = await conciliarCorrida(estado1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(bloqueoBanco(r.value.incidencias)).toBe(true);
    }
    // el archivo original NO cambia (D-062)
    expect(estado1.maestro?.registros).toEqual(estado.maestro?.registros);
  });

  it('revisión 2: segunda edición vuelve a entidad 011 → la conciliación observa la revisión 2', async () => {
    const estado = await correrPar();
    const registro0 = estado.maestro?.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    const primera = editarMaestro(
      estado,
      registro0,
      'CBU',
      syntheticCbu('028', '0521', syntheticCuenta(createRandom(676))),
    );
    expect(primera.ok).toBe(true);
    if (!primera.ok) {
      throw new Error('edición de prueba falló');
    }
    const estado1 = primera.value.estado;
    const registro1 = estado1.maestroRevision?.registros[0];
    if (registro1 === undefined) {
      throw new Error('fixture vacío');
    }
    const segunda = editarMaestro(
      estado1,
      registro1,
      'CBU',
      syntheticCbu('011', '0521', syntheticCuenta(createRandom(677))),
    );
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) {
      throw new Error('edición de prueba falló');
    }
    const estado2 = segunda.value.estado;
    expect(estado2.maestroRevision?.numero).toBe(2);
    const r = await conciliarCorrida(estado2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // la conciliación usa los registros de la revisión 2 (importeds se usan del FIX 1)
      expect(bloqueoBanco(r.value.incidencias)).toBe(false);
    }
    // El archivo original sigue representando el archivo original en la corrida
    expect(estado2.maestro?.registros).toEqual(estado.maestro?.registros);
    expect(estado2.maestro?.registros).toBeDefined();
  });
});
