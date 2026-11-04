// Contrato documental Patagonia B.2 (F6, CP-F6-A; docs/04 §3 y §6.2).
// Este módulo NO genera archivos: declara ids, estados, issues y metadata trazable.
// La spec técnica vive en `spec.ts` y la aptitud contractual en `aptitud.ts`.
//
// PAT-1 queda CONFIRMADA solo para la hipótesis ESPACIOS (PC-01, CP-F7-C2.2):
// 93 posiciones (104–196) completadas con 93 espacios. PAT-2 queda CONFIRMADA
// solo para la hipótesis ALFANUMERICA (PC-02, CP-F7-C2.3): 15 posiciones
// (85–99), alineado a la izquierda y completado con espacios a la derecha. Las
// hipótesis históricas CEROS y NUMERICA siguen BLOQUEADAS en la spec: no son
// decisiones bancarias. PAT-3…PAT-16 conservan su estado documentado. PAT-17
// (código de banco del registro 2 frente a la restricción actual 034) queda
// INTERPRETACION_PENDIENTE: no habilita cuentas de otros bancos ni modifica D-012,
// D-056, el catálogo de destinos ni `reglaBancoCompatible`.

import type { ContractStatus } from '../fixed-width';

export const IDS_ISSUE_PATAGONIA = [
  'PAT-1',
  'PAT-2',
  'PAT-3',
  'PAT-4',
  'PAT-5',
  'PAT-6',
  'PAT-7',
  'PAT-8',
  'PAT-9',
  'PAT-10',
  'PAT-11',
  'PAT-12',
  'PAT-13',
  'PAT-14',
  'PAT-15',
  'PAT-16',
  'PAT-17',
] as const;

export type PatagoniaIssueId = (typeof IDS_ISSUE_PATAGONIA)[number];

export interface IssuePatagonia {
  readonly estado: ContractStatus;
  readonly afectaBytes: boolean;
  readonly tema: string;
}

export const ISSUES_PATAGONIA = {
  'PAT-1': {
    estado: 'CONFIRMADA',
    afectaBytes: true,
    tema: 'Registro 2 campo 16: 93 posiciones reales (104–196) completadas con 93 espacios; PAT-DR declara 96 y tipo N',
  },
  'PAT-2': {
    estado: 'CONFIRMADA',
    afectaBytes: true,
    tema: 'Código de dependencia: alfanumérico de 15 posiciones (85–99), alineado a la izquierda y completado con espacios a la derecha; debe coincidir con el alta',
  },
  'PAT-3': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: false,
    tema: 'Campos que deben coincidir con el alta: la observación cita 11–14, pero 14 es espacio',
  },
  'PAT-4': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Provincia de R2: `00` cuando el tipo no exige provincia por decisión interna del 2026-11-04; con tipo 004 se usa solo el dato válido del maestro y un valor inválido bloquea; el contrato sigue pendiente de homologación',
  },
  'PAT-5': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Número de envío: distinto de 99 vs. rango 1–70; ¿se admite 00?',
  },
  'PAT-6': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Número de EMPRESA vs. número de convenio de PAT-XL',
  },
  'PAT-7': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Anexo III: 006/007 solo en PAT-DR; 005 solo en PAT-XL',
  },
  'PAT-8': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Anexo I: PAT-XL omite 004',
  },
  'PAT-9': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Apellido y nombre: composición, normalización y rechazo por longitud resueltos por decisión interna del 2026-11-04 (P-14); la obligatoriedad y el contrato siguen pendientes de homologación',
  },
  'PAT-10': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: false,
    tema: 'Nombre de archivo: ACREXXXX.TXT vs. BP_AAMMDD_HHMMSS',
  },
  'PAT-11': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Variante “con cuenta confirmada”: implica otras variantes y el alcance del convenio',
  },
  'PAT-12': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Caracteres admitidos en el concepto; el ejemplo usa punto y barra',
  },
  'PAT-13': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Loteo: máximo 999 detalles por lote; división resuelta por decisión interna del 2026-11-04 (P-20); el contrato sigue pendiente de homologación',
  },
  'PAT-14': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Encoding, separador de línea y salto final no especificados',
  },
  'PAT-15': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Versión de R0/R1: 8 espacios por decisión interna del 2026-11-04; el contrato sigue pendiente de homologación',
  },
  'PAT-16': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Comprobante de R2: `0000000` solo con legajo ausente por decisión interna del 2026-11-04; un legajo inválido bloquea; el contrato sigue pendiente de homologación',
  },
  'PAT-17': {
    estado: 'INTERPRETACION_PENDIENTE',
    afectaBytes: true,
    tema: 'Código de banco del registro 2 frente a la restricción actual de entidad Patagonia 034',
  },
} as const satisfies Record<PatagoniaIssueId, IssuePatagonia>;

export const ID_REGISTRO_PAT_0 = 'PAT_R0';
export const ID_REGISTRO_PAT_1 = 'PAT_R1';
export const ID_REGISTRO_PAT_2 = 'PAT_R2';

/** H-02: F6 implementa exclusivamente acreditación Plan Sueldos (R1 campo 3 = 2). */
export const PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS = '2';
export const PAT_TIPO_MOVIMIENTO_FUERA_DE_ALCANCE_F6 = '4';

export const ID_CAMPO_PAT_DEPENDENCIA = 'r2_codigoDependencia';
export const ID_CAMPO_PAT_RELLENO_PAT1 = 'r2_rellenoPat1';
export const ID_CAMPO_PAT_CODIGO_BANCO = 'r2_codigoBanco';
export const ID_CAMPO_PAT_VERSION_LOTE = 'r1_version';
export const ID_CAMPO_PAT_TIPO_MOVIMIENTO = 'r1_tipoMovimiento';

/** Geometría real de PAT-1; la longitud documental se conserva separada de la spec F4. */
export const PAT1_POSICION_INICIO = 104;
export const PAT1_POSICION_FIN = 196;
export const PAT1_LONGITUD_GEOMETRICA = 93;

/** Longitud declarada por PAT-DR p.9, conservada como metadata documental. */
export const PAT1_LONGITUD_DECLARADA_DOCUMENTAL = 96;

/** Geometría confirmada de PAT-2 (PC-02, CP-F7-C2.3): campo 13 del Registro 2. */
export const PAT2_POSICION_INICIO = 85;
export const PAT2_POSICION_FIN = 99;
export const PAT2_LONGITUD = 15;
