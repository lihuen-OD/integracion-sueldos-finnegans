// Plantilla de MAESTRO_CUENTAS_EMPLEADOS.xlsx (docs/03 §B.2 y §B.4): vacía o prellenada con
// CUIL, LEGAJO y APELLIDO_NOMBRE_REF desde Finnegans. Todas las celdas en formato Texto, sin
// fórmulas (el adaptador escribe todo valor como texto). La prellenada contiene datos personales:
// se genera en memoria y se descarga localmente; nunca se versiona ni se persiste.
// Las instrucciones describen los formatos en palabras: sin ejemplos con forma de CUIL/CBU (D-042).
import { formatearCuil, type Cuil } from '../../domain/cuil';
import type { LecturaFinnegans } from '../../domain/liquidacion';
import {
  ANEXO_I_TIPOS_DOCUMENTO,
  ANEXO_II_PROVINCIAS,
  TIPOS_CUENTA_PATAGONIA,
  VERSION_CONTRATO_MAESTRO,
} from '../../domain/maestro';
import { writeWorkbook, type ColumnDefinition, type WorkbookDefinition } from '../xlsx';
import {
  CLAVE_VERSION_CONTRATO,
  COLUMNAS_MAESTRO,
  HOJA_CATALOGOS,
  HOJA_CONTROL,
  HOJA_EMPLEADOS,
  HOJA_INSTRUCCIONES,
  NOMBRE_ARCHIVO_MAESTRO,
  type ColumnaMaestro,
} from './contrato';

/** Filas con formato Texto y listas desplegables preparadas debajo del encabezado. */
export const FILAS_PREPARADAS = 1_000;

export interface FilaPrellenada {
  /** CUIL con guiones (D-051): el parser lo lleva al canónico por N-02. */
  readonly cuil: string;
  /** Legajo exacto de Finnegans. */
  readonly legajo: string;
  readonly apellidoNombreRef: string;
}

export interface ResumenPrellenado {
  readonly prellenadas: number;
  readonly omitidasCuilInvalido: number;
  readonly omitidasCuilRepetido: number;
  readonly omitidasLegajoIlegible: number;
}

const ANCHOS: Readonly<Record<ColumnaMaestro, number>> = {
  CUIL: 16,
  LEGAJO: 10,
  APELLIDO_NOMBRE_REF: 34,
  CBU: 26,
  PAT_TIPO_CUENTA: 17,
  PAT_NUMERO_CUENTA: 19,
  PAT_CODIGO_BANCO: 18,
  PAT_CODIGO_SUCURSAL: 21,
  PAT_TIPO_DOCUMENTO: 20,
  PAT_NUMERO_DOCUMENTO: 23,
  PAT_PROVINCIA_DOCUMENTO: 25,
  PAT_CODIGO_DEPENDENCIA: 25,
};

const LISTAS: Partial<Record<ColumnaMaestro, readonly string[]>> = {
  PAT_TIPO_CUENTA: TIPOS_CUENTA_PATAGONIA.map((entrada) => entrada.codigo),
  PAT_TIPO_DOCUMENTO: ANEXO_I_TIPOS_DOCUMENTO.map((entrada) => entrada.codigo),
  PAT_PROVINCIA_DOCUMENTO: ANEXO_II_PROVINCIAS.map((entrada) => entrada.codigo),
};

const INSTRUCCIONES: readonly string[] = [
  'Maestro de cuentas bancarias de empleados. Contrato versión 1 (docs/03 §B).',
  'Contiene datos personales y bancarios: acceso restringido a RRHH, copia de respaldo protegida y control de versiones.',
  'Una fila por empleado (CUIL). Todas las celdas tienen formato Texto: no cambiar el formato ni escribir fórmulas.',
  'La aplicación nunca modifica este archivo: las correcciones se hacen aquí y se vuelve a cargar.',
  'CUIL: obligatorio. 11 dígitos; se aceptan guiones entre los bloques. Es la clave de cruce con Finnegans.',
  'LEGAJO: obligatorio. Se compara exactamente con Finnegans (007 no es igual a 7). No agregar ni quitar ceros ni espacios.',
  'APELLIDO_NOMBRE_REF: opcional. Solo referencia de lectura; nunca se usa para cruzar ni validar.',
  'CBU: obligatorio para cobrar por Banco Nación. 22 dígitos seguidos, sin espacios ni guiones. En empleados de Banco Patagonia, si se informa, se usa solo como control de compatibilidad.',
  'PAT_TIPO_CUENTA: 1 cuenta corriente o 2 caja de ahorros (lista desplegable).',
  'PAT_NUMERO_CUENTA: hasta 10 dígitos, tal como lo informó Banco Patagonia en el alta de la cuenta.',
  'PAT_CODIGO_BANCO: 3 dígitos, según el alta de la cuenta.',
  'PAT_CODIGO_SUCURSAL: hasta 5 dígitos, según el alta de la cuenta.',
  'PAT_TIPO_DOCUMENTO: código del Anexo I (lista desplegable; ver hoja Catalogos).',
  'PAT_NUMERO_DOCUMENTO: hasta 17 dígitos, el informado en el alta de la cuenta. No se deriva del CUIL.',
  'PAT_PROVINCIA_DOCUMENTO: solo con tipo de documento 004, código del Anexo II. Vacía en los demás casos.',
  'PAT_CODIGO_DEPENDENCIA: hasta 15 caracteres, tal como figura en la tabla de dependencias. Su formato final está pendiente de confirmación con el banco.',
  'Las columnas PAT_* se completan solo para empleados que cobran por Banco Patagonia.',
  'No se copian a este archivo importes, bancos de Finnegans, descripciones ni otros datos mensuales.',
];

