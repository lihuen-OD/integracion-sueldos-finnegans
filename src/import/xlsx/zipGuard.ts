// Guarda previa a la librería XLSX: valida el contenedor zip y controla tamaños reales
// descomprimidos, para no entregar a ExcelJS archivos que no son XLSX o que se expanden
// de forma desproporcionada.
import { unzipSync } from 'fflate';
import type { ReadError, ReadLimits, Result } from './types';

const REQUIRED_ENTRIES = ['[Content_Types].xml', 'xl/workbook.xml'] as const;

export interface ZipSummary {
  readonly entries: number;
  readonly uncompressedBytes: number;
}

export function inspectZip(bytes: Uint8Array, limits: ReadLimits): Result<ZipSummary, ReadError> {
  if (bytes.byteLength > limits.maxFileBytes) {
    return { ok: false, error: { kind: 'FILE_TOO_LARGE', limitBytes: limits.maxFileBytes } };
  }
  // Firma de entrada local de zip: "PK\x03\x04".
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    return { ok: false, error: { kind: 'NOT_A_ZIP' } };
  }

  let entries = 0;
  let declaredBytes = 0;
  let limitError: ReadError | undefined;
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(bytes, {
      // Primer control con los tamaños declarados, antes de descomprimir cada entrada.
      filter: (file) => {
        entries += 1;
        declaredBytes += file.originalSize;
        if (entries > limits.maxEntries) {
          limitError ??= { kind: 'TOO_MANY_ENTRIES', limit: limits.maxEntries };
          return false;
        }
        if (declaredBytes > limits.maxUncompressedBytes) {
          limitError ??= {
            kind: 'UNCOMPRESSED_TOO_LARGE',
            limitBytes: limits.maxUncompressedBytes,
          };
          return false;
        }
        return limitError === undefined;
      },
    });
  } catch {
    return { ok: false, error: { kind: 'CORRUPT_ZIP' } };
  }
  if (limitError !== undefined) {
    return { ok: false, error: limitError };
  }

  // Segundo control con los tamaños reales obtenidos al descomprimir.
  const uncompressedBytes = Object.values(extracted).reduce(
    (total, data) => total + data.byteLength,
    0,
  );
  if (uncompressedBytes > limits.maxUncompressedBytes) {
    return {
      ok: false,
      error: { kind: 'UNCOMPRESSED_TOO_LARGE', limitBytes: limits.maxUncompressedBytes },
    };
  }
  if (REQUIRED_ENTRIES.some((name) => !(name in extracted))) {
    return { ok: false, error: { kind: 'NOT_XLSX' } };
  }
  return { ok: true, value: { entries, uncompressedBytes } };
}
