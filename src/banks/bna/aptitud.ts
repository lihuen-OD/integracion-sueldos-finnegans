// Aptitud contractual BNA (D-075, D-078). No redefine `INTERPRETACION_PENDIENTE` como
// `BLOQUEADA`: los bloqueos se delegan al detector genérico `hallarBloqueosGeneracion`.
// La habilitación depende SOLO de bloqueos B; las interpretaciones pendientes se informan
// por separado y la homologación bancaria permanece pendiente. P-09/P-10 no son
// `ContractStatus` ni se duplican aquí: son incidencias de conciliación por fila.

import type { BloqueoGeneracion, FileSpec } from '../fixed-width';
import { hallarBloqueosGeneracion } from '../fixed-width';
import { IDS_ISSUE_BNA, ISSUES_BNA, type BnaIssueId } from './contrato';

export interface AptitudBna {
  /** Bloqueos B determinados por el motor F4 (separadores y campos). */
  readonly bloqueos: readonly BloqueoGeneracion[];
  /** Issues I de BNA que afectan bytes; NO se convierten en bloqueos. */
  readonly interpretacionesByte: readonly BnaIssueId[];
  /** Issues I de BNA documentadas que no afectan bytes. */
  readonly interpretacionesSinBytes: readonly BnaIssueId[];
  /** Compatible con readiness: solo un bloqueo B impide habilitar el generador. */
  readonly generadorHabilitado: boolean;
  /** La capacidad técnica nunca equivale a aceptación bancaria (D-075). */
  readonly homologacion: 'PENDIENTE_DE_HOMOLOGACION';
}

export function aptitudBna(spec: FileSpec): AptitudBna {
  const bloqueos = hallarBloqueosGeneracion(spec);
  const interpretacionesByte = IDS_ISSUE_BNA.filter(
    (id) => ISSUES_BNA[id].estado === 'INTERPRETACION_PENDIENTE' && ISSUES_BNA[id].afectaBytes,
  );
  const interpretacionesSinBytes = IDS_ISSUE_BNA.filter(
    (id) => ISSUES_BNA[id].estado === 'INTERPRETACION_PENDIENTE' && !ISSUES_BNA[id].afectaBytes,
  );
  return {
    bloqueos,
    interpretacionesByte,
    interpretacionesSinBytes,
    generadorHabilitado: bloqueos.length === 0,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
}
