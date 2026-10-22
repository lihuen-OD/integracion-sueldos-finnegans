// Parser RAW de UN registro (T4-5). Entrada física: Uint8Array. Observa bytes:
// SIN trim, SIN parseInt/Number, SIN quitar ceros (`02` → `02`, `0000` → `0000`) ni
// espacios (interiores y finales preservados), SIN canonicalizar ni interpretar
// semántica bancaria. Cada slice crudo se preserva de ancho completo (vistas del
// argumento, sin copiar). N: solo dígitos ASCII; A: ASCII printable (D-074).
// fixedValue: comparación exacta byte a byte. Errores acumulados en orden determinista
// con ubicación técnica (fieldId/posición 1-based); NUNCA el contenido del registro.
// Independencia: no llama al serializer para validarse ni comparte su lógica.

import type { Result } from '../../shared/result';
import { decodificarAscii, esByteAsciiPrintable, esDigitoAscii } from './ascii';
import { validarRecordSpec } from './validacion';
import type { RecordSpec, ValoresPorCampo } from './tipos';

export type CodigoErrorParser =
  | 'LONGITUD_INVALIDA'
  | 'CARACTER_NO_ADMITIDO'
  | 'DIGITO_INVALIDO'
  | 'VALOR_FIJO_INCORRECTO'
  /** RecordSpec con geometría/relleno/fijos inválidos (precondición). */
  | 'SPEC_INVALIDA';

export interface ErrorParser {
  readonly codigo: CodigoErrorParser;
  readonly campoId?: string;
  /** Posición 1-based dentro del registro. */
  readonly posicion?: number;
}

export interface CampoCrudo {
  readonly campoId: string;
  /** Vista de ancho completo sobre los bytes del registro (no copia). */
  readonly bytes: Uint8Array;
}

export interface RegistroCrudo {
  readonly registroId: string;
  /** Representación RAW de ancho completo por campo (1 carácter = 1 byte ASCII). */
  readonly valores: ValoresPorCampo;
  readonly campos: readonly CampoCrudo[];
}

/**
 * Parsea el registro según la spec. Valida longitud exacta, ASCII global, comparación
 * byte a byte de los campos fijos y dígitos de N. Acumula errores: primero longitud,
 * luego violaciones ASCII por posición ascendente, luego campos en orden de spec.
 */
export function parsearRegistro(
  spec: RecordSpec,
  bytes: Uint8Array,
): Result<RegistroCrudo, readonly ErrorParser[]> {
  const validez = validarRecordSpec(spec);
  if (!validez.ok) {
    return { ok: false, error: [{ codigo: 'SPEC_INVALIDA' }] };
  }
  const errores: ErrorParser[] = [];
  if (bytes.length !== spec.recordLength) {
    return { ok: false, error: [{ codigo: 'LONGITUD_INVALIDA' }] };
  }
  let posicion = 1;
  for (const byte of bytes) {
    if (!esByteAsciiPrintable(byte)) {
      errores.push({ codigo: 'CARACTER_NO_ADMITIDO', posicion });
    }
    posicion += 1;
  }
  for (const campo of spec.fields) {
    const desde = campo.start - 1;
    if (campo.fixedValue !== undefined) {
      let primeraDiferencia = null;
      for (let p = 0; p < campo.fixedValue.length; p += 1) {
        const byteReal = bytes[desde + p];
        const byteEsperado = campo.fixedValue.charCodeAt(p);
        if (byteReal === undefined || byteReal !== byteEsperado) {
          primeraDiferencia = desde + p + 1;
          break;
        }
      }
      if (primeraDiferencia !== null) {
        errores.push({
          codigo: 'VALOR_FIJO_INCORRECTO',
          campoId: campo.id,
          posicion: primeraDiferencia,
        });
      }
    }
    if (campo.type === 'N') {
      let posicionCampo = desde + 1;
      for (const byte of bytes.subarray(desde, campo.end)) {
        if (!esDigitoAscii(byte)) {
          errores.push({
            codigo: 'DIGITO_INVALIDO',
            campoId: campo.id,
            posicion: posicionCampo,
          });
        }
        posicionCampo += 1;
      }
    }
  }
  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      registroId: spec.id,
      valores: Object.fromEntries(
        spec.fields.map((campo) => [
          campo.id,
          decodificarAscii(bytes.subarray(campo.start - 1, campo.end)),
        ]),
      ),
      campos: spec.fields.map((campo) => ({
        campoId: campo.id,
        bytes: bytes.subarray(campo.start - 1, campo.end),
      })),
    },
  };
}
