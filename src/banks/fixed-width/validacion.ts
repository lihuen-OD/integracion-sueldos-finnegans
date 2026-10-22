// Validación técnica de FieldSpec / RecordSpec / FileSpec (contratos F4, docs/02).
// Regla central: la validez técnica es independiente de ContractStatus (D-075). Un estado
// `BLOQUEADA` no repara ni excusa una geometría inválida.
// Errores deterministas, acumulables y ordenados en pasos fijos; nunca contienen valores
// de registros de usuarios (solo ids técnicos de la spec y posiciones 1-based).

import type { Result } from '../../shared/result';
import { codificarAscii } from './ascii';
import { registrosAlcanzados, validarEstructura } from './estructura';
import type { FileSpec, RecordSpec } from './tipos';

export type CodigoErrorSpec =
  | 'ID_INVALIDO'
  | 'ID_DUPLICADO'
  | 'LONGITUD_DE_REGISTRO_INVALIDA'
  | 'POSICION_INVALIDA'
  | 'ORDEN_DE_CAMPOS_INVALIDO'
  | 'COBERTURA_INCOMPLETA'
  | 'HUECO_POSICIONES'
  | 'SOLAPAMIENTO_POSICIONES'
  | 'LONGITUD_DECLARADA_INCONSISTENTE'
  | 'PADDING_INCOHERENTE'
  | 'FIJO_INCOHERENTE'
  /** registro alcanzado por la estructura sin ningún `fixedValue` (D-070). */
  | 'REGISTRO_SIN_DISCRIMINADOR'
  | 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA'
  | 'REGISTRO_NO_ALCANZABLE'
  /** secuencia vacía o `repeticion.min` que no es entero >= 1 (inválida, no ambigua). */
  | 'ESTRUCTURA_INVALIDA'
  /** viola `POSIBLES(R.parte) ∩ FOLLOW(R) = ∅` para alguna repetición (D-070). */
  | 'ESTRUCTURA_AMBIGUA'
  /** par de igual longitud sin posición común restringida con bytes distintos (D-070). */
  | 'DISCRIMINADOR_AMBIGUO';

export interface ErrorSpec {
  readonly codigo: CodigoErrorSpec;
  readonly registroId?: string;
  /** Segundo registro involucrado (pares de `DISCRIMINADOR_AMBIGUO`). */
  readonly otroRegistroId?: string;
  readonly campoId?: string;
  /** Rango de posiciones 1-based, inclusivo. */
  readonly desde?: number;
  readonly hasta?: number;
}

interface RangoPosiciones {
  readonly desde: number;
  readonly hasta: number;
}

function idValido(id: string): boolean {
  return id.length > 0 && id.trim().length > 0;
}

/** Rangos contiguos de posiciones (arreglo indexado 0) cuya entrada cumple el criterio. */
function rangosDeValores(
  conteos: readonly number[],
  coincide: (n: number) => boolean,
): readonly RangoPosiciones[] {
  const rangos: RangoPosiciones[] = [];
  let desde = null;
  for (let i = 0; i < conteos.length; i += 1) {
    const conteo = conteos[i];
    if (conteo === undefined) {
      break;
    }
    if (coincide(conteo)) {
      desde ??= i + 1;
    } else if (desde !== null) {
      rangos.push({ desde, hasta: i });
      desde = null;
    }
  }
  if (desde !== null) {
    rangos.push({ desde, hasta: conteos.length });
  }
  return rangos;
}

/**
 * Valida un RecordSpec de forma aislada: geometría (posiciones, cobertura exacta, orden,
 * longitudes), relleno coherente con el tipo y valores fijos coherentes. No exige
 * discriminador: ese requisito (D-070) aplica a los registros alcanzados por la estructura
 * y se valida en `validarFileSpec`. `ContractStatus` no participa.
 */
