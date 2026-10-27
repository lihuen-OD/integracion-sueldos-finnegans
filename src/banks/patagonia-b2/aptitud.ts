// Aptitud contractual Patagonia B.2 (F6, CP-F6-A; D-075/D-078).
// Inspecciona SOLO la spec/contrato: no evalúa conciliación, P-09/P-10, datos de empleado,
// readiness, perfil cargado ni parámetros de corrida. Una interpretación pendiente NO se
// convierte en bloqueo: solo PAT-1 y PAT-2 (BLOQUEADA) impiden habilitar el generador.

import type { BloqueoGeneracion, FileSpec } from '../fixed-width';
import { hallarBloqueosGeneracion } from '../fixed-width';
import { IDS_ISSUE_PATAGONIA, ISSUES_PATAGONIA, type PatagoniaIssueId } from './contrato';

export interface AptitudPatagonia {
  readonly bloqueos: readonly BloqueoGeneracion[];
  readonly interpretacionesByte: readonly PatagoniaIssueId[];
  readonly interpretacionesSinBytes: readonly PatagoniaIssueId[];
  readonly generadorHabilitado: boolean;
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
