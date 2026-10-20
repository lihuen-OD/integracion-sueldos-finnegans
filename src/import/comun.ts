// Utilidades compartidas por los parsers de Finnegans y del maestro. Trabajan sobre el contrato
// del adaptador XLSX (nunca sobre ExcelJS) y no interpretan valores de negocio.
import type { ValorLeido } from '../domain/maestro';
import type { CellValue, Row, Sheet } from './xlsx';

/** Letra de columna de Excel para un número 1-based (1 → A, 27 → AA). */
export function letraColumna(numero: number): string {
  let resto = numero;
  let letras = '';
  while (resto > 0) {
    const indice = (resto - 1) % 26;
    letras = String.fromCharCode(65 + indice) + letras;
    resto = (resto - 1 - indice) / 26;
  }
  return letras;
}

/** N-01 (D-046): compara encabezados sin distinguir mayúsculas, acentos ni espacios extremos. */
export function normalizarEncabezado(texto: string): string {
  return texto.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function celdaEn(fila: Row | undefined, columna: number): CellValue | undefined {
  return fila?.cells.find((celda) => celda.column === columna)?.value;
}

/** Cómo llegó una celda. Celda ausente = texto vacío (hallazgo 1 del spike F1). */
export function leerValor(celda: CellValue | undefined): ValorLeido {
  switch (celda?.kind) {
    case undefined:
      return { tipo: 'TEXTO', texto: '' };
    case 'text':
      return { tipo: 'TEXTO', texto: celda.text };
    case 'number':
      return { tipo: 'NUMERO', texto: celda.text };
    case 'formula':
      return { tipo: 'FORMULA' };
    default:
      return { tipo: 'OTRO' };
  }
}

export interface Encabezados {
  /** Columna de cada encabezado esperado encontrado (clave: nombre canónico). */
  readonly columnas: ReadonlyMap<string, number>;
  /** Encabezados esperados que aparecen más de una vez, con sus columnas. */
  readonly duplicados: ReadonlyMap<string, readonly number[]>;
  readonly faltantes: readonly string[];
  /** Columnas con texto no previsto en el contrato. */
  readonly desconocidas: readonly { readonly columna: number; readonly texto: string }[];
  /** Columnas de la fila 1 con fórmula. */
  readonly formulas: readonly number[];
  /** Columnas de la fila 1 con un valor que no es texto (número, fecha, etc.). */
  readonly noTexto: readonly number[];
}

/** Analiza la fila 1 de una hoja contra los encabezados esperados (N-01). */
export function analizarEncabezados(hoja: Sheet, esperados: readonly string[]): Encabezados {
  const porNormalizado = new Map(esperados.map((nombre) => [normalizarEncabezado(nombre), nombre]));
  const columnas = new Map<string, number>();
  const duplicados = new Map<string, number[]>();
  const desconocidas: { columna: number; texto: string }[] = [];
  const formulas: number[] = [];
  const noTexto: number[] = [];
  const fila1 = hoja.rows.find((fila) => fila.rowNumber === 1);
  for (const celda of fila1?.cells ?? []) {
    if (celda.value.kind === 'formula') {
      formulas.push(celda.column);
    } else if (celda.value.kind !== 'text') {
      noTexto.push(celda.column);
    } else {
      const canonico = porNormalizado.get(normalizarEncabezado(celda.value.text));
      const primera = canonico === undefined ? undefined : columnas.get(canonico);
      if (canonico === undefined) {
        desconocidas.push({ columna: celda.column, texto: celda.value.text });
      } else if (primera === undefined) {
        columnas.set(canonico, celda.column);
      } else {
        duplicados.set(canonico, [...(duplicados.get(canonico) ?? [primera]), celda.column]);
      }
    }
  }
  return {
    columnas,
    duplicados,
    faltantes: esperados.filter((nombre) => !columnas.has(nombre)),
    desconocidas,
    formulas,
    noTexto,
  };
}

/** Cantidad de filas vacías entre la fila 2 y la última fila con datos (el adaptador las omite). */
export function filasVaciasIntermedias(datos: readonly Row[]): number {
  return Math.max(1, ...datos.map((fila) => fila.rowNumber)) - 1 - datos.length;
}

/** Columna de cada encabezado esperado, o null si falta alguno. */
export function columnasCompletas<K extends string>(
  encabezados: Encabezados,
  esperados: readonly K[],
): Readonly<Record<K, number>> | null {
  const resultado: Partial<Record<K, number>> = {};
  for (const nombre of esperados) {
    const columna = encabezados.columnas.get(nombre);
    if (columna === undefined) {
      return null;
    }
    resultado[nombre] = columna;
  }
  return resultado as Record<K, number>;
}
