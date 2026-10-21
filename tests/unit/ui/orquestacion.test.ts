// @vitest-environment jsdom
// Pruebas de la orquestación centralizada CP-F3-B: la UI delega TODA la interacción con el
// motor F2 en estos helpers (huellas por el puente productivo, registros de la revisión
// vigente). Fixtures 100% sintéticos (D-042).
import { describe, expect, it } from 'vitest';
import {
  espejoMuestra,
  finnegansXlsx,
  maestroLibro,
  maestroXlsx,
} from '../../fixtures/synthetic/escenarios';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import { calcularHuella } from '../../../src/import/huella';
import type { Workbook } from '../../../src/import/xlsx';
import type { LecturaFinnegans } from '../../../src/domain/liquidacion';
import {
  conciliarCorrida,
  lecturaMaestroVigente,
  mensajeErrorArchivo,
  proximoIdDecision,
} from '../../../src/ui/orquestacion';
import { conFinnegans, conMaestro, nuevaCorrida } from '../../../src/run/corrida';
import type { EstadoCorrida } from '../../../src/run/corrida';
import { revisionTrasEdicion } from '../../../src/run/revision';
import type { DecisionOperador } from '../../../src/reconciliation';

const finnegansVacio: LecturaFinnegans = {
  hoja: 'hoja1',
  visibilidadHoja: 'visible',
  lineas: [],
  hallazgos: [],
};

describe('mensajeErrorArchivo · traducción legible y sin datos', () => {
  it('cubre todos los códigos de error XLSX con textos humanos', () => {
    const casos = [
      [{ kind: 'FILE_TOO_LARGE' }, ['El archivo supera el tamaño máximo permitido.']],
      [{ kind: 'NOT_A_ZIP' }, ['El archivo no es un XLSX válido.']],
      [{ kind: 'NOT_XLSX' }, ['El archivo no es un XLSX válido.']],
      [{ kind: 'CORRUPT_ZIP' }, ['El archivo no es un XLSX válido.']],
      [{ kind: 'TOO_MANY_ENTRIES' }, ['El archivo es demasiado grande al descomprimirse.']],
      [{ kind: 'UNCOMPRESSED_TOO_LARGE' }, ['El archivo es demasiado grande al descomprimirse.']],
      [{ kind: 'PARSE_FAILED' }, ['No se pudo interpretar el contenido del XLSX.']],
      [{ kind: 'TOO_MANY_ROWS', sheet: 'hoja1', limit: 100 }, ['hoja1', '100']],
      [{ kind: 'TOO_MANY_COLUMNS', sheet: 'hoja1', limit: 30 }, ['hoja1', '30']],
    ] as const;
    for (const [error, fragmentos] of casos) {
      // @ts-expect-error: los objetos son dobles con la forma mínima necesaria.
      const mensaje = mensajeErrorArchivo(error);
      for (const fragmento of fragmentos) {
        expect(mensaje).toContain(fragmento);
      }
    }
  });
});

describe('lecturaMaestroVigente · usa los registros de la REVISIÓN (no los del archivo)', () => {
  it('sin revisión no hay lectura vigente', () => {
    const estado = conFinnegans(nuevaCorrida(), finnegansVacio, 'h-f');
    expect(lecturaMaestroVigente(estado)).toBeNull();
  });

  it('con la revisión 0: metadatos del archivo + registros de la revisión', () => {
    const muestra = espejoMuestra();
    const lectura = parseMaestro(maestroLibro(muestra.registros, {}));
    const base = conMaestro(nuevaCorrida(), lectura, 'h-m');
    const vigente = lecturaMaestroVigente(base);
    if (vigente === null || base.maestroRevision === null) {
      throw new Error('la revisión 0 debía estar registrada');
    }
    expect(vigente.registros).toBe(base.maestroRevision.registros);
    expect(vigente.hoja).toBe(lectura.hoja);
    expect(vigente.versionContrato).toBe(lectura.versionContrato);
  });

  it('tras un UPDATE válido: los registros vienen de la revisión, no del archivo', () => {
    const muestra = espejoMuestra();
    const lectura = parseMaestro(maestroLibro(muestra.registros, {}));
    const base = conMaestro(nuevaCorrida(), lectura, 'h-m');
    const revision0 = base.maestroRevision;
    if (revision0 === null) {
      throw new Error('la revisión 0 debía estar registrada');
    }
    const [primero] = revision0.registros;
    if (primero === undefined) {
      throw new Error('necesito al menos un registro');
    }
    const editadaReal = revisionTrasEdicion(revision0, [
      { ...primero, apellidoNombreRef: `${primero.apellidoNombreRef} · actualizado` },
      ...revision0.registros.slice(1),
    ]);
    if (!editadaReal.ok) {
      throw new Error(`revisión real rechazada: ${editadaReal.error}`);
    }
    const estadoEditado = { ...base, maestroRevision: editadaReal.value };
    const vigente = lecturaMaestroVigente(estadoEditado);
    if (vigente === null) {
      throw new Error('debe haber lectura vigente');
    }
    expect(vigente.registros[0]?.apellidoNombreRef).toContain('actualizado');
    // El archivo original quedó intacto.
    expect(base.maestro?.registros[0]?.apellidoNombreRef.endsWith('actualizado')).toBe(false);
  });
});

