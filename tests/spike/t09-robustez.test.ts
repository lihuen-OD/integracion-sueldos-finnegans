import { describe, expect, it } from 'vitest';
import { DEFAULT_READ_LIMITS, readWorkbook, type ReadLimits } from '../../src/import/xlsx';
import {
  inflatedXlsx,
  malformedXlsx,
  notAZip,
  zipWithoutWorkbook,
} from '../fixtures/synthetic/edgeCases.ts';
import { buildFinnegansLike } from '../fixtures/synthetic/finnegansLike.ts';

const finnegans = buildFinnegansLike();

function limits(overrides: Partial<ReadLimits>): ReadLimits {
  return { ...DEFAULT_READ_LIMITS, ...overrides };
}

async function errorKind(bytes: Uint8Array, readLimits?: ReadLimits): Promise<string> {
  const start = performance.now();
  const result = await readWorkbook(bytes, readLimits);
  // Ningún caso inválido debe colgar la lectura.
  expect(performance.now() - start).toBeLessThan(2000);
  if (result.ok) {
    return 'OK';
  }
  // Los errores nunca incluyen contenido de celdas.
  const serialized = JSON.stringify(result.error);
  for (const row of finnegans.rows.slice(0, 5)) {
    expect(serialized).not.toContain(row.cuil);
  }
  return result.error.kind;
}

describe('T9 · robustez ante archivos inválidos o excesivos', () => {
  it.each([
    ['archivo que no es zip', () => notAZip(), undefined, 'NOT_A_ZIP'],
    ['zip sin libro de Excel', () => zipWithoutWorkbook(), undefined, 'NOT_XLSX'],
    [
      'zip truncado',
      () => finnegans.bytes.slice(0, Math.floor(finnegans.bytes.byteLength / 2)),
      undefined,
      'CORRUPT_ZIP',
    ],
    ['XML del libro malformado', () => malformedXlsx(), undefined, 'PARSE_FAILED'],
    [
      'archivo mayor al límite',
      () => finnegans.bytes,
      limits({ maxFileBytes: 1000 }),
      'FILE_TOO_LARGE',
    ],
    [
      'contenido que se expande más del límite',
      () => inflatedXlsx(2 * 1024 * 1024),
      limits({ maxUncompressedBytes: 1024 * 1024 }),
      'UNCOMPRESSED_TOO_LARGE',
    ],
    [
      'demasiadas entradas en el zip',
      () => finnegans.bytes,
      limits({ maxEntries: 5 }),
      'TOO_MANY_ENTRIES',
    ],
    ['demasiadas filas', () => finnegans.bytes, limits({ maxRowsPerSheet: 100 }), 'TOO_MANY_ROWS'],
    ['demasiadas columnas', () => finnegans.bytes, limits({ maxColumns: 10 }), 'TOO_MANY_COLUMNS'],
  ] as const)('%s → %s', async (_name, build, readLimits, expected) => {
    expect(await errorKind(build(), readLimits)).toBe(expected);
  });

  it('el archivo válido se lee con los límites por defecto', async () => {
    expect(await errorKind(finnegans.bytes)).toBe('OK');
  });
});
