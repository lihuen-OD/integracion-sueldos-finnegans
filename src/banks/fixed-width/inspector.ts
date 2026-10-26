// Inspector de archivo (T4-9; D-070, D-072). Envoltorio del parser de archivo que observa
// la estructura sin interpretar semántica bancaria: devuelve los registros RAW con sus
// momentos técnicos (línea, offset, ruta de repeticiones). No induce round-trips: el
// inspector solo PARSEA lo que recibe (escribir un archivo para inspeccionarlo es
// decisión de la capa superior usando el serializer). Precondición compartida con
// serializer y parser: la validación técnica `validarFileSpec` (SPEC_INVALIDA sin
// procesar bytes). Actúa con independencia del `status` contractual (D-075): la
// decisión operativa es de la capa superior.

import type { Result } from '../../shared/result';
import type { FileSpec } from './tipos';
import type { ArchivoParseado, ErrorParseoArchivo } from './parserArchivo';
import { parsearArchivo } from './parserArchivo';
import { validarFileSpec } from './validacion';

/**
 * Inspecciona `bytes` contra el FileSpec. Errores idénticos a los del parser de archivo;
 * la validación técnica se repite aquí como contrato propio del inspector.
 */
export function inspeccionarArchivo(
  spec: FileSpec,
  bytes: Uint8Array,
): Result<ArchivoParseado, readonly ErrorParseoArchivo[]> {
  if (!validarFileSpec(spec).ok) {
    return { ok: false, error: [{ codigo: 'SPEC_INVALIDA' }] };
  }
  return parsearArchivo(spec, bytes);
}
