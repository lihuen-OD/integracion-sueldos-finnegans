// Serialización técnica BNA (CP-F5-B). El mapper produce `EntradaRegistro`; la única
// escritura de bytes se delega a la API pública de F4 (`serializarArchivo`). No se
// importan internals del motor. La spec se crea con la hipótesis explicita BNA-9 del
// llamador; no hay separador ni trailing por default.
import type { Result } from '../../shared/result';
import { serializarArchivo, type ErrorArchivo } from '../fixed-width';
import { mapearBna, type ErrorMapeoBna } from './mapeo';
import type { PagoBna, ParametrosEnvioBna, PerfilBna } from './modelo';
import type { PoliticaBna } from './politica';
import { crearSpecBna } from './spec';
import type { TotalesBna } from './totales';

export type ErrorSerializacionBna =
  | ErrorMapeoBna
  | { readonly codigo: 'ERROR_SERIALIZACION'; readonly errores: readonly ErrorArchivo[] };

export interface ArchivoBnaGenerado {
  readonly bytes: Uint8Array;
  readonly totales: TotalesBna;
}

/**
 * Genera los bytes del archivo BNA. Cualquier ausencia de resolución, límite excedido o
 * error técnico devuelve error: nunca se serializa parcialmente.
 */
export function serializarBna(
  perfil: PerfilBna,
  parametros: ParametrosEnvioBna,
  pagos: readonly PagoBna[],
  politica: PoliticaBna,
): Result<ArchivoBnaGenerado, readonly ErrorSerializacionBna[]> {
  const mapeo = mapearBna(perfil, parametros, pagos, politica);
  if (!mapeo.ok) {
    return { ok: false, error: mapeo.error };
  }
  const archivo = serializarArchivo(crearSpecBna(parametros), mapeo.value.entradas);
  if (!archivo.ok) {
    return { ok: false, error: [{ codigo: 'ERROR_SERIALIZACION', errores: archivo.error }] };
  }
  return {
    ok: true,
    value: { bytes: archivo.value, totales: mapeo.value.totales },
  };
}
