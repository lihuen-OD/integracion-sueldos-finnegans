// Parser de archivo (T4-8; D-070, D-071). Semántica del parser a nivel registro: RAW, sin
// trim, sin parseInt, sin quitar ceros ni espacios, sin canonicalizar. A nivel archivo:
// 1) precondición técnica compartida (`validarFileSpec` → SPEC_INVALIDA sin procesar bytes);
// 2) escáner byte a byte con errores acumulados y orden determinista: BOM (solo al inicio,
// por ocurrencia del prefijo EF BB BF / FF FE / FE FF), SEPARADOR_MIXTO (por ocurrencia del
// alternativo), LINEA_VACIA (por línea vacía con su número), SEPARADOR_FINAL_INVALIDO
// (compara con `trailingSeparator.value`); ante errores del escáner la ejecución DETIENE
// (no procesa contenido corrupto); 3) identificación + parse por línea con la secuencia
// aprobada: LONGITUD_LINEA_INVALIDA (no coincide con ningún recordLength) →
// REGISTRO_DESCONOCIDO / REGISTRO_AMBIGUO → parse; la primera línea problemática DETIENE;
// 4) ejecución estructural ÚNICA al final (comparte el walker con el serializer) que
// asigna `rutaRepeticiones` (contadores 1-based, exterior → interior, D-070/D-073).
// Sin semántica bancaria; errores técnicos, jamás el contenido del registro.

import type { Result } from '../../shared/result';
import { identificarRegistro } from './identificacion';
import { parsearRegistro } from './parser';
import type { CodigoErrorParser } from './parser';
import { ejecutarEstructura } from './estructuraRuntime';
import { validarFileSpec } from './validacion';
import type { FileSpec, ValoresPorCampo } from './tipos';

export type CodigoErrorParseoArchivo =
  | 'SPEC_INVALIDA'
  | 'ARCHIVO_VACIO'
  | 'BOM_DETECTADO'
  | 'SEPARADOR_MIXTO'
  | 'SEPARADOR_FINAL_INVALIDO'
  | 'LINEA_VACIA'
  | 'LONGITUD_LINEA_INVALIDA'
  | 'REGISTRO_DESCONOCIDO'
  | 'REGISTRO_AMBIGUO'
  /** Errores de parse de UN registro, propagados con ubicación de línea/offset. */
  | CodigoErrorParser
  | 'ORDEN_INVALIDO'
  | 'REPETICION_INCOMPLETA'
  | 'REGISTRO_FALTANTE'
  | 'LINEA_DEMASIADO'
  | 'ESTRUCTURA_AMBIGUA';

export interface ErrorParseoArchivo {
  readonly codigo: CodigoErrorParseoArchivo;
  /** Línea 1-based del segmento involucrado (EOF esperado para REGISTRO_FALTANTE la omiten). */
  readonly linea?: number;
  /** Offset 0-based del primer byte del segmento involucrado. */
  readonly offset?: number;
  readonly registroId?: string;
  /** Segundo registro involucrado (pares), si aplica. */
  readonly otroRegistroId?: string;
  readonly registros?: readonly string[];
  readonly campoId?: string;
  /** Posición 1-based dentro del registro (errores de parse de UN registro). */
  readonly posicion?: number;
  /** Ruta de repeticiones activa al momento del error estructural. */
  readonly ruta?: readonly number[];
}

export interface CampoArchivo {
  readonly campoId: string;
  readonly bytes: Uint8Array;
}

/** RegistroCrudo + momentos del archivo: línea física, offset en bytes del archivo y ruta. */
export interface RegistroArchivo {
  readonly registroId: string;
  /** Representación RAW de ancho completo por campo (1 carácter = 1 byte ASCII). */
  readonly valores: ValoresPorCampo;
  readonly campos: readonly CampoArchivo[];
  /** Línea física 1-based. */
  readonly linea: number;
  /** Offset 0-based del primer byte del registro dentro del archivo. */
  readonly offset: number;
  readonly rutaRepeticiones: readonly number[];
}

export interface ArchivoParseado {
  readonly registros: readonly RegistroArchivo[];
}

