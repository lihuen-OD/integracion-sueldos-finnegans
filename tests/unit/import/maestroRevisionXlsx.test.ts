// T3-12/D-066: round-trip del maestro exportado. La revisión vigente exportada a XLSX se
// reimporta con el parseador EXACTO de F2 (parseMaestro) y debe reproducir la misma
// representación lógica (texto tal cual, sin reinterpretar celdas). Datos sintéticos; el
// nombre del archivo solo se usa al descargar (sin storage ni red).
import { describe, expect, it } from 'vitest';
import { generarMaestroEditado, nombreMaestroEditado } from '../../../src/import/master/maestroRevisionXlsx';
import { readWorkbook } from '../../../src/import/xlsx';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import { maestroLibro, personas, registroPatagonia } from '../../fixtures/synthetic/escenarios.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { actualizarCampoBancario, CAMPOS_EDITABLES_MAESTRO } from '../../../src/domain/maestro';
import { revisionMaestroImportada, revisionTrasEdicion } from '../../../src/run/revision';

const RANDOM = createRandom(11);

describe('exportar maestro editado → round-trip con parseMaestro (T3-12)', () => {
  it('la revisión 1 exportada revive idéntica al reimportarse (texto tal cual)', async () => {
    const lectura = parseMaestro(
      maestroLibro(personas(3, 13).map((persona) => registroPatagonia(persona, RANDOM)), {}),
    );
    const revision0 = revisionMaestroImportada(lectura);
    const primero = lectura.registros[0];
    if (primero === undefined) {
      throw new Error('fixture vacío');
    }
    const editado = actualizarCampoBancario(primero, 'PAT_TIPO_CUENTA', '1');
    expect(editado.ok).toBe(true);
    if (!editado.ok) {
      throw new Error('la edición de prueba falló');
    }
    const registros = [...lectura.registros];
    registros[0] = editado.registro;
    const revision1 = revisionTrasEdicion(revision0, registros);
    expect(revision1.ok).toBe(true);
    if (!revision1.ok) {
      throw new Error('la revisión 1 de prueba fue rechazada');
    }

    const bytes = await generarMaestroEditado(revision1.value, '2026-10-21');
    expect(bytes.length).toBeGreaterThan(0);
    const libro = await readWorkbook(bytes);
    if (!libro.ok) {
      throw new Error('el libro exportado no relee: ' + libro.error.kind);
    }
    const reimportado = parseMaestro(libro.value);
    expect(reimportado.versionContrato).toBe('1');
    expect(reimportado.registros).toEqual(revision1.value.registros);
  });
});

describe('nombreMaestroEditado', () => {
  it('lleva fecha y revision, y valida el formato AAAA-MM-DD de la fecha', () => {
    expect(nombreMaestroEditado('2026-10-21', 2)).toBe(
      'MAESTRO_CUENTAS_EMPLEADOS_2026-10-21_editado_r2.xlsx',
    );
    expect(() => nombreMaestroEditado('21/10/2026', 1)).toThrow(RangeError);
  });
});

describe('CAMPOS_EDITABLES_MAESTRO declara la superficie editable (D-066)', () => {
  it('son exactamente los 8 campos por banco, sin identidad ni dependencia', () => {
    expect(CAMPOS_EDITABLES_MAESTRO).toHaveLength(8);
  });
});
