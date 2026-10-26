// Aptitud de generación (T4-10; D-075). `hallarBloqueosGeneracion` es el ÚNICO componente
// del motor que interpreta `ContractStatus`: lista los separadores y campos con estado
// `BLOQUEADA` para que la capa superior decida la política de habilitación. Un estado
// `CONFIRMADA` NO se lista; `INTERPRETACION_PENDIENTE` NO bloquea productivamente (solo
// mantiene la salida PENDIENTE DE HOMOLOGACION) y NO se informa acá. La validez técnica
// (geometría, cobertura, discriminadores, estructura) no interviene: la aptitud es solo
// contractual (D-075). Determinista en el orden de la spec: lineSeparator,
// trailingSeparator y luego los campos de cada RecordSpec en su orden declarativo.

import type { FileSpec } from './tipos';

export type BloqueoGeneracion =
  | { readonly tipo: 'lineSeparator' }
  | { readonly tipo: 'trailingSeparator' }
  | { readonly tipo: 'campo'; readonly registroId: string; readonly campoId: string };

/**
 * Lista los bloqueos productivos de la spec: la posición 1 del arreglo es el
 * lineSeparator, la 2 el trailingSeparator y después los campos BLOQUEADA por caja.
 * Determinista; sin duplicados (el objeto es inmutable; no hay duplicados).
 */
export function hallarBloqueosGeneracion(spec: FileSpec): readonly BloqueoGeneracion[] {
  const extras: BloqueoGeneracion[] = [];
  if (spec.lineSeparator.status === 'BLOQUEADA') {
    extras.push({ tipo: 'lineSeparator' });
  }
  if (spec.trailingSeparator.status === 'BLOQUEADA') {
    extras.push({ tipo: 'trailingSeparator' });
  }
  const deCampos: BloqueoGeneracion[] = [];
  for (const registro of spec.records) {
    for (const campo of registro.fields) {
      if (campo.status === 'BLOQUEADA') {
        deCampos.push({ tipo: 'campo', registroId: registro.id, campoId: campo.id });
      }
    }
  }
  return [...extras, ...deCampos];
}
