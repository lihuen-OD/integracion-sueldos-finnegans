// Contratos del motor fixed-width, congelados por el plan F4 (docs/02; D-068 a D-075).
// Sin conocimiento de bancos: sin ids, nombres, códigos ni catálogos de BNA o Patagonia (D-068).
// La trazabilidad documental (`origin`/`source`) es una extensión de la capa bancaria F5/F6.

export type ContractStatus = 'CONFIRMADA' | 'INTERPRETACION_PENDIENTE' | 'BLOQUEADA';

export type FieldType = 'N' | 'A';

/** Solo rellenos coherentes con el tipo; sin CUSTOM en F4 (D-072). */
export type Padding = { readonly kind: 'ZERO_LEFT' } | { readonly kind: 'SPACE_RIGHT' };

/**
 * Un campo del registro. Posiciones 1-based, inclusivas, en BYTES.
 * `status` informa aptitud contractual; no repara ni excusa una spec técnicamente inválida (D-075).
 */
export interface FieldSpec {
  readonly id: string;
  /** Nombre humano requerido: metadata, sin datos de usuario. */
  readonly name: string;
  readonly start: number;
  readonly end: number;
  /** Tal como figura en la fuente; `end - start + 1` debe coincidir. */
  readonly declaredLength: number;
  readonly type: FieldType;
  readonly padding: Padding;
  /** Ocupa todo el campo; base del discriminador del RecordSpec (D-070). */
  readonly fixedValue?: string;
  readonly status: ContractStatus;
}

/**
 * Un tipo de registro. `id` es opaco (D-068); `recordLength` es la longitud total en bytes,
 * entero >= 1 (D-069: longitudes heterogéneas permitidas entre registros del mismo FileSpec).
 */
export interface RecordSpec {
  readonly id: string;
  readonly recordLength: number;
  /** Cobertura exacta 1..recordLength, en orden ascendente por `start` (validada, no impuesta). */
  readonly fields: readonly FieldSpec[];
}

/**
 * Estructura del archivo: solo `registro`, `secuencia` y `repeticion` con `min` entero >= 1.
 * Sin `max` ni `min: 0`: diferidos hasta existir necesidad real (D-070). Sin DSL de totales.
 */
export type EstructuraArchivo =
  | { readonly kind: 'registro'; readonly recordId: string }
  | { readonly kind: 'secuencia'; readonly partes: readonly EstructuraArchivo[] }
  | { readonly kind: 'repeticion'; readonly parte: EstructuraArchivo; readonly min: number };

/** FileSpec genérico: id opaco (sin unión de bancos, D-068); estructura tipada (sin string, D-073). */
export interface FileSpec {
  readonly id: string;
  readonly records: readonly RecordSpec[];
  readonly charset: 'ASCII_PRINTABLE';
  readonly lineSeparator: { readonly value: '\r\n' | '\n'; readonly status: ContractStatus };
  readonly trailingSeparator: { readonly value: boolean; readonly status: ContractStatus };
  readonly structure: EstructuraArchivo;
}

/** Valores lógicos de un registro, por id de campo. Los `fixedValue` NO son entrada del llamador. */
export type ValoresPorCampo = Record<string, string>;