export function validarRecordSpec(spec: RecordSpec): Result<void, readonly ErrorSpec[]> {
  if (!Number.isInteger(spec.recordLength) || spec.recordLength < 1) {
    return {
      ok: false,
      error: [{ codigo: 'LONGITUD_DE_REGISTRO_INVALIDA', registroId: spec.id }],
    };
  }

  const errores: ErrorSpec[] = [];
  const idsVistos = new Set<string>();
  for (const campo of spec.fields) {
    if (!idValido(campo.id)) {
      errores.push({ codigo: 'ID_INVALIDO', registroId: spec.id, campoId: campo.id });
    } else if (idsVistos.has(campo.id)) {
      errores.push({ codigo: 'ID_DUPLICADO', registroId: spec.id, campoId: campo.id });
    }
    idsVistos.add(campo.id);
  }

  let inicioAnterior = null;
  for (const campo of spec.fields) {
    const { start, end, declaredLength } = campo;
    const posicionValida =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      Number.isInteger(declaredLength) &&
      start >= 1 &&
      end >= start &&
      end <= spec.recordLength;
    if (!posicionValida) {
      errores.push({ codigo: 'POSICION_INVALIDA', registroId: spec.id, campoId: campo.id });
    } else if (end - start + 1 !== declaredLength) {
      errores.push({
        codigo: 'LONGITUD_DECLARADA_INCONSISTENTE',
        registroId: spec.id,
        campoId: campo.id,
        desde: start,
        hasta: end,
      });
    }
    if (inicioAnterior !== null && start <= inicioAnterior) {
      errores.push({
        codigo: 'ORDEN_DE_CAMPOS_INVALIDO',
        registroId: spec.id,
        campoId: campo.id,
        desde: start,
        hasta: end,
      });
    }
    inicioAnterior = start;
  }

  const conteos = new Array<number>(spec.recordLength).fill(0);
  let posicionesCubiertas = 0;
  for (const campo of spec.fields) {
    for (let posicion = campo.start; posicion <= campo.end; posicion += 1) {
      if (posicion >= 1 && posicion <= spec.recordLength) {
        const previo = conteos[posicion - 1];
        if (previo === 0) {
          posicionesCubiertas += 1;
        }
        conteos[posicion - 1] = (previo ?? 0) + 1;
      }
    }
  }
  for (const rango of rangosDeValores(conteos, (n) => n === 0)) {
    errores.push({ codigo: 'HUECO_POSICIONES', registroId: spec.id, ...rango });
  }
  for (const rango of rangosDeValores(conteos, (n) => n > 1)) {
    errores.push({ codigo: 'SOLAPAMIENTO_POSICIONES', registroId: spec.id, ...rango });
  }
  if (posicionesCubiertas !== spec.recordLength) {
    errores.push({ codigo: 'COBERTURA_INCOMPLETA', registroId: spec.id });
  }

  for (const campo of spec.fields) {
    const rellenoEsperado = campo.type === 'N' ? 'ZERO_LEFT' : 'SPACE_RIGHT';
    if (campo.padding.kind !== rellenoEsperado) {
      errores.push({ codigo: 'PADDING_INCOHERENTE', registroId: spec.id, campoId: campo.id });
    }
    if (campo.fixedValue !== undefined) {
      const codificado = codificarAscii(campo.fixedValue);
      const ancho = campo.end - campo.start + 1;
      const digitoInvalido =
        campo.type === 'N' &&
        codificado.ok &&
        !codificado.value.every((byte) => byte >= 0x30 && byte <= 0x39);
      if (!codificado.ok || codificado.value.length !== ancho || digitoInvalido) {
        errores.push({ codigo: 'FIJO_INCOHERENTE', registroId: spec.id, campoId: campo.id });
      }
    }
  }

  if (errores.length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: false, error: errores };
}

/** Posición (1-based) → byte fijo, para los campos con `fixedValue` de un RecordSpec. */
function posicionesRestringidas(spec: RecordSpec): ReadonlyMap<number, number> {
  const restringidas = new Map<number, number>();
  for (const campo of spec.fields) {
    if (campo.fixedValue === undefined) {
      continue;
    }
    for (let posicion = campo.start; posicion <= campo.end; posicion += 1) {
      const byte = campo.fixedValue.charCodeAt(posicion - campo.start);
      if (byte <= 0x7e && byte >= 0x20) {
        restringidas.set(posicion, byte);
      }
    }
  }
  return restringidas;
}

function parAmbiguo(a: RecordSpec, b: RecordSpec): boolean {
  const deA = posicionesRestringidas(a);
  const deB = posicionesRestringidas(b);
  for (const [posicion, byteA] of deA) {
    const byteB = deB.get(posicion);
    if (byteB !== undefined && byteB !== byteA) {
      return false;
    }
  }
  return true;
}

/**
 * Validación estática de todo el FileSpec: validez de cada RecordSpec, ids de registro
 * (opacos pero únicos y no vacíos, D-068), existencia y alcanzabilidad en la estructura,
 * requisitos de discriminadores de los registros alcanzados (D-070), no ambigüedad
 * estructural D-070 y `DISCRIMINADOR_AMBIGUO` por pares.
 */
export function validarFileSpec(spec: FileSpec): Result<void, readonly ErrorSpec[]> {
  const errores: ErrorSpec[] = [];

  const idsDeRegistro = new Set<string>();
  for (const registro of spec.records) {
    if (!idValido(registro.id)) {
      errores.push({ codigo: 'ID_INVALIDO', registroId: registro.id });
    } else if (idsDeRegistro.has(registro.id)) {
      errores.push({ codigo: 'ID_DUPLICADO', registroId: registro.id });
    }
    idsDeRegistro.add(registro.id);
    const validacion = validarRecordSpec(registro);
    if (!validacion.ok) {
      errores.push(...validacion.error);
    }
  }

  const porId = new Map<string, RecordSpec>();
  for (const registro of spec.records) {
    if (!porId.has(registro.id)) {
      porId.set(registro.id, registro);
    }
  }

  errores.push(...validarEstructura(spec.structure, porId));

  const alcanzados = registrosAlcanzados(spec.structure, porId);
  for (const registro of spec.records) {
    if (alcanzados.has(registro.id) && !registro.fields.some((c) => c.fixedValue !== undefined)) {
      errores.push({ codigo: 'REGISTRO_SIN_DISCRIMINADOR', registroId: registro.id });
    }
  }

  spec.records.forEach((a, i) => {
    for (const b of spec.records.slice(i + 1)) {
      if (a.recordLength !== b.recordLength) {
        continue; // longitudes distintas: la longitud los discrimina (D-070)
      }
      if (parAmbiguo(a, b)) {
        errores.push({ codigo: 'DISCRIMINADOR_AMBIGUO', registroId: a.id, otroRegistroId: b.id });
      }
    }
  });

  if (errores.length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: false, error: errores };
}
