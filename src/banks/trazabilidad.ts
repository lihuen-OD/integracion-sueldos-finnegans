// Trazabilidad documental de la capa bancaria (F5/F6; D-068, D-080). Vive fuera del motor
// fixed-width: el motor solo consume `FieldSpec`/`RecordSpec` y NO conoce documentos, páginas
// ni issues contractuales. Estas extensiones son estructuralmente asignables a los contratos
// del motor (los campos readonly son covariantes), de modo que una spec bancaria puede
// validarse/serializarse sin que `src/banks/fixed-width/**` importe este módulo.

import type { FieldSpec } from './fixed-width';

/** Orígenes documentales del valor de un campo, según docs/04. */
export const ORIGENES_BANCARIOS = [
  'FINNEGANS',
  'MAESTRO',
  'PERFIL',
  'ENVIO',
  'DERIVADO',
  'FIJO',
] as const;

export type FieldOrigin = (typeof ORIGENES_BANCARIOS)[number];

/** Catálogo cerrado de documentos bancarios de docs/04. El motor nunca lo importa. */
export const DOCS_BANCARIOS = ['BNA', 'PAT_DR', 'PAT_XL'] as const;

export type DocBancario = (typeof DOCS_BANCARIOS)[number];

/** Referencia a la fuente documental de un campo. `paginas` son páginas del PDF (1-based). */
export interface FuenteDocumental {
  readonly doc: DocBancario;
  readonly paginas: readonly number[];
  readonly nota?: string;
}

/**
 * `FieldSpec` + metadata bancaria. `issues` permite conservar un estado primario
 * `CONFIRMADA` y, a la vez, dejar explícita una interpretación pendiente asociada
 * (por ejemplo, un campo C con `issues: ['BNA-6']`). No modifica el contrato F4.
 */
export interface FieldSpecBancaria<I extends string = string> extends FieldSpec {
  readonly origin: FieldOrigin;
  readonly source: FuenteDocumental;
  readonly issues?: readonly I[];
}

/** `RecordSpec` + metadata bancaria, estructuralmente asignable a `RecordSpec`. */
export interface RecordSpecBancaria<I extends string = string> {
  readonly id: string;
  readonly recordLength: number;
  readonly fields: readonly FieldSpecBancaria<I>[];
}
