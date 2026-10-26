// Serialización de archivo (T4-7; D-070, D-075). Composición genérica de registros ya
// soportados por `serializarRegistro`. La entrada expresa solo lo necesario:
// `recordId` + `ValoresPorCampo`. El motor: 1) valida técnicamente el FileSpec
// (SPEC_INVALIDA como precondición compartida); 2) valida ids existentes en la spec;
// 3) EJECUTA la estructura (sin aceptar listas arbitrarias); 4) serializa con las
// primitivas aprobadas; 5) inserta exactamente `lineSeparator.value`; 6) respeta
// exactamente `trailingSeparator.value`; 7) devuelve bytes deterministas.
// `ContractStatus` NO interviene: un elemento BLOQUEADA es técnicamente serializable
// (D-075); la aptitud productiva es de `hallarBloqueosGeneracion`.
// Sin lógica bancaria: sin totales, cantidades, checksums, loteo, fechas ni encoding.

import type { Result } from '../../shared/result';
import { ejecutarEstructura } from './estructuraRuntime';
import { validarFileSpec } from './validacion';
import type { CodigoErrorValor } from './serializer';
import type { FileSpec, ValoresPorCampo } from './tipos';
import { serializarRegistro } from './serializer';

export interface EntradaRegistro {
  /** id de un RecordSpec del FileSpec; los `fixedValue` NO son entrada del llamador. */
  readonly recordId: string;
  readonly valores: ValoresPorCampo;
}

export type CodigoErrorArchivo =
  | 'SPEC_INVALIDA'
  | 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA'
  | 'ORDEN_INVALIDO'
  | 'REPETICION_INCOMPLETA'
  | 'REGISTRO_FALTANTE'
  | 'LINEA_DEMASIADO'
  | 'ESTRUCTURA_AMBIGUA'
  /** Errores de campo propagados de las primitivas de registro. */
  | CodigoErrorValor;

export interface ErrorArchivo {
  readonly codigo: CodigoErrorArchivo;
  /**
   * Línea 1-based. En parseo de archivo es la línea física; en serialización es el
   * ordinal de la entrada (la línea que ocupa en el archivo de salida).
   */
  readonly linea?: number;
  /** id del registro involucrado (esperado, mal ubicado o de la entrada con problema). */
  readonly registroId?: string;
  /** Segundo registro involucrado (pares), si aplica. */
  readonly otroRegistroId?: string;
  readonly registros?: readonly string[];
  readonly campoId?: string;
  /** Posición 1-based dentro del registro (errores de campo en bytes recibidos). */
  readonly posicion?: number;
  /** Ruta de repeticiones activa al momento del error. */
  readonly ruta?: readonly number[];
}

function bytesSeparador(value: '\r\n' | '\n'): Uint8Array {
  return value === '\n' ? Uint8Array.of(0x0a) : Uint8Array.of(0x0d, 0x0a);
}

/**
 * Serializa la secuencia de registros según la estructura del FileSpec. Errores
 * acumulables en orden determinista; sin datos de registros en los detalles.
 */
export function serializarArchivo(
  spec: FileSpec,
  entradas: readonly EntradaRegistro[],
): Result<Uint8Array, readonly ErrorArchivo[]> {
  if (!validarFileSpec(spec).ok) {
    return { ok: false, error: [{ codigo: 'SPEC_INVALIDA' }] };
  }

  const ids = spec.records.map((registro) => registro.id);
  const erroresDeIds: ErrorArchivo[] = [];
  entradas.forEach((entrada, indice) => {
    if (!ids.includes(entrada.recordId)) {
      erroresDeIds.push({
        codigo: 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA',
        registroId: entrada.recordId,
        linea: indice + 1,
      });
    }
  });
  if (erroresDeIds.length > 0) {
    return { ok: false, error: erroresDeIds };
  }

  const ejecucion = ejecutarEstructura(
    spec.structure,
    entradas.map((entrada) => ({ recordId: entrada.recordId })),
  );
  if (!ejecucion.ok) {
    const { error, indice } = ejecucion;
    const erroresArchivo: ErrorArchivo[] =
      error.registroId === undefined
        ? error.ruta === undefined
          ? [{ codigo: error.codigo }]
          : [{ codigo: error.codigo, ruta: error.ruta }]
        : error.ruta === undefined
          ? [{ codigo: error.codigo, registroId: error.registroId }]
          : [{ codigo: error.codigo, registroId: error.registroId, ruta: error.ruta }];
    if (indice < entradas.length) {
      const conLinea = erroresArchivo.map((detalle) => ({ ...detalle, linea: indice + 1 }));
      return { ok: false, error: conLinea };
    }
    return { ok: false, error: erroresArchivo };
  }

  const erroresDeCampos: ErrorArchivo[] = [];
  const segmentos: Uint8Array[] = [];
  entradas.forEach((entrada, indice) => {
    const registro = spec.records.find((r) => r.id === entrada.recordId);
    if (registro === undefined) {
      return; // inalcanzable: los ids ya fueron verificados
    }
    const fisico = serializarRegistro(registro, entrada.valores);
    if (!fisico.ok) {
      fisico.error.forEach((detalle) => {
        const deCampo: ErrorArchivo =
          detalle.campoId === undefined
            ? { codigo: detalle.codigo, registroId: registro.id, linea: indice + 1 }
            : {
                codigo: detalle.codigo,
                campoId: detalle.campoId,
                registroId: registro.id,
                linea: indice + 1,
              };
        erroresDeCampos.push(deCampo);
      });
      return;
    }
    segmentos.push(fisico.value);
  });
  if (erroresDeCampos.length > 0) {
    return { ok: false, error: erroresDeCampos };
  }

  return { ok: true, value: componerBytes(segmentos, spec) };
}

/** Separa segmentos con `lineSeparator.value` y respeta `trailingSeparator.value`. */
export function componerBytes(segmentos: readonly Uint8Array[], spec: FileSpec): Uint8Array {
  const bytesSep = bytesSeparador(spec.lineSeparator.value);
  const total =
    segmentos.reduce((suma, segmento) => suma + segmento.length, 0) +
    bytesSep.length *
      (spec.trailingSeparator.value ? segmentos.length : Math.max(0, segmentos.length - 1));
  const salida = new Uint8Array(total);
  let cursor = 0;
  segmentos.forEach((segmento, indice) => {
    salida.set(segmento, cursor);
    cursor += segmento.length;
    const esUltimo = indice === segmentos.length - 1;
    if (spec.trailingSeparator.value || !esUltimo) {
      salida.set(bytesSep, cursor);
      cursor += bytesSep.length;
    }
  });
  return salida;
}
