// Serializer de UN registro (T4-4). Entrada: valores lógicos de los campos variables.
// Los `fixedValue` los escribe la spec (proporcionarlos es error). Reglas (docs/02, D-071):
// N: solo dígitos ASCII, vacío → error, ZERO_LEFT, overflow → error, nunca truncar.
// A: ASCII printable, vacío permitido (→ espacios), SPACE_RIGHT, overflow → error.
// La clave AUSENTE de un campo variable es VALOR_FALTANTE (la clave con "" son espacios).
// Salida física: exactamente `recordLength` bytes (ASCII printable, D-074).
// Independencia: no llama al parser, no conoce archivos ni bancos. Comparte solo
// primitivas neutrales (tipos, Result, codec ASCII, validación de spec aprobada).

import type { Result } from '../../shared/result';
import { codificarAscii, esDigitoAscii } from './ascii';
import { validarRecordSpec } from './validacion';
import type { RecordSpec, ValoresPorCampo } from './tipos';

export type CodigoErrorValor =
  /** clave presente para un campo con `fixedValue`. */
  | 'VALOR_EN_CAMPO_FIJO'
  /** clave ausente de un campo variable requerido. */
  | 'VALOR_FALTANTE'
  /** '' para N (no tiene representación: ningún carácter minimiza a espacios también en N). */
  | 'VACIO_NO_PERMITIDO'
  | 'CARACTER_INVALIDO'
  /** N con un byte que no es dígito ASCII. */
  | 'DIGITO_INVALIDO'
  | 'LONGITUD_EXCEDIDA'
  /** clave que no corresponde a ningún FieldSpec; no se ignora en silencio. */
  | 'VALOR_DESCONOCIDO'
  /** RecordSpec con geometría/relleno/fijos inválidos (precondición). */
  | 'SPEC_INVALIDA';

export interface ErrorValor {
  readonly codigo: CodigoErrorValor;
  readonly campoId?: string;
}

const BYTE_ESPACIO = 0x20;
const BYTE_CERO = 0x30;

/**
 * Serializa valores lógicos al registro físico exacto. Acumula todos los errores en
 * orden determinista: claves desconocidas (alfabético), luego campos en orden de spec.
 */
export function serializarRegistro(
  spec: RecordSpec,
  valores: ValoresPorCampo,
): Result<Uint8Array, readonly ErrorValor[]> {
  const validez = validarRecordSpec(spec);
  if (!validez.ok) {
    return { ok: false, error: [{ codigo: 'SPEC_INVALIDA' }] };
  }

  const errores: ErrorValor[] = [];
  const bytesPorCampo = new Map<string, Uint8Array>();
  for (const clave of Object.keys(valores).sort()) {
    if (!spec.fields.some((campo) => campo.id === clave)) {
      errores.push({ codigo: 'VALOR_DESCONOCIDO', campoId: clave });
    }
  }

  for (const campo of spec.fields) {
    const valor = valores[campo.id];
    if (campo.fixedValue !== undefined) {
      if (valor !== undefined) {
        errores.push({ codigo: 'VALOR_EN_CAMPO_FIJO', campoId: campo.id });
      }
      continue;
    }
    if (valor === undefined) {
      errores.push({ codigo: 'VALOR_FALTANTE', campoId: campo.id });
      continue;
    }
    const codificado = codificarAscii(valor);
    if (!codificado.ok) {
      errores.push({ codigo: 'CARACTER_INVALIDO', campoId: campo.id });
      continue;
    }
    if (campo.type === 'N') {
      if (valor === '') {
        errores.push({ codigo: 'VACIO_NO_PERMITIDO', campoId: campo.id });
        continue;
      }
      if (!codificado.value.every(esDigitoAscii)) {
        errores.push({ codigo: 'DIGITO_INVALIDO', campoId: campo.id });
        continue;
      }
    }
    if (codificado.value.length > campo.declaredLength) {
      errores.push({ codigo: 'LONGITUD_EXCEDIDA', campoId: campo.id });
      continue;
    }
    bytesPorCampo.set(campo.id, valor === '' ? new Uint8Array(0) : codificado.value);
  }
  if (errores.length > 0) {
    return { ok: false, error: errores };
  }

  const salida = new Uint8Array(spec.recordLength).fill(BYTE_ESPACIO);
  for (const campo of spec.fields) {
    if (campo.fixedValue !== undefined) {
      for (let p = 0; p < campo.fixedValue.length; p += 1) {
        salida[campo.start - 1 + p] = campo.fixedValue.charCodeAt(p);
      }
      continue;
    }
    const bytes = bytesPorCampo.get(campo.id);
    if (bytes === undefined) {
      continue; // inalcanzable: con errores vacíos todo campo variable fue codificado
    }
    if (campo.padding.kind === 'ZERO_LEFT') {
      const relleno = campo.declaredLength - bytes.length;
      for (let p = 0; p < relleno; p += 1) {
        salida[campo.start - 1 + p] = BYTE_CERO;
      }
      bytes.forEach((byte, p) => {
        salida[campo.start - 1 + relleno + p] = byte;
      });
    } else {
      bytes.forEach((byte, p) => {
        salida[campo.start - 1 + p] = byte;
      });
    }
  }
  return { ok: true, value: salida };
}
