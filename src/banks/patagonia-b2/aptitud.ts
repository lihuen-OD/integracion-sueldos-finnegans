// Aptitud contractual Patagonia B.2 (F6, CP-F6-A; D-075/D-078).
// Inspecciona SOLO la spec/contrato: no evalúa conciliación, P-09/P-10, datos de empleado,
// readiness, perfil cargado ni parámetros de corrida. Una interpretación pendiente NO se
// convierte en bloqueo: solo los issues BLOQUEADA impiden habilitar el generador. PAT-1
// quedó CONFIRMADA para ESPACIOS en PC-01 y PAT-2 para ALFANUMERICA en PC-02. Las
// hipótesis históricas CEROS y NUMERICA mantienen su campo BLOQUEADO y, por lo tanto,
// también bloquean el generador. La producción sigue cerrada por `autorizacion.ts`.

import type { BloqueoGeneracion, FileSpec } from '../fixed-width';
import { hallarBloqueosGeneracion } from '../fixed-width';
import { IDS_ISSUE_PATAGONIA, ISSUES_PATAGONIA, type PatagoniaIssueId } from './contrato';

export interface AptitudPatagonia {
  readonly bloqueos: readonly BloqueoGeneracion[];
  readonly interpretacionesByte: readonly PatagoniaIssueId[];
  readonly interpretacionesSinBytes: readonly PatagoniaIssueId[];
  readonly generadorHabilitado: boolean;
  /**
   * Espejo documental del contrato. NO es la autorización de producción: la
   * compuerta autoritativa vive en `autorizacion.ts` y no se deriva de acá.
   */
  readonly homologacion: 'PENDIENTE_DE_HOMOLOGACION';
}

export function aptitudPatagonia(spec: FileSpec): AptitudPatagonia {
  const bloqueos = hallarBloqueosGeneracion(spec);
  const interpretacionesByte = IDS_ISSUE_PATAGONIA.filter(
    (id) =>
      ISSUES_PATAGONIA[id].estado === 'INTERPRETACION_PENDIENTE' &&
      ISSUES_PATAGONIA[id].afectaBytes,
  );
  const interpretacionesSinBytes = IDS_ISSUE_PATAGONIA.filter(
    (id) =>
      ISSUES_PATAGONIA[id].estado === 'INTERPRETACION_PENDIENTE' &&
      !ISSUES_PATAGONIA[id].afectaBytes,
  );

  return {
    bloqueos,
    interpretacionesByte,
    interpretacionesSinBytes,
    generadorHabilitado: bloqueos.length === 0,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
}
