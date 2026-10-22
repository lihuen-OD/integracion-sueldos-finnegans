// CivilDate (D-044: pasa su implementación a F3): fecha civil año-mes-día sin timezone,
// con representación canónica `YYYY-MM-DD` (la misma de la plantilla del maestro y del
// diagnóstico del spike). Es un tipo puro del dominio: no usa `Date` nativa como
// representación, no conoce formatos bancarios (las transformaciones a `AAAAAMMDD`
// pertenecen a las fases bancarias posteriores) y no incurre en reglas no aprobadas.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

/** Fecha civil validada, siempre en la forma canónica `YYYY-MM-DD`. */
export type CivilDate = Brand<string, 'CivilDate'>;

export type ErrorCivilDate =
  'VACIO' | 'FORMATO_INVALIDO' | 'MES_FUERA_DE_RANGO' | 'DIA_FUERA_DE_RANGO';

const CANONICA = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

/** Año bisiesto del calendario gregoriano: excepción de los siglos no divisibles por 400. */
export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function diasEnMes(anio: number, mes: number): number {
  if (mes === 2 && esBisiesto(anio)) {
    return 29;
  }
  return DIAS_POR_MES[mes - 1] ?? 0;
}

function aDosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

function canonica(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, '0')}-${aDosDigitos(mes)}-${aDosDigitos(dia)}`;
}

/** Construye una fecha civil desde componentes (enteros), validando el calendario. */
export function civilDateCanonico(
  anio: number,
  mes: number,
  dia: number,
): Result<CivilDate, ErrorCivilDate> {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
    return { ok: false, error: 'FORMATO_INVALIDO' };
  }
  if (anio < 0 || anio > 9999) {
    return { ok: false, error: 'FORMATO_INVALIDO' };
  }
  if (mes < 1 || mes > 12) {
    return { ok: false, error: 'MES_FUERA_DE_RANGO' };
  }
  if (dia < 1 || dia > diasEnMes(anio, mes)) {
    return { ok: false, error: 'DIA_FUERA_DE_RANGO' };
  }
  return { ok: true, value: canonica(anio, mes, dia) as CivilDate };
}

/**
 * Valida un texto y devuelve la fecha civil en la forma canónica `YYYY-MM-DD` (D-044).
 * ESTRICTO: acepta únicamente la representación canónica exacta, sin ningún espacio
 * (ni en extremos ni internos). No normaliza silenciosamente: no corrige, no reinterpreta
 * otros formatos (AA-MM-DD, AAAAMMDD, con barras o puntos ni con espacios extremos). Los
 * errores nunca incluyen el valor; el texto original lo conserva quien llama.
 */
export function parseCivilDate(texto: string): Result<CivilDate, ErrorCivilDate> {
  if (texto === '') {
    return { ok: false, error: 'VACIO' };
  }
  const partes = CANONICA.exec(texto);
  if (partes === null) {
    return { ok: false, error: 'FORMATO_INVALIDO' };
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12) {
    return { ok: false, error: 'MES_FUERA_DE_RANGO' };
  }
  if (dia < 1 || dia > diasEnMes(anio, mes)) {
    return { ok: false, error: 'DIA_FUERA_DE_RANGO' };
  }
  return { ok: true, value: texto as CivilDate };
}

/** Devuelve la misma fecha civil: el tipo es canónico, el round-trip es identidad. */
export function serializarCivilDate(fecha: CivilDate): string {
  return fecha;
}

/** Componentes de la fecha civil (todos enteros positivos). */
export function partesDeCivilDate(fecha: CivilDate): { anio: number; mes: number; dia: number } {
  const partes = CANONICA.exec(fecha);
  if (partes === null) {
    throw new Error('Fecha civil no canónica.');
  }
  return { anio: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
}
