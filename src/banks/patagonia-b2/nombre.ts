// Nombre Patagonia (docs/03 §F, D-021/D-033/D-035). Separa las transformaciones ya
// aprobadas (mayúsculas, sin acentos/diéresis, Ñ→N) de la composición y el truncamiento,
// que siguen pendientes (PAT-9/P-14). No hay orden, separador, recorte, colapso ni
// truncamiento por default: la decisión es un parámetro obligatorio.
import type { Result } from '../../shared/result';
import {
  longitudCampoPatagonia,
  validarNombrePatagonia,
  type ErrorNombrePatagonia,
} from './validacion';

/** Auditoría D-033: valor original, valor generado y banderas explícitas. */
export interface NombrePatagonia {
  /** Apellido y nombre tal como vienen de Finnegans, sin transformar. */
  readonly original: string;
  /** Valor que iría al TXT, después de las transformaciones elegidas. */
  readonly generado: string;
  readonly transformado: boolean;
  readonly truncado: boolean;
}

export interface DecisionNombrePatagonia {
  readonly orden: 'APELLIDO_NOMBRE' | 'NOMBRE_APELLIDO';
  readonly separador: string;
  readonly recortarExtremos: boolean;
  readonly colapsarEspaciosInternos: boolean;
  readonly truncamiento: 'RECHAZAR' | 'TRUNCAR_A_20';
}

export type ErrorConstruccionNombrePatagonia =
  'DECISION_REQUERIDA' | 'DECISION_INVALIDA' | ErrorNombrePatagonia;

export const MAX_LONGITUD_NOMBRE_PATAGONIA = longitudCampoPatagonia('r2_apellidoNombre');

/**
 * Aplica solo las transformaciones aprobadas: mayúsculas, eliminación de acentos/diéresis
 * y Ñ→N (la descomposición NFD convierte la tilde de Ñ en un diacrítico removible). No
 * recorta, no colapsa espacios ni elimina otros caracteres.
 */
export function normalizarComponenteNombre(texto: string): {
  readonly valor: string;
  readonly transformado: boolean;
} {
  const valor = texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  return { valor, transformado: valor !== texto };
}

function decisionValida(decision: unknown): decision is DecisionNombrePatagonia {
  if (typeof decision !== 'object' || decision === null) {
    return false;
  }
  const valor = decision as Record<string, unknown>;
  return (
    (valor['orden'] === 'APELLIDO_NOMBRE' || valor['orden'] === 'NOMBRE_APELLIDO') &&
    typeof valor['separador'] === 'string' &&
    typeof valor['recortarExtremos'] === 'boolean' &&
    typeof valor['colapsarEspaciosInternos'] === 'boolean' &&
    (valor['truncamiento'] === 'RECHAZAR' || valor['truncamiento'] === 'TRUNCAR_A_20')
  );
}

/**
 * Construye el nombre con una decisión explícita. Si el resultado supera 20 y la decisión
 * no autoriza truncar, devuelve error: nunca recorta silenciosamente. Los caracteres que
 * quedan fuera de A–Z/espacio se rechazan después de las transformaciones aprobadas
 * (D-035 provisional), sin reemplazarlos.
 */
export function construirNombrePatagonia(
  apellido: string,
  nombre: string,
  decision: DecisionNombrePatagonia,
): Result<NombrePatagonia, ErrorConstruccionNombrePatagonia>;
export function construirNombrePatagonia(
  apellido: string,
  nombre: string,
  decision: DecisionNombrePatagonia | null | undefined,
): Result<NombrePatagonia, ErrorConstruccionNombrePatagonia> {
  if (decision === null || decision === undefined) {
    return { ok: false, error: 'DECISION_REQUERIDA' };
  }
  if (!decisionValida(decision)) {
    return { ok: false, error: 'DECISION_INVALIDA' };
  }

  const apellidoNormalizado = normalizarComponenteNombre(apellido).valor;
  const nombreNormalizado = normalizarComponenteNombre(nombre).valor;
  const partes =
    decision.orden === 'APELLIDO_NOMBRE'
      ? [apellidoNormalizado, nombreNormalizado]
      : [nombreNormalizado, apellidoNormalizado];
  let generado = partes.join(decision.separador);
  if (decision.recortarExtremos) {
    generado = generado.replace(/^ +| +$/g, '');
  }
  if (decision.colapsarEspaciosInternos) {
    generado = generado.replace(/ {2,}/g, ' ');
  }

  if (generado === '') {
    return { ok: false, error: 'NOMBRE_VACIO' };
  }
  // El alfabeto se valida sobre el valor completo: un carácter no respaldado no puede
  // desaparecer por un truncamiento posterior (D-035).
  if (!/^[A-Z ]+$/.test(generado)) {
    return { ok: false, error: 'NOMBRE_CARACTER_NO_RESPALDADO' };
  }

  let truncado = false;
  if (generado.length > MAX_LONGITUD_NOMBRE_PATAGONIA) {
    if (decision.truncamiento === 'RECHAZAR') {
      return { ok: false, error: 'NOMBRE_LONGITUD_EXCEDIDA' };
    }
    generado = generado.slice(0, MAX_LONGITUD_NOMBRE_PATAGONIA);
    truncado = true;
  }

  const validado = validarNombrePatagonia(generado);
  if (!validado.ok) {
    return { ok: false, error: validado.error };
  }

  const original = `${apellido} ${nombre}`;
  return {
    ok: true,
    value: {
      original,
      generado,
      transformado: generado !== original,
      truncado,
    },
  };
}
