// Validación estática de EstructuraArchivo (D-070). La gramática se demuestra no ambigua
// ANTES del runtime: para toda repetición R se exige `POSIBLES(R.parte) ∩ FOLLOW(R) = ∅`,
// con FOLLOW que contempla hermanos posteriores, salida de secuencias y la re-entrada de
// las repeticiones contenedoras (al terminar la parte de una repetición, o itera otra vez
// con FIRST(parte), o sale con FOLLOW(R): por eso FOLLOW del último elemento incluye ambos).
// El runtime no desempata: sin "continuar gana", sin "cerrar gana", sin backtracking.

import type { EstructuraArchivo, RecordSpec } from './tipos';
import type { ErrorSpec } from './validacion';

/** Ids de registro que pueden aparecer en algún punto del subárbol. */
function posibles(nodo: EstructuraArchivo): Set<string> {
  switch (nodo.kind) {
    case 'registro':
      return new Set([nodo.recordId]);
    case 'secuencia': {
      const ids = new Set<string>();
      for (const parte of nodo.partes) {
        for (const id of posibles(parte)) {
          ids.add(id);
        }
      }
      return ids;
    }
    case 'repeticion':
      return posibles(nodo.parte);
  }
}

function primero(nodo: EstructuraArchivo): ReadonlySet<string> {
  switch (nodo.kind) {
    case 'registro':
      return new Set([nodo.recordId]);
    case 'secuencia': {
      const primera = nodo.partes[0];
      return primera === undefined ? new Set() : new Set(primero(primera));
    }
    case 'repeticion':
      return primero(nodo.parte);
  }
}

/**
 * Recorre la estructura acumulando errores (orden de recorrido determinista): ids
 * inexistentes, `repeticion.min` inválido, secuencias vacías, violaciones D-070. También
 * registra los ids de registro alcanzados (para NO_ALCANZABLE y SIN_DISCRIMINADOR).
 */
function recorrer(
  nodo: EstructuraArchivo,
  despues: ReadonlySet<string>,
  porId: ReadonlyMap<string, RecordSpec>,
  errores: ErrorSpec[],
  referenciados: Set<string>,
): void {
  switch (nodo.kind) {
    case 'registro': {
      referenciados.add(nodo.recordId);
      if (!porId.has(nodo.recordId)) {
        errores.push({ codigo: 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA', registroId: nodo.recordId });
      }
      break;
    }
    case 'secuencia': {
      if (nodo.partes.length === 0) {
        errores.push({ codigo: 'ESTRUCTURA_INVALIDA' });
        break;
      }
      nodo.partes.forEach((parte, indice) => {
        const siguiente = nodo.partes[indice + 1];
        const sig = siguiente === undefined ? despues : primero(siguiente);
        recorrer(parte, sig, porId, errores, referenciados);
      });
      break;
    }
    case 'repeticion': {
      if (!Number.isInteger(nodo.min) || nodo.min < 1) {
        errores.push({ codigo: 'ESTRUCTURA_INVALIDA' });
        break;
      }
      const deEsaParte = posibles(nodo.parte);
      for (const id of deEsaParte) {
        if (despues.has(id)) {
          errores.push({ codigo: 'ESTRUCTURA_AMBIGUA' });
          break;
        }
      }
      recorrer(
        nodo.parte,
        new Set([...primero(nodo.parte), ...despues]),
        porId,
        errores,
        referenciados,
      );
      break;
    }
  }
}

/** Ids de registro que pueden aparecer en algún punto del subárbol (usado por runtime también). */
export function idsPosibles(nodo: EstructuraArchivo): ReadonlySet<string> {
  return posibles(nodo);
}

/** Ids con los que puede COMENZAR el subárbol (FIRST). El runtime lo usa para FOLLOW. */
export function primerosDeEstructura(nodo: EstructuraArchivo): ReadonlySet<string> {
  return primero(nodo);
}

/** Valida la estructura; reporta además cada registro no alcanzado por ella. */
export function validarEstructura(
  estructura: EstructuraArchivo,
  porId: ReadonlyMap<string, RecordSpec>,
): readonly ErrorSpec[] {
  const errores: ErrorSpec[] = [];
  const referenciados = new Set<string>();
  recorrer(estructura, new Set(), porId, errores, referenciados);
  for (const id of porId.keys()) {
    if (!referenciados.has(id)) {
      errores.push({ codigo: 'REGISTRO_NO_ALCANZABLE', registroId: id });
    }
  }
  return errores;
}

/** Ids de registro alcanzados por la estructura (para el requisito de discriminadores). */
export function registrosAlcanzados(
  estructura: EstructuraArchivo,
  porId: ReadonlyMap<string, RecordSpec>,
): ReadonlySet<string> {
  const referenciados = new Set<string>();
  recorrer(estructura, new Set(), porId, [], referenciados);
  return referenciados;
}
