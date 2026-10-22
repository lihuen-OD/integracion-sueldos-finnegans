import { describe, expect, it } from 'vitest';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { registroBna, maestroLibro } from '../../fixtures/synthetic/escenarios.ts';
import { gente } from '../reconciliation/helpers.ts';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import {
  conFinnegans,
  conMaestro,
  conRevisionMaestro,
  nuevaCorrida,
} from '../../../src/run/corrida';
import { huellasConciliacionDelEstado } from '../../../src/run/puente';
import { huellaRevisionMaestro, revisionTrasEdicion } from '../../../src/run/revision';
import type { LecturaFinnegans } from '../../../src/domain/liquidacion';

const persona = gente(8, 41);
const random = createRandom(41);
const finnegans = {
  hoja: 'Liquidación de Sueldos',
  visibilidadHoja: null,
  lineas: [],
  hallazgos: [],
} satisfies LecturaFinnegans;

function estadoConMaestro(registros: Parameters<typeof maestroLibro>[0]) {
  const lectura = parseMaestro(maestroLibro(registros, {}));
  // Huellas de archivo distintas por entrada: son FileFingerprints, no la huella de
  // revisión (FIX 3: FileFingerprint ≠ MasterRevisionFingerprint).
  return conMaestro(
    conFinnegans(nuevaCorrida(), finnegans, 'h-archivo-finnegans'),
    lectura,
    'h-archivo-maestro',
  );
}

describe('huellasConciliacionDelEstado · puente productivo F3 → F2 (FIX 3)', () => {
  it('arma las huellas del Observado: FileFingerprint de Finnegans + fingerprint de la revisión vigente', async () => {
    const estado = estadoConMaestro([registroBna(persona(0), random)]);
    const resultado = await huellasConciliacionDelEstado(estado);
    if (!resultado.ok) {
      throw new Error(resultado.error);
    }
    expect(resultado.value.finnegans).toBe('h-archivo-finnegans');
    const revision0Primero = estado.maestroRevision;
    if (revision0Primero === null) {
      throw new Error('la revision no quedó registrada');
    }
    expect(resultado.value.maestro).toBe(await huellaRevisionMaestro(revision0Primero));
  });

  it('tras un UPDATE válido devuelve la huella de la revisión nueva sin intervención de la UI', async () => {
    const estado = estadoConMaestro([registroBna(persona(0), random)]);
    const antes = await huellasConciliacionDelEstado(estado);
    if (!antes.ok) {
      throw new Error(antes.error);
    }
    const revision0 = estado.maestroRevision;
    if (revision0 === null) {
      throw new Error('la revision no quedó registrada');
    }
    const registrosEditados = revision0.registros.map((r) => ({
      ...r,
      apellidoNombreRef: `${r.apellidoNombreRef} · editado`,
    }));
    const revision1 = revisionTrasEdicion(revision0, registrosEditados);
    if (!revision1.ok) {
      throw new Error(revision1.error);
    }
    const despues = await huellasConciliacionDelEstado(conRevisionMaestro(estado, revision1.value));
    if (!despues.ok) {
      throw new Error(despues.error);
    }
    // La huella del puente.es la de la REVISIÓN, no la del archivo: la de archivo del
    // maestro (`h-archivo-maestro`) queda al margen en ambos momentos.
    expect(antes.value.maestro).not.toBe('h-archivo-maestro');
    expect(despues.value.finnegans).toBe(antes.value.finnegans);
    expect(despues.value.maestro).not.toBe(antes.value.maestro);
  });

  it('rechaza correr sin los archivos cargados', async () => {
    const lectura = parseMaestro(maestroLibro([registroBna(persona(0), random)], {}));
    const sinFinnegans = conMaestro(nuevaCorrida(), lectura, 'h-m');
    expect(await huellasConciliacionDelEstado(sinFinnegans)).toEqual({
      ok: false,
      error: 'FINNEGANS_AUSENTE',
    });
    const sinMaestro = conFinnegans(nuevaCorrida(), finnegans, 'h-f');
    expect(await huellasConciliacionDelEstado(sinMaestro)).toEqual({
      ok: false,
      error: 'MAESTRO_AUSENTE',
    });
    expect(await huellasConciliacionDelEstado(nuevaCorrida())).toEqual({
      ok: false,
      error: 'FINNEGANS_AUSENTE',
    });
  });
});
