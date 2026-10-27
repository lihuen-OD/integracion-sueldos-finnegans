// Serialización técnica Patagonia B.2 (CP-F6-C). El mapper produce `EntradaRegistro`;
// la única escritura de bytes se delega a la API pública de F4 (`serializarArchivo`).
// No se importan internals del motor, no se duplican posiciones, padding ni fixed-width.
// La spec se crea con las hipótesis PAT-1/PAT-2/PAT-14 explícitas del llamador; no hay
// defaults, no se escribe en disco y no se construye ningún Blob.
import type { Result } from '../../shared/result';
import { serializarArchivo, type ErrorArchivo } from '../fixed-width';
import { mapearPatagonia, type ErrorMapeoPatagonia } from './mapeo';
import type { PagoPatagonia, ParametrosEnvioPatagonia, PerfilPatagonia } from './modelo';
import type { PoliticaPatagonia } from './politica';
import { crearSpecPatagoniaB2 } from './spec';
import type { TotalesPatagonia } from './totales';

export type ErrorSerializacionPatagonia =
  | ErrorMapeoPatagonia
  | { readonly codigo: 'ERROR_SERIALIZACION'; readonly errores: readonly ErrorArchivo[] };

export interface ArchivoPatagoniaGenerado {
  readonly bytes: Uint8Array;
  readonly totales: TotalesPatagonia;
}

/**
 * Genera los bytes del archivo Patagonia B.2. Cualquier ausencia de resolución, límite
 * excedido o error técnico devuelve error: nunca se devuelve un archivo parcial.
 */
export function serializarPatagonia(
  perfil: PerfilPatagonia,
  parametros: ParametrosEnvioPatagonia,
  pagos: readonly PagoPatagonia[],
  politica: PoliticaPatagonia,
): Result<ArchivoPatagoniaGenerado, readonly ErrorSerializacionPatagonia[]> {
  const mapeo = mapearPatagonia(perfil, parametros, pagos, politica);
  if (!mapeo.ok) {
    return { ok: false, error: mapeo.error };
  }
  const archivo = serializarArchivo(crearSpecPatagoniaB2(parametros), mapeo.value.entradas);
  if (!archivo.ok) {
    return { ok: false, error: [{ codigo: 'ERROR_SERIALIZACION', errores: archivo.error }] };
  }
  return {
    ok: true,
    value: { bytes: archivo.value, totales: mapeo.value.totales },
  };
}
