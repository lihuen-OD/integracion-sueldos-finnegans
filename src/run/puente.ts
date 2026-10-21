// Puente puro F3 → F2 (FIX 3): el único lugar donde una corrida en curso alimenta a la
// conciliación de F2. La UI nunca construye las huellas del `Observado` a mano. Por
// diseño (D-062, P-29.3) el `FileFingerprint` del archivo Finnegans (huella SHA-256 del
// ARCHIVO observado) y la `MasterRevisionFingerprint` de la revisión lógica vigente son
// conceptos DISTINTOS: el puente usa cada uno donde corresponde — finnegans desde la
// huella de archivo guardada por `conFinnegans`, maestro desde
// `huellaRevisionMaestro(estado.maestroRevision)`. Este módulo no redefine huellas de
// archivo, no mueve lógica de negocio de F2 y no duplica reconciliation.
import type { Result } from '../shared/result';
import type { EstadoCorrida } from './corrida';
import { huellaRevisionMaestro } from './revision';

/**
 * Huellas para el `Observado` de F2 durante la conciliación de la revisión lógica
 * vigente: `finnegans` es el `FileFingerprint` del archivo Finnegans; `maestro` es la
 * `MasterRevisionFingerprint` de `estado.maestroRevision`.
 */
export interface HuellasConciliacion {
  readonly finnegans: string;
  readonly maestro: string;
}

export type ErrorHuellasConciliacion = 'FINNEGANS_AUSENTE' | 'MAESTRO_AUSENTE';

/**
 * Huellas del `Observado` para conciliar con el estado actual de la corrida. Llamarla de
 * nuevo tras un UPDATE válido devuelve la huella de la revisión nueva (contenido
 * distinto ⇒ huella distinta por diseño): la UI no participa en ese cálculo.
 */
export async function huellasConciliacionDelEstado(
  estado: EstadoCorrida,
): Promise<Result<HuellasConciliacion, ErrorHuellasConciliacion>> {
  if (estado.finnegans === null || estado.huellaFinnegans === null) {
    return { ok: false, error: 'FINNEGANS_AUSENTE' };
  }
  if (estado.maestroRevision === null) {
    return { ok: false, error: 'MAESTRO_AUSENTE' };
  }
  return {
    ok: true,
    value: {
      finnegans: estado.huellaFinnegans,
      maestro: await huellaRevisionMaestro(estado.maestroRevision),
    },
  };
}
