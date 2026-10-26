// Contrato documental BNA GT Haberes (F5; docs/04). Este módulo NO genera archivos:
// declara ids, estados, issues y metadata trazable. La spec técnica vive en `spec.ts`
// y la aptitud contractual en `aptitud.ts`.
//
// BNA-1 sigue BLOQUEADA: no se elige `02` ni `96` para el tipo de documento.
// BNA-2/5/6/7/8/9/11 siguen INTERPRETACION_PENDIENTE. BNA-10 se documenta como
// interpretación que no afecta bytes. BNA-3 queda documentada y BNA-4 confirmada.

import type { ContractStatus } from '../fixed-width';

export const IDS_ISSUE_BNA = [
  'BNA-1',
  'BNA-2',
  'BNA-3',
  'BNA-4',
  'BNA-5',
  'BNA-6',
  'BNA-7',
  'BNA-8',
  'BNA-9',
  'BNA-10',
  'BNA-11',
] as const;

export type BnaIssueId = (typeof IDS_ISSUE_BNA)[number];

/** `DOCUMENTADA` no es un `ContractStatus`: BNA-3 describe inconsistencias de ejemplos. */
export type EstadoIssueBna = ContractStatus | 'DOCUMENTADA';

export interface IssueBna {
  readonly estado: EstadoIssueBna;
  readonly afectaBytes: boolean;
  readonly tema: string;
}

export const ISSUES_BNA = {
  'BNA-1': {
    estado: 'BLOQUEADA',
    afectaBytes: true,
    tema: 'Tipo de documento beneficiario',
  },
  'BNA-2': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'CBU del registro 2: empresa vs beneficiario',
  },
  'BNA-3': {
    estado: 'DOCUMENTADA',
    afectaBytes: false,
    tema: 'Inconsistencias en ejemplos compuestos',
  },
  'BNA-4': {
    estado: 'CONFIRMADA',
    afectaBytes: false,
    tema: 'Posiciones derivadas por longitudes',
  },
  'BNA-5': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Código de convenio de 4, 5, 6, 7 u 8 dígitos',
  },
  'BNA-6': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Entidad y sucursal: código BCRA vs dígitos del CBU',
  },
  'BNA-7': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Fecha de compensación y calendario de feriados',
  },
  'BNA-8': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Alfabeto A–Z/0–9 y política de mayúsculas',
  },
  'BNA-9': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Separador de línea y salto final',
  },
  'BNA-10': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: false,
    tema: 'Mismo CBU repetido entre beneficiarios',
  },
  'BNA-11': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Obligatoriedad/vacío de campos libres',
  },
} as const satisfies Record<BnaIssueId, IssueBna>;

export const ID_REGISTRO_BNA_1 = 'BNA_R1';
export const ID_REGISTRO_BNA_2 = 'BNA_R2';
export const ID_REGISTRO_BNA_3 = 'BNA_R3';

export const ID_CAMPO_BNA_TIPO_DOCUMENTO = 'r2_tipoDocumento';
