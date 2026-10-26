// Specs sintéticas de ARCHIVO para las pruebas de CP-F4-C (extendido de specsSinteticas,
// D-077: sin ids, posiciones ni campos de layouts bancarios reales).
import type {
  EstructuraArchivo,
  FileSpec,
  RecordSpec,
  ValoresPorCampo,
} from '../../../../src/banks/fixed-width';
import type { Result } from '../../../../src/shared/result';
import { campo, fijo, registro } from './specsSinteticas';

/** Despeja un Result marcado ok en el test; si falla, corta con el error técnico visible. */
export function valorDe<T, E>(resultado: Result<T, E>): T {
  if (!resultado.ok) {
    throw new Error(`se esperaba ok: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

/** Acceso a índice de listas con fallo explícito (sin aserciones no nulas). */
export function en<T>(lista: readonly T[], indice: number): T {
  const elemento = lista[indice];
  if (elemento === undefined) {
    throw new Error(`sin elemento en ${String(indice)}`);
  }
  return elemento;
}

export const CABECERA: RecordSpec = registro('H', 10, [
  fijo('marcaH', 1, 1, 'H'),
  campo('dato', 2, 8, 'A'),
  campo('numH', 9, 10, 'N'),
]);

export const DETALLE: RecordSpec = registro('D', 14, [
  fijo('marcaD', 1, 1, 'D'),
  campo('ref', 2, 7, 'A'),
  campo('imp', 8, 13, 'N'),
  campo('glosa', 14, 14, 'A'),
]);

export const CIERRE: RecordSpec = registro('C', 8, [
  fijo('marcaC', 1, 1, 'C'),
  campo('resumen', 2, 8, 'A'),
]);

export function estructuraInicial(minDetalle = 1, interior?: EstructuraArchivo): EstructuraArchivo {
  const alternativa: EstructuraArchivo =
    interior === undefined
      ? { kind: 'registro', recordId: 'D' }
      : { kind: 'secuencia', partes: [interior] };
  return {
    kind: 'secuencia',
    partes: [
      { kind: 'registro', recordId: 'H' },
      { kind: 'repeticion', parte: alternativa, min: minDetalle },
      { kind: 'registro', recordId: 'C' },
    ],
  };
}

export function archivoSpec(
  estructura: EstructuraArchivo,
  separadorNL: '\r\n' | '\n' = '\n',
): FileSpec {
  return {
    id: 'SINTETICO',
    records: [CABECERA, DETALLE, CIERRE],
    charset: 'ASCII_PRINTABLE',
    lineSeparator: { value: separadorNL, status: 'CONFIRMADA' },
    trailingSeparator: { value: true, status: 'CONFIRMADA' },
    structure: estructura,
  };
}

export function valores(
  registroId: string,
  pares: Record<string, string>,
): { recordId: string; valores: ValoresPorCampo } {
  return { recordId: registroId, valores: { ...pares } };
}