describe('conciliarCorrida · borde F3 → F2 único', () => {
  it('exige ambos archivos cargados con mensajes distintos', async () => {
    const muestra = espejoMuestra();
    const sinFinnegans = conMaestro(
      nuevaCorrida(),
      parseMaestro(maestroLibro(muestra.registros, {})),
      'h-m',
    );
    expect(await conciliarCorrida(sinFinnegans)).toEqual({ ok: false, error: 'FINNEGANS_AUSENTE' });
    const sinMaestro = conFinnegans(nuevaCorrida(), finnegansVacio, 'h-f');
    expect(await conciliarCorrida(sinMaestro)).toEqual({ ok: false, error: 'MAESTRO_AUSENTE' });
  });

  it('concilia una corrida construida por el camino real y produce un resultado completo', async () => {
    const muestra = espejoMuestra();
    const bytesFinnegans = finnegansXlsx(muestra.filas);
    const bytesMaestro = maestroXlsx(muestra.registros);
    const estado = conMaestro(
      conFinnegans(
        nuevaCorrida(),
        parseFinnegans(await leerLibro(bytesFinnegans)),
        await calcularHuella(bytesFinnegans),
      ),
      parseMaestro(await leerLibro(bytesMaestro)),
      await calcularHuella(bytesMaestro),
    );
    const resultado = await conciliarCorrida(estado);
    if (!resultado.ok) {
      throw new Error(resultado.error);
    }
    expect(resultado.value.filas).toHaveLength(muestra.filas.length);
    expect(resultado.value.global.finnegans.cantidad).toBe(muestra.filas.length);
    // espejoMuestra incluye una fila con banco vacío: queda pendiente hasta decisión.
    expect(resultado.value.filas.some((f) => f.estado.estado === 'PENDIENTE')).toBe(true);
  });
});

function conDecisionFalsa(estado: EstadoCorrida): EstadoCorrida {
  const falsa: DecisionOperador = {
    id: 'd-0',
    incidenciaId: 'inc',
    tipo: 'CONFIRMAR_REVISION',
    momento: '2010-01-01T00:00:00Z',
    refs: [],
    observado: { cuilTexto: '', valores: {}, huellas: {} },
  };
  return { ...estado, decisiones: [...estado.decisiones, falsa] };
}

describe('proximoIdDecision · ids deterministas dentro de la corrida', () => {
  it('arranca en d-1 y crece con cada decisión', () => {
    expect(proximoIdDecision(nuevaCorrida())).toBe('d-1');
    expect(proximoIdDecision(conDecisionFalsa(nuevaCorrida()))).toBe('d-2');
  });
});

/** Helper del test: lectura del mismo adaptador que usa la app (carga diferida). */
async function leerLibro(bytes: Uint8Array): Promise<Workbook> {
  const xlsx = await import('../../../src/import/xlsx');
  const leido = await xlsx.readWorkbook(bytes);
  if (!leido.ok) {
    throw new Error(leido.error.kind);
  }
  return leido.value;
}