interface Segmento {
  readonly linea: number;
  readonly offset: number;
  readonly bytes: Uint8Array;
}

function esBom(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) ||
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  );
}

/** Escáner byte a byte: BOM, mezcla de separadores, líneas vacías y separador final. */
function escanear(
  bytes: Uint8Array,
  spec: FileSpec,
): {
  readonly errores: readonly ErrorParseoArchivo[];
  readonly segmentos: readonly Segmento[];
} {
  if (esBom(bytes)) {
    return { errores: [{ codigo: 'BOM_DETECTADO', offset: 0 }], segmentos: [] };
  }
  const lm = spec.lineSeparator.value;
  const sep: readonly number[] = lm === '\n' ? [0x0a] : [0x0d, 0x0a];
  const esConfigurado = (i: number): boolean => {
    if (i + sep.length > bytes.length) {
      return false;
    }
    return sep.every((b, j) => bytes[i + j] === b);
  };

  const errores: ErrorParseoArchivo[] = [];
  if (lm === '\n') {
    // El alternativo ('\r\n') empieza por 0x0d: cada 0x0d es una ocurrencia (con LF o sola);
    // la pareja CR+LF cuenta como UNA ocurrencia del alternativo.
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 0x0d) {
        errores.push({ codigo: 'SEPARADOR_MIXTO', offset: i });
        if (bytes[i + 1] === 0x0a) {
          i += 1;
        }
      }
    }
  } else {
    // El alternativo ('\n') es un 0x0a que no cierra un '\r\n' configurado.
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 0x0a && bytes[i - 1] !== 0x0d) {
        errores.push({ codigo: 'SEPARADOR_MIXTO', offset: i });
      }
    }
  }

  // Corte por el separador configurado; el final SIN separador se permite si trailing=false.
  const segmentos: Segmento[] = [];
  const cortes: number[] = [0];
  for (let i = 0; i < bytes.length; i += 1) {
    if (esConfigurado(i)) {
      cortes.push(i);
      cortes.push(i + sep.length);
      i += sep.length - 1;
    }
  }
  cortes.push(bytes.length);
  const terminaConSep =
    bytes.length >= sep.length &&
    sep.every((byte, j) => bytes[bytes.length - sep.length + j] === byte);
  // El corte (len,len) tras un separador terminal no genera una línea adicional: separa el
  // "reasentado" del final, con o sin `trailingSeparator.value` (si no coincide con el
  // valor declarado, el SEPARADOR_FINAL_INVALIDO ya corta la ejecución).
  const lineaFinalTrasSeparador = terminaConSep ? bytes.length : Number.NaN;
  for (let c = 0; c + 1 < cortes.length; c += 2) {
    const desde = cortes[c];
    const hasta = cortes[c + 1];
    if (desde === undefined || hasta === undefined) {
      break;
    }
    if (desde === hasta && hasta === lineaFinalTrasSeparador) {
      break;
    }
    segmentos.push({
      linea: segmentos.length + 1,
      offset: desde,
      bytes: bytes.slice(desde, hasta),
    });
  }
  for (const segmento of segmentos) {
    if (segmento.bytes.length === 0) {
      errores.push({ codigo: 'LINEA_VACIA', linea: segmento.linea, offset: segmento.offset });
    }
  }
  if (terminaConSep && !spec.trailingSeparator.value) {
    errores.push({ codigo: 'SEPARADOR_FINAL_INVALIDO', offset: bytes.length - sep.length });
  }
  if (!terminaConSep && spec.trailingSeparator.value) {
    errores.push({ codigo: 'SEPARADOR_FINAL_INVALIDO' });
  }
  return { errores, segmentos };
}

function erroresDeParseConUbicacion(
  buffer: ErrorParseoArchivo[],
  errores: readonly { codigo: CodigoErrorParser; campoId?: string; posicion?: number }[],
  linea: number,
  offset: number,
  registroId: string,
): void {
  for (const error of errores) {
    const conUbicacion: ErrorParseoArchivo = {
      codigo: error.codigo,
      linea,
      offset,
      registroId,
      ...(error.campoId === undefined ? {} : { campoId: error.campoId }),
      ...(error.posicion === undefined ? {} : { posicion: error.posicion }),
    };
    buffer.push(conUbicacion);
  }
}

