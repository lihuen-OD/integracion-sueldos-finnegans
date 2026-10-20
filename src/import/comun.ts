// Utilidades compartidas por los parsers de Finnegans y del maestro. Trabajan sobre el contrato
// del adaptador XLSX (nunca sobre ExcelJS) y no interpretan valores de negocio.
import {
  DESCRIPCION_CODIGO,
  type ArchivoEntrada,
  type CodigoIncidencia,
  type Hallazgo,
  type NivelIncidencia,
  type ObjetivoHallazgo,
  type SourceRef,
} from '../domain/incidencias';
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

/** Hoja de un archivo de entrada y su constructor de referencias (fila y columna 1-based). */
export interface Hoja {
  readonly nombre: string;
  readonly ref: (fila?: number, columna?: number) => SourceRef;
}

export function crearHoja(archivo: ArchivoEntrada, nombre: string): Hoja {
  return {
    nombre,
    ref: (fila, columna) => ({
      archivo,
      hoja: nombre,
      ...(fila === undefined ? {} : { fila }),
      ...(columna === undefined ? {} : { columna: letraColumna(columna) }),
    }),
  };
}

/** Hallazgo con el detalle estándar del código, salvo que se indique otro (nunca con valores). */
export function crearHallazgo(
  codigo: CodigoIncidencia,
  nivel: NivelIncidencia,
  objetivo: ObjetivoHallazgo,
  refs: readonly SourceRef[],
  extra: { campo?: string; motivo?: string; valores?: Hallazgo['valores']; detalle?: string } = {},
): Hallazgo {
  return {
    codigo,
    nivel,
    objetivo,
    refs,
    ...(extra.campo === undefined ? {} : { campo: extra.campo }),
    ...(extra.motivo === undefined ? {} : { motivo: extra.motivo }),
    ...(extra.valores === undefined ? {} : { valores: extra.valores }),
    detalle: extra.detalle ?? DESCRIPCION_CODIGO[codigo],
  };
}

/**
 * Hallazgos de la fila 1 (encabezado duplicado → BLOQUEANTE; fórmula → BLOQUEANTE; columna no
 * prevista → INFORMACION) y de columnas con datos pero sin encabezado de texto (INFORMACION).
 * Devuelve false si la hoja es ambigua (encabezado duplicado) y no debe leerse.
 */
export function revisarEncabezados(
  hoja: Hoja,
  datos: readonly Row[],
  encabezados: Encabezados,
  hallazgos: Hallazgo[],
): boolean {
  for (const [nombre, columnas] of encabezados.duplicados) {
    hallazgos.push(
      crearHallazgo(
        'ESTRUCTURA_INVALIDA',
        'BLOQUEANTE',
        'GLOBAL',
        columnas.map((columna) => hoja.ref(1, columna)),
        {
          campo: nombre,
          motivo: 'ENCABEZADO_DUPLICADO',
          detalle: 'Encabezado repetido: no se puede saber qué columna usar.',
        },
      ),
    );
  }
  for (const columna of encabezados.formulas) {
    hallazgos.push(
      crearHallazgo('FORMULA_EN_CELDA', 'BLOQUEANTE', 'GLOBAL', [hoja.ref(1, columna)]),
    );
  }
  for (const { columna, texto } of encabezados.desconocidas) {
    hallazgos.push(
      crearHallazgo('COLUMNA_DESCONOCIDA', 'INFORMACION', 'GLOBAL', [hoja.ref(1, columna)], {
        campo: texto,
      }),
    );
  }
  const conEncabezado = new Set([
    ...encabezados.columnas.values(),
    ...[...encabezados.duplicados.values()].flat(),
    ...encabezados.desconocidas.map((item) => item.columna),
    ...encabezados.formulas,
  ]);
  const conDatos = new Set(datos.flatMap((fila) => fila.cells.map((celda) => celda.column)));
  for (const columna of [...conDatos, ...encabezados.noTexto].sort((a, b) => a - b)) {
    if (!conEncabezado.has(columna)) {
      conEncabezado.add(columna);
      hallazgos.push(
        crearHallazgo('COLUMNA_DESCONOCIDA', 'INFORMACION', 'GLOBAL', [hoja.ref(1, columna)], {
          motivo: 'SIN_ENCABEZADO_DE_TEXTO',
        }),
      );
    }
  }
  return encabezados.duplicados.size === 0;
}
