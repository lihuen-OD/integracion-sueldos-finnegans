// Ejecución runtime de la gramática de estructura (T4-8, D-070). Ejecuta la estructura YA
// validada estáticamente (`validarFileSpec`): sin backtracking, sin "continuar gana", sin
// "cerrar gana". La decisión por token es única: id ∈ POSIBLES(parte) → continuar la
// repetición; id ∈ FOLLOW(R) → cerrarla (exigiendo su `min` cumplido); otra cosa → error
// estructural. La superposición de ambos conjuntos es teóricamente imposible tras la
// validación estática; de aparecer (spec no validada) se reporta como defensa
// `ESTRUCTURA_AMBIGUA`. Produce además `rutaRepeticiones`: contadores 1-based de las
// repeticiones activas, exterior → interior (D-070, D-073).

import type { EstructuraArchivo } from './tipos';
import { idsPosibles, primerosDeEstructura } from './estructura';

export type CodigoErrorEstructura =
  | 'ORDEN_INVALIDO'
  | 'REPETICION_INCOMPLETA'
  | 'REGISTRO_FALTANTE'
  | 'LINEA_DEMASIADO'
  | 'ESTRUCTURA_AMBIGUA';

export interface ErrorEstructura {
  readonly codigo: CodigoErrorEstructura;
  /** id del item mal ubicado (ORDEN_INVALIDO / REPETICION_INCOMPLETA) o esperado al final (REGISTRO_FALTANTE). */
  readonly registroId?: string;
  /** Ruta de repeticiones activas al fallar. */
  readonly ruta?: readonly number[];
}

interface Avance {
  readonly ok: true;
  readonly i: number;
}
interface Corte {
  readonly ok: false;
  readonly error: ErrorEstructura;
  /** Índice (0-based) del item donde se cortó; igual a la cantidad si fue por fin de items. */
  readonly indice: number;
}
type Paso = Avance | Corte;

interface ItemConId {
  readonly recordId: string;
}

function esAvance(paso: Paso): paso is Avance {
  return paso.ok;
}

/**
 * Consume EXACTAMENTE una ocurrencia de `nodo` a partir de `i`, con la ruta activa y el
 * FOLLOW del contexto. Los errores se propagan tal cual (sin reintentos: la gramática es
 * determinista por la validación estática). Mientras un marco de repetición queda sin
 * cumplir su `min`, no se cierra: los items de FOLLOW traen `REPETICION_INCOMPLETA`.
 */
function consumir(
  nodo: EstructuraArchivo,
  items: readonly ItemConId[],
  rutas: (readonly number[])[],
  i: number,
  ruta: readonly number[],
  despues: ReadonlySet<string>,
): Paso {
  switch (nodo.kind) {
    case 'registro': {
      const item = items[i];
      if (item === undefined) {
        return {
          ok: false,
          error: { codigo: 'REGISTRO_FALTANTE', registroId: nodo.recordId, ruta },
          indice: i,
        };
      }
      if (item.recordId !== nodo.recordId) {
        return {
          ok: false,
          error: { codigo: 'ORDEN_INVALIDO', registroId: item.recordId, ruta },
          indice: i,
        };
      }
      rutas[i] = ruta;
      return { ok: true, i: i + 1 };
    }
    case 'secuencia': {
      let cursor = i;
      let indice = 0;
      for (const parte of nodo.partes) {
        const siguiente = nodo.partes[indice + 1];
        const sig = siguiente === undefined ? despues : primerosDeEstructura(siguiente);
        const paso = consumir(parte, items, rutas, cursor, ruta, sig);
        if (!esAvance(paso)) {
          return paso;
        }
        cursor = paso.i;
        indice += 1;
      }
      return { ok: true, i: cursor };
    }
    case 'repeticion': {
      let cursor = i;
      let contador = 0;
      const deParte = idsPosibles(nodo.parte);
      for (;;) {
        const item = items[cursor];
        if (item === undefined) {
          if (contador < nodo.min) {
            return {
              ok: false,
              error: { codigo: 'REPETICION_INCOMPLETA', ruta },
              indice: cursor,
            };
          }
          return { ok: true, i: cursor };
        }
        const enParte = deParte.has(item.recordId);
        const enDespues = despues.has(item.recordId);
        if (enParte && enDespues) {
          // Defensa: la validación estática (D-070) debió rechazar esta estructura.
          return { ok: false, error: { codigo: 'ESTRUCTURA_AMBIGUA' }, indice: cursor };
        }
        if (enParte) {
          const rutaIteracion = [...ruta, contador + 1];
          const despuesIteracion = new Set([...primerosDeEstructura(nodo.parte), ...despues]);
          const paso = consumir(nodo.parte, items, rutas, cursor, rutaIteracion, despuesIteracion);
          if (!esAvance(paso)) {
            return paso;
          }
          cursor = paso.i;
          contador += 1;
          continue;
        }
        if (enDespues) {
          if (contador < nodo.min) {
            return {
              ok: false,
              error: { codigo: 'REPETICION_INCOMPLETA', registroId: item.recordId, ruta },
              indice: cursor,
            };
          }
          return { ok: true, i: cursor };
        }
        return {
          ok: false,
          error: { codigo: 'ORDEN_INVALIDO', registroId: item.recordId, ruta },
          indice: cursor,
        };
      }
    }
  }
}

/**
 * Ejecuta la gramática completa sobre una secuencia de items con `recordId`. Devuelve una
 * ruta por item (posiciones 0-based paralelas al arreglo) o el error estructural con el
 * índice del item donde se cortó (mayor o igual a la cantidad si fue por fin de items).
 * Items no consumidos una vez completa la gramática → `LINEA_DEMASIADO`.
 */
export function ejecutarEstructura(
  estructura: EstructuraArchivo,
  items: readonly ItemConId[],
):
  | { ok: true; rutas: readonly (readonly number[])[] }
  | { ok: false; error: ErrorEstructura; indice: number } {
  const rutas: (readonly number[])[] = Array.from({ length: items.length }, () => []);
  const paso = consumir(estructura, items, rutas, 0, [], new Set());
  if (esAvance(paso)) {
    for (let i = paso.i; i < items.length; i += 1) {
      const pendiente = items[i];
      if (pendiente !== undefined) {
        return {
          ok: false,
          error: { codigo: 'LINEA_DEMASIADO', registroId: pendiente.recordId },
          indice: i,
        };
      }
    }
    return { ok: true, rutas };
  }
  return paso;
}
