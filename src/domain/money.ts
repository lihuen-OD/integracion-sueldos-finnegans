// Importes en centavos como bigint (D-031). Con signo, para poder representar e informar
// netos negativos (D-045); las reglas de pago son las que exigen neto > 0.
// En este archivo ESLint prohíbe Number, parseInt, Math, parseFloat y toFixed: el dinero se
// opera solo con bigint y strings.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

export type Centavos = Brand<bigint, 'Centavos'>;

export type ErrorImporte = 'FORMATO_INVALIDO' | 'MAS_DE_2_DECIMALES' | 'FUERA_DE_RANGO';

/**
 * Máximo de dígitos enteros que se aceptan al leer un importe. Con 13 enteros y 2 decimales
 * (15 dígitos significativos) cualquier decimal sobrevive exacto al pasar por un double
 * (DBL_DIG = 15), que es como Excel guarda los números. Es un límite de representación de
 * la fuente, no un límite bancario: los máximos de cada layout se controlan en F5/F6 (D-047).
 * Aprobado como límite técnico de precisión en D-055.
 */
export const MAX_DIGITOS_ENTEROS = 13;

/** Decimal canónico: sin signo `+`, sin ceros a la izquierda, sin exponente, punto decimal. */
const DECIMAL_ESTRICTO = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

export const CERO = 0n as Centavos;

/**
 * Convierte el texto decimal mínimo de ida y vuelta que entrega el adaptador XLSX
 * (`String(n)`) en centavos. Nunca redondea: más de 2 decimales, notación científica o
 * cualquier otra forma se rechaza para que la regla correspondiente la informe.
 */
export function parseImporte(texto: string): Result<Centavos, ErrorImporte> {
  const match = DECIMAL_ESTRICTO.exec(texto);
  if (match === null) {
    return { ok: false, error: 'FORMATO_INVALIDO' };
  }
  const [, signo = '', enteros = '0', decimales = ''] = match;
  if (decimales.length > 2) {
    return { ok: false, error: 'MAS_DE_2_DECIMALES' };
  }
  if (enteros.length > MAX_DIGITOS_ENTEROS) {
    return { ok: false, error: 'FUERA_DE_RANGO' };
  }
  const absoluto = BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
  return { ok: true, value: (signo === '-' ? -absoluto : absoluto) as Centavos };
}

export function sumar(a: Centavos, b: Centavos): Centavos {
  return (a + b) as Centavos;
}

export function restar(a: Centavos, b: Centavos): Centavos {
  return (a - b) as Centavos;
}

export function sumarTodos(importes: Iterable<Centavos>): Centavos {
  let total = CERO;
  for (const importe of importes) {
    total = sumar(total, importe);
  }
  return total;
}

export function esCero(importe: Centavos): boolean {
  return importe === 0n;
}

export function esNegativo(importe: Centavos): boolean {
  return importe < 0n;
}

function partes(importe: Centavos): { signo: string; enteros: string; decimales: string } {
  const valor: bigint = importe;
  const absoluto = valor < 0n ? -valor : valor;
  return {
    signo: valor < 0n ? '-' : '',
    enteros: (absoluto / 100n).toString(),
    decimales: (absoluto % 100n).toString().padStart(2, '0'),
  };
}

/** Texto decimal canónico con punto (`-1234.05`), para trazabilidad y pruebas. */
export function aTextoDecimal(importe: Centavos): string {
  const { signo, enteros, decimales } = partes(importe);
  return `${signo}${enteros}.${decimales}`;
}

/** Formato argentino para mostrar (`-1.234,05`). */
export function formatearImporte(importe: Centavos): string {
  const { signo, enteros, decimales } = partes(importe);
  return `${signo}${enteros.replace(/\B(?=(?:[0-9]{3})+$)/g, '.')},${decimales}`;
}