function validarFecha(fechaGeneracion: string): void {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fechaGeneracion)) {
    throw new RangeError('La fecha de generación debe tener el formato AAAA-MM-DD.');
  }
}

/** Nombre del archivo a descargar: con fecha si es una versión prellenada (docs/03 §B.4). */
export function nombreArchivoMaestro(fechaGeneracion?: string): string {
  if (fechaGeneracion === undefined) {
    return NOMBRE_ARCHIVO_MAESTRO;
  }
  validarFecha(fechaGeneracion);
  return NOMBRE_ARCHIVO_MAESTRO.replace('.xlsx', `_${fechaGeneracion}.xlsx`);
}

/**
 * Filas prellenadas desde una lectura Finnegans válida (D-051). Se omiten, y se cuentan, las
 * filas con CUIL inválido o ilegible, las de un CUIL repetido (no se elige ninguna) y las de
 * legajo ilegible. No se copia ningún dato bancario ni mensual.
 */
export function prellenarDesdeFinnegans(lectura: LecturaFinnegans): {
  readonly filas: readonly FilaPrellenada[];
  readonly resumen: ResumenPrellenado;
} {
  const apariciones = new Map<Cuil, number>();
  for (const linea of lectura.lineas) {
    if (linea.cuil !== null) {
      apariciones.set(linea.cuil, (apariciones.get(linea.cuil) ?? 0) + 1);
    }
  }
  const filas: FilaPrellenada[] = [];
  let omitidasCuilInvalido = 0;
  let omitidasCuilRepetido = 0;
  let omitidasLegajoIlegible = 0;
  for (const linea of lectura.lineas) {
    if (linea.cuil === null) {
      omitidasCuilInvalido += 1;
    } else if (apariciones.get(linea.cuil) !== 1) {
      omitidasCuilRepetido += 1;
    } else if (linea.legajo === null) {
      omitidasLegajoIlegible += 1;
    } else {
      filas.push({
        cuil: formatearCuil(linea.cuil),
        legajo: linea.legajo,
        apellidoNombreRef:
          linea.apellido === '' && linea.nombre === '' ? '' : `${linea.apellido}, ${linea.nombre}`,
      });
    }
  }
  return {
    filas,
    resumen: {
      prellenadas: filas.length,
      omitidasCuilInvalido,
      omitidasCuilRepetido,
      omitidasLegajoIlegible,
    },
  };
}

/** Definición del libro (vacío si no hay filas). */
export function definicionPlantillaMaestro(opciones: {
  readonly fechaGeneracion: string;
  readonly filas?: readonly FilaPrellenada[];
}): WorkbookDefinition {
  validarFecha(opciones.fechaGeneracion);
  const filas = opciones.filas ?? [];
  const columnas: ColumnDefinition[] = COLUMNAS_MAESTRO.map((columna) => {
    const lista = LISTAS[columna];
    return {
      header: columna,
      width: ANCHOS[columna],
      format: 'text',
      ...(lista === undefined ? {} : { allowedValues: lista }),
    };
  });
  const catalogo = (
    nombre: string,
    entradas: readonly { codigo: string; descripcion: string; fuente: string }[],
  ) => entradas.map((entrada) => [nombre, entrada.codigo, entrada.descripcion, entrada.fuente]);
  return {
    sheets: [
      {
        name: HOJA_EMPLEADOS,
        freezeHeader: true,
        preparedRows: FILAS_PREPARADAS,
        columns: columnas,
        rows: filas.map((fila) => [
          fila.cuil,
          fila.legajo,
          fila.apellidoNombreRef === '' ? null : fila.apellidoNombreRef,
          ...COLUMNAS_MAESTRO.slice(3).map(() => null),
        ]),
      },
      {
        name: HOJA_INSTRUCCIONES,
        columns: [{ header: 'Instrucciones', format: 'text', width: 120 }],
        rows: INSTRUCCIONES.map((linea) => [linea]),
      },
      {
        name: HOJA_CATALOGOS,
        columns: [
          { header: 'CATALOGO', format: 'text', width: 16 },
          { header: 'CODIGO', format: 'text', width: 10 },
          { header: 'DESCRIPCION', format: 'text', width: 46 },
          { header: 'FUENTE', format: 'text', width: 30 },
        ],
        rows: [
          ...catalogo('TIPO_CUENTA', TIPOS_CUENTA_PATAGONIA),
          ...catalogo('TIPO_DOCUMENTO', ANEXO_I_TIPOS_DOCUMENTO),
          ...catalogo('PROVINCIA', ANEXO_II_PROVINCIAS),
        ],
      },
      {
        name: HOJA_CONTROL,
        state: 'hidden',
        columns: [
          { header: 'CLAVE', format: 'text', width: 22 },
          { header: 'VALOR', format: 'text', width: 24 },
        ],
        rows: [
          [CLAVE_VERSION_CONTRATO, VERSION_CONTRATO_MAESTRO],
          ['FECHA_GENERACION', opciones.fechaGeneracion],
          ['TIPO', filas.length === 0 ? 'VACIA' : 'PRELLENADA'],
          ['GENERADO_POR', 'Conversor de Haberes'],
        ],
      },
    ],
  };
}

/** Bytes del XLSX, generados en memoria con el adaptador. */
export async function generarPlantillaMaestro(opciones: {
  readonly fechaGeneracion: string;
  readonly filas?: readonly FilaPrellenada[];
}): Promise<Uint8Array> {
  return writeWorkbook(definicionPlantillaMaestro(opciones));
}
