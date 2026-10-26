// Validaciones BNA puras (CP-F5-B). No resuelven preguntas abiertas: solo aplican las
// reglas documentadas de formato, longitud, convenio y alfabeto. La fecha se valida
// únicamente como forma técnica AAAAMMDD; BNA-7 (calendario/feriados) sigue abierta.
// BNA-8 no autoriza transformar: minúsculas, ñ, acentos, tabulaciones, CR/LF y cualquier
// carácter fuera de A–Z/0–9/espacio se rechazan tal como llegan.
import type { Result } from '../../shared/result';
import { REGISTROS_BNA } from './spec';

export type ErrorConvenioBna =
  'CONVENIO_NO_NUMERICO' | 'CONVENIO_LONGITUD_BNA5' | 'CONVENIO_LONGITUD_INVALIDA';

export type ErrorTextoBna = 'ALFABETO_BNA8_INVALIDO' | 'LONGITUD_EXCEDIDA';
export type ErrorDigitosBna = 'DIGITO_INVALIDO' | 'LONGITUD_EXCEDIDA';
export type ErrorFechaBna = 'FECHA_COMPENSACION_INVALIDA';
export type ErrorNumeroEnvioBna = 'NUMERO_ENVIO_INVALIDO';
export type ErrorMonedaBna = 'MONEDA_INVALIDA';

const CAMPOS_BNA = REGISTROS_BNA.flatMap((registro) => registro.fields);

/** Longitud declarada por la spec canónica. No se duplican posiciones ni longitudes. */
export function longitudCampoBna(campoId: string): number {
  const campo = CAMPOS_BNA.find((candidato) => candidato.id === campoId);
  if (campo === undefined) {
    throw new Error(`campo BNA inexistente: ${campoId}`);
  }
  return campo.declaredLength;
}

/**
 * Convenio documentado: 4 dígitos → `00` + 4 + `0000`; 8 dígitos → `00` + 8.
 * 5, 6 y 7 siguen BNA-5 y se rechazan sin adivinar relleno. Devuelve el valor
 * listo para el campo de 10 bytes (no se usa padding genérico).
 */
export function validarConvenioBna(codigo: string): Result<string, ErrorConvenioBna> {
  if (!/^[0-9]+$/.test(codigo)) {
    return { ok: false, error: 'CONVENIO_NO_NUMERICO' };
  }
  if (codigo.length === 4) {
    return { ok: true, value: `00${codigo}0000` };
  }
  if (codigo.length === 8) {
    return { ok: true, value: `00${codigo}` };
  }
  if (codigo.length >= 5 && codigo.length <= 7) {
    return { ok: false, error: 'CONVENIO_LONGITUD_BNA5' };
  }
  return { ok: false, error: 'CONVENIO_LONGITUD_INVALIDA' };
}

/** Alfabeto A confirmado: mayúsculas ASCII A–Z, dígitos 0–9 y espacio. Sin transformar. */
export function validarAlfabetoBna(texto: string): Result<string, ErrorTextoBna> {
  if (!/^[A-Z0-9 ]*$/.test(texto)) {
    return { ok: false, error: 'ALFABETO_BNA8_INVALIDO' };
  }
  return { ok: true, value: texto };
}

/** Texto de un campo A: alfabeto BNA-8 y longitud de la spec. */
export function validarTextoBna(texto: string, campoId: string): Result<string, ErrorTextoBna> {
  const alfabeto = validarAlfabetoBna(texto);
  if (!alfabeto.ok) {
    return alfabeto;
  }
  if (texto.length > longitudCampoBna(campoId)) {
    return { ok: false, error: 'LONGITUD_EXCEDIDA' };
  }
  return { ok: true, value: texto };
}

/** Dígitos ASCII no vacíos y ajustados a la longitud declarada del campo. */
export function validarDigitosBna(texto: string, campoId: string): Result<string, ErrorDigitosBna> {
  if (!/^[0-9]+$/.test(texto)) {
    return { ok: false, error: 'DIGITO_INVALIDO' };
  }
  if (texto.length > longitudCampoBna(campoId)) {
    return { ok: false, error: 'LONGITUD_EXCEDIDA' };
  }
  return { ok: true, value: texto };
}

/** Forma técnica de la fecha (8 dígitos). No valida calendario ni resuelve BNA-7. */
export function validarFechaCompensacionBna(fecha: string): Result<string, ErrorFechaBna> {
  if (!/^[0-9]{8}$/.test(fecha)) {
    return { ok: false, error: 'FECHA_COMPENSACION_INVALIDA' };
  }
  return { ok: true, value: fecha };
}

/** Número de envío explícito: dígitos ASCII y longitud del campo. Sin regla de día. */
export function validarNumeroEnvioBna(numero: string): Result<string, ErrorNumeroEnvioBna> {
  if (!/^[0-9]+$/.test(numero) || numero.length > longitudCampoBna('r1_numeroEnvio')) {
    return { ok: false, error: 'NUMERO_ENVIO_INVALIDO' };
  }
  return { ok: true, value: numero };
}

export function validarMonedaBna(moneda: string): Result<'0' | '1', ErrorMonedaBna> {
  if (moneda !== '0' && moneda !== '1') {
    return { ok: false, error: 'MONEDA_INVALIDA' };
  }
  return { ok: true, value: moneda };
}