/**
 * Parser de archivo: escáner de bytes → por línea (longitud, identificación, parse) →
 * walk estructural final que asigna `rutaRepeticiones`. Errores acumulables por fases;
 * el escaneo y la fase de líneas se detienen al primer problema.
 */
export function parsearArchivo(
  spec: FileSpec,
  bytes: Uint8Array,
): Result<ArchivoParseado, readonly ErrorParseoArchivo[]> {
  if (!validarFileSpec(spec).ok) {
    return { ok: false, error: [{ codigo: 'SPEC_INVALIDA' }] };
  }
  if (bytes.length === 0) {
    return { ok: false, error: [{ codigo: 'ARCHIVO_VACIO' }] };
  }

  const escaneo = escanear(bytes, spec);
  if (escaneo.errores.length > 0) {
    return { ok: false, error: escaneo.errores };
  }

  const erroresDeLineas: ErrorParseoArchivo[] = [];
  const registros: RegistroArchivo[] = [];
  for (const segmento of escaneo.segmentos) {
    const longitudes = spec.records.map((registro) => registro.recordLength);
    if (!longitudes.includes(segmento.bytes.length)) {
      erroresDeLineas.push({
        codigo: 'LONGITUD_LINEA_INVALIDA',
        linea: segmento.linea,
        offset: segmento.offset,
      });
      break;
    }
    const identificado = identificarRegistro(spec.records, segmento.bytes);
    if (!identificado.ok) {
      const deIdentificacion: ErrorParseoArchivo =
        identificado.error.codigo === 'REGISTRO_AMBIGUO'
          ? {
              codigo: 'REGISTRO_AMBIGUO',
              registros: identificado.error.registros,
              linea: segmento.linea,
              offset: segmento.offset,
            }
          : {
              codigo: 'REGISTRO_DESCONOCIDO',
              linea: segmento.linea,
              offset: segmento.offset,
            };
      erroresDeLineas.push(deIdentificacion);
      break;
    }
    const parseado = parsearRegistro(identificado.value, segmento.bytes);
    if (!parseado.ok) {
      erroresDeParseConUbicacion(
        erroresDeLineas,
        parseado.error,
        segmento.linea,
        segmento.offset,
        identificado.value.id,
      );
      break;
    }
    const crudo = parseado.value;
    registros.push({
      registroId: crudo.registroId,
      valores: { ...crudo.valores },
      campos: crudo.campos.map((campo) => ({ campoId: campo.campoId, bytes: campo.bytes })),
      linea: segmento.linea,
      offset: segmento.offset,
      rutaRepeticiones: [], // asignada por el walk estructural
    });
  }
  if (erroresDeLineas.length > 0) {
    return { ok: false, error: erroresDeLineas };
  }

  const ejecucion = ejecutarEstructura(
    spec.structure,
    registros.map((reg) => ({ recordId: reg.registroId })),
  );
  if (!ejecucion.ok) {
    const { error, indice } = ejecucion;
    const base: ErrorParseoArchivo =
      error.registroId === undefined
        ? { codigo: error.codigo }
        : { codigo: error.codigo, registroId: error.registroId };
    const erroresArchivo: ErrorParseoArchivo[] = [
      error.ruta === undefined ? base : { ...base, ruta: error.ruta },
    ];
    const segmento = indice < registros.length ? escaneo.segmentos[indice] : undefined;
    if (segmento !== undefined) {
      const conUbicacion = erroresArchivo.map((detalle) => ({
        ...detalle,
        linea: segmento.linea,
        offset: segmento.offset,
      }));
      return { ok: false, error: conUbicacion };
    }
    return { ok: false, error: erroresArchivo };
  }

  const conRutas = registros.map((registro, indice) => {
    const ruta = ejecucion.rutas[indice];
    return { ...registro, rutaRepeticiones: ruta ?? [] };
  });
  return { ok: true, value: { registros: conRutas } };
}
