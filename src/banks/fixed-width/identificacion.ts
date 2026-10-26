// Identificación de RecordSpec en runtime (D-070). Los discriminadores se derivan de TODOS
// los campos con `fixedValue` (no existe un matcher adicional). Orden aprobado:
// 1) filtrar candidatos por recordLength; 2) comparar discriminadores byte a byte;
// 3) 0 → REGISTRO_DESCONOCIDO; 4) 1 → identificado; 5) >1 → REGISTRO_AMBIGUO (defensa en
// profundidad: la validación estática debe impedir la ambigüedad antes de llegar aquí).

import type { Result } from '../../shared/result';
import type { RecordSpec } from './tipos';

export type ErrorIdentificacion =
  | { readonly codigo: 'REGISTRO_DESCONOCIDO' }
  | { readonly codigo: 'REGISTRO_AMBIGUO'; readonly registros: readonly string[] };

/**
 * Coincidencia byte a byte del discriminador (todos los `fixedValue`) contra el registro.
 * No compara ids ni valores completos: solo las posiciones restringidas por la spec.
 * La lectura se recorta al buffer real ante specs sin validar (defensa, no semántica).
 */
function discriminadorCoincide(registro: RecordSpec, bytes: Uint8Array): boolean {
  let camposFijos = 0;
  for (const campo of registro.fields) {
    if (campo.fixedValue === undefined) {
      continue;
    }
    camposFijos += 1;
    const desde = Math.max(0, campo.start - 1);
    const hasta = Math.min(campo.end, bytes.length);
    const largo = Math.min(campo.end - campo.start + 1, hasta - desde);
    for (let p = 0; p < largo; p += 1) {
      if (bytes[desde + p] !== campo.fixedValue.charCodeAt(p)) {
        return false;
      }
    }
  }
  // Sin campos fijos no hay discriminador: no puede dar "coincidencia" vacía.
  return camposFijos > 0;
}

/**
 * Identifica un registro por bytes contra una lista de RecordSpec. Filtra primero por
 * longitud y solo entonces evalúa discriminadores. Los errores no contienen contenido.
 */
export function identificarRegistro(
  registros: readonly RecordSpec[],
  bytes: Uint8Array,
): Result<RecordSpec, ErrorIdentificacion> {
  const candidatos = registros.filter((registro) => registro.recordLength === bytes.length);
  const coincidentes = candidatos.filter((registro) => discriminadorCoincide(registro, bytes));
  const [identificado, segundo] = coincidentes;
  if (identificado === undefined) {
    return { ok: false, error: { codigo: 'REGISTRO_DESCONOCIDO' } };
  }
  if (segundo !== undefined) {
    return {
      ok: false,
      error: { codigo: 'REGISTRO_AMBIGUO', registros: coincidentes.map((r) => r.id) },
    };
  }
  return { ok: true, value: identificado };
}
