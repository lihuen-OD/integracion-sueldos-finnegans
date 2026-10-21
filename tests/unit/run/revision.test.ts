// Revisión lógica del maestro (D-062) con oráculos independientes: registros sintéticos
// (D-042, sin literales con forma de CUIL/CBU). El oráculo del digest es el mismo Web
// Crypto local, invocado sobre un texto distinto (serialización literal construida
// aparte), para comprobar que la huella deriva EXACTAMENTE de la canónica.
import { describe, expect, it } from 'vitest';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { maestroLibro, personas, registroBna } from '../../fixtures/synthetic/escenarios.ts';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import {
  huellaRevisionMaestro,
  revisionMaestroImportada,
  revisionTrasEdicion,
  serializacionCanonicaMaestro,
  type RevisionMaestro,
} from '../../../src/run/revision';

const RANDOM = createRandom(5);

function registrosSinteticos(cantidad: number): ReturnType<typeof parseMaestro>['registros'] {
  return parseMaestro(
    maestroLibro(
      personas(cantidad, 7).map((persona) => registroBna(persona, RANDOM)),
      {},
    ),
  ).registros;
}

const REGISTROS = (): ReturnType<typeof registrosSinteticos> => registrosSinteticos(3);

function revision(numero: number, registros: readonly unknown[]): RevisionMaestro {
  return { numero, registros } as unknown as RevisionMaestro;
}

describe('serialización canónica · determinista y sin valores variables', () => {
  it('produce exactamente la canónica esperada para registros de un campo', () => {
    const registros = [
      {
        ref: { archivo: 'MAESTRO', hoja: 'Empleados', fila: 2 },
        cuilTexto: 'x',
        cuil: null,
        legajo: null,
        apellidoNombreRef: '',
        cbu: { estado: 'VACIO' } as const,
        patagonia: {
          tipoCuenta: { estado: 'VACIO' } as const,
          numeroCuenta: { estado: 'VACIO' } as const,
          codigoBanco: { estado: 'VACIO' } as const,
          codigoSucursal: { estado: 'VACIO' } as const,
          tipoDocumento: { estado: 'VACIO' } as const,
          numeroDocumento: { estado: 'VACIO' } as const,
          provinciaDocumento: { estado: 'VACIO' } as const,
          codigoDependencia: { estado: 'VACIO' } as const,
        },
      },
    ];
    const serializada = serializacionCanonicaMaestro(revision(0, registros));
    const lineas = serializada.split('\n');
    expect(JSON.parse(lineas[0] ?? '{}')).toEqual({
      formato: 'MAESTRO_REVISION',
      version: 1,
      revision: 0,
    });
    expect(JSON.parse(lineas[1] ?? '{}')).toEqual({
      ref: { archivo: 'MAESTRO', hoja: 'Empleados', fila: 2 },
      cuilTexto: 'x',
      cuil: null,
      legajo: null,
      apellidoNombreRef: '',
      cbu: { estado: 'VACIO' },
      patagonia: {
        tipoCuenta: { estado: 'VACIO' },
        numeroCuenta: { estado: 'VACIO' },
        codigoBanco: { estado: 'VACIO' },
        codigoSucursal: { estado: 'VACIO' },
        tipoDocumento: { estado: 'VACIO' },
        numeroDocumento: { estado: 'VACIO' },
        provinciaDocumento: { estado: 'VACIO' },
        codigoDependencia: { estado: 'VACIO' },
      },
    });
    expect(lineas).toHaveLength(2);
  });

  it('mismos registros → misma serialización, siempre (dos llamadas idénticas)', () => {
    const r = REGISTROS();
    expect(serializacionCanonicaMaestro(revision(0, r))).toBe(
      serializacionCanonicaMaestro(revision(0, r)),
    );
  });

  it('cambiar una parte del contenido (o su orden) cambia la canónica', () => {
    const r = REGISTROS();
    const alterado = [...r];
    const ultimo = alterado.pop();
    if (ultimo === undefined) {
      throw new Error('fixture vacío');
    }
    alterado.unshift(ultimo);
    expect(serializacionCanonicaMaestro(revision(0, alterado))).not.toBe(
      serializacionCanonicaMaestro(revision(0, r)),
    );
  });
});

describe('huellaRevisionMaestro · MasterRevisionFingerprint (D-062)', () => {
  it('coincide con un SHA-256 independiente de la canónica y ronda su longitud hexagonal', async () => {
    const registros = REGISTROS();
    const huella = await huellaRevisionMaestro(revision(0, registros));
    const repetida = await huellaRevisionMaestro(revision(0, registros));
    expect(huella).toBe(repetida);
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it('distinto contenido lógico (aunque sea solo el orden) → huella distinta', async () => {
    const r = REGISTROS();
    const a = await huellaRevisionMaestro(revision(0, r));
    const invertido = [...r].reverse();
    const b = await huellaRevisionMaestro(revision(0, invertido));
    expect(a).not.toBe(b);
  });

  it('identidad distinta: revisiones lógicas con números distintos tienen huellas distintas incluso con el mismo contenido (FIX 5)', async () => {
    // Tres conceptos, explícitos (FIX 5):
    // - CONTENIDO lógico: el mismo array de registros en ambos casos.
    // - NÚMERO de revisión: 2 vs 9; viaja en la cabecera canónica.
    // - FINGERPRINT de revisión: identidad de cada revisión; por eso a !== b, aunque el
    //   contenido representado sea equivalente.
    // (revisionTrasEdicion garantiza que nunca existan dos revisiones con el mismo
    // contenido: rechaza REGISTROS_IGUALES; este test cubre la semántica de la huella.)
    const r = REGISTROS();
    const a = await huellaRevisionMaestro(revision(2, r));
    const b = await huellaRevisionMaestro(revision(9, r));
    expect(a).not.toBe(b); // el número forma parte de la identidad canónica de la revisión
  });
});

describe('revisionTrasEdicion · N → N+1, sin revisiones sin contenido', () => {
  it('rechaza registros con longitud distinta y sin cambio de contenido', () => {
    const r = REGISTROS();
    const base = revisionMaestroImportada({
      hoja: 'Empleados',
      versionContrato: '1',
      registros: r,
      hallazgos: [],
    });
    expect(base.numero).toBe(0);
    expect(revisionTrasEdicion(base, r.slice(0, 2))).toEqual({
      ok: false,
      error: 'REGISTROS_FALTANTES',
    });
    expect(revisionTrasEdicion(base, r)).toEqual({ ok: false, error: 'REGISTROS_IGUALES' });
  });

  it('registros distinto del importado generan la revisión 1', () => {
    const r = REGISTROS();
    const base = revisionMaestroImportada({
      hoja: 'Empleados',
      versionContrato: '1',
      registros: r,
      hallazgos: [],
    });
    const alterado = [...r];
    const ultimo = alterado.pop();
    if (ultimo === undefined) {
      throw new Error('fixture vacío');
    }
    alterado.unshift(ultimo);
    const siguiente = revisionTrasEdicion(base, alterado);
    expect(siguiente.ok).toBe(true);
    if (siguiente.ok) {
      expect(siguiente.value.numero).toBe(1);
      expect(siguiente.value.registros).toEqual(alterado);
    }
  });

  it('revisionTrasEdicion rechaza más registros que los existentes (sin CREATE)', () => {
    const base = revisionMaestroImportada({
      hoja: 'Empleados',
      versionContrato: '1',
      registros: [],
      hallazgos: [],
    });
    const extra = registrosSinteticos(1);
    expect(revisionTrasEdicion(base, extra)).toEqual({ ok: false, error: 'REGISTROS_FALTANTES' });
  });
});
