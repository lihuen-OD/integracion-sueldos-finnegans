// Escenarios sintéticos para los parsers y la conciliación de F2 (herramienta de test).
import type { CellValue, Workbook } from '../../../src/import/xlsx';
// Todos los CUIL y CBU se generan en tiempo de ejecución (D-042). Los XLSX se arman con
// xlsxBuilder, como si los hubiera exportado Finnegans o editado RRHH a mano, para poder
// reproducir celdas numéricas, fórmulas, encabezados alterados y hojas faltantes.
import { BANCO_NACION, BANCO_PATAGONIA, FINNEGANS_HEADERS } from './finnegansLike.ts';
import {
  createRandom,
  randomInt,
  syntheticCbu,
  syntheticCuenta,
  syntheticPeople,
} from './identities.ts';
import {
  buildXlsx,
  inlineStr,
  javaDoubleText,
  num,
  type CellSpec,
  type SheetSpec,
} from './xlsxBuilder.ts';

/** Valor de una celda: string → texto inline; null → celda ausente; CellSpec → tal cual. */
export type CeldaEscenario = string | null | CellSpec;

/** Texto de una celda de escenario; falla si la celda no es un string (para aserciones). */
export function textoDeCelda(celda: CeldaEscenario | undefined): string {
  if (typeof celda !== 'string') {
    throw new Error('se esperaba una celda de texto');
  }
  return celda;
}

const celdaTexto = (valor: CeldaEscenario): CellSpec | null =>
  valor === null || typeof valor !== 'string' ? valor : inlineStr(valor);

/** Los importes dados como string son decimales y se escriben como número, igual que POI. */
const celdaImporte = (valor: CeldaEscenario): CellSpec | null =>
  valor === null || typeof valor !== 'string' ? valor : num(javaDoubleText(valor));

export interface PersonaSintetica {
  readonly cuil: string;
  readonly apellido: string;
  readonly nombre: string;
  /** 3 dígitos; los menores a 100 conservan el cero inicial. */
  readonly legajo: string;
}

/** Personas únicas, sin espacios finales; legajos `050`, `051`, … */
export function personas(cantidad: number, semilla = 2026): PersonaSintetica[] {
  return syntheticPeople(cantidad, semilla).map((persona, indice) => ({
    cuil: persona.cuil,
    apellido: persona.apellido.trimEnd(),
    nombre: persona.nombre.trimEnd(),
    legajo: String(50 + indice).padStart(3, '0'),
  }));
}

export interface FilaFinnegans {
  readonly Cuil: CeldaEscenario;
  readonly Apellido: CeldaEscenario;
  readonly Nombre: CeldaEscenario;
  readonly Legajo: CeldaEscenario;
  readonly Banco: CeldaEscenario;
  readonly Remunerativo: CeldaEscenario;
  readonly 'No remunerativo': CeldaEscenario;
  readonly Descuento: CeldaEscenario;
  readonly Contribucion: CeldaEscenario;
  readonly Neto: CeldaEscenario;
  readonly Descripcion: CeldaEscenario;
  readonly Transaccionsubtipoid: CeldaEscenario;
  readonly Legajoapellidonombre: CeldaEscenario;
  readonly Centrodecosto: CeldaEscenario;
}

const COLUMNAS_IMPORTE = new Set([
  'Remunerativo',
  'No remunerativo',
  'Descuento',
  'Contribucion',
  'Neto',
  'Transaccionsubtipoid',
]);

/** Fila coherente (neto = rem + no rem − desc) para una persona; los campos pueden pisarse. */
export function filaFinnegans(
  persona: PersonaSintetica,
  cambios: Partial<FilaFinnegans> = {},
): FilaFinnegans {
  return {
    Cuil: persona.cuil,
    Apellido: persona.apellido,
    Nombre: persona.nombre,
    Legajo: persona.legajo,
    Banco: BANCO_NACION,
    Remunerativo: '500000.5',
    'No remunerativo': '20000',
    Descuento: '100000.25',
    Contribucion: '90000',
    Neto: '420000.25',
    Descripcion: 'JULIO Agrario',
    Transaccionsubtipoid: '281',
    Legajoapellidonombre: `${persona.legajo} - ${persona.apellido}, ${persona.nombre}`,
    Centrodecosto: 'Centro de prueba 1',
    ...cambios,
  };
}

export interface OpcionesLibro {
  readonly hoja?: string;
  /** Visibilidad de la hoja de la liquidación (por defecto visible). */
  readonly estadoHoja?: 'visible' | 'hidden';
  /** Encabezados de la fila 1; por defecto los 14 de Finnegans. */
  readonly encabezados?: readonly CeldaEscenario[];
  /** Columnas extra al final: encabezado y valor por fila. */
  readonly columnasExtra?: readonly { encabezado: CeldaEscenario; valor: CeldaEscenario }[];
  readonly hojasExtra?: readonly SheetSpec[];
  /** Filas vacías intercaladas: índices (0-based) de filas de datos tras las cuales hay un hueco. */
  readonly huecosDespuesDe?: readonly number[];
}

function filasConHuecos(
  filas: (CellSpec | null)[][],
  huecos: readonly number[] = [],
): (CellSpec | null)[][] {
  return filas.flatMap((fila, indice) => (huecos.includes(indice) ? [fila, []] : [fila]));
}

/** Liquidación con la estructura de Finnegans (hoja1, inlineStr, dimensión A1 incorrecta). */
/** Hojas de una liquidación con la estructura de Finnegans. */
export function hojasFinnegans(
  filas: readonly FilaFinnegans[],
  opciones: OpcionesLibro = {},
): SheetSpec[] {
  const extra = opciones.columnasExtra ?? [];
  const encabezados = [
    ...(opciones.encabezados ?? FINNEGANS_HEADERS),
    ...extra.map((columna) => columna.encabezado),
  ].map(celdaTexto);
  const datos = filas.map((fila) => [
    ...FINNEGANS_HEADERS.map((columna) =>
      COLUMNAS_IMPORTE.has(columna) ? celdaImporte(fila[columna]) : celdaTexto(fila[columna]),
    ),
    ...extra.map((columna) => celdaTexto(columna.valor)),
  ]);
  return [
    {
      name: opciones.hoja ?? 'hoja1',
      state: opciones.estadoHoja ?? 'visible',
      rows: [encabezados, ...filasConHuecos(datos, opciones.huecosDespuesDe)],
      dimension: 'A1',
    },
    ...(opciones.hojasExtra ?? []),
  ];
}

/** Liquidación con la estructura de Finnegans (hoja1, inlineStr, dimensión A1 incorrecta). */
export function finnegansXlsx(
  filas: readonly FilaFinnegans[],
  opciones: OpcionesLibro = {},
): Uint8Array {
  return buildXlsx(hojasFinnegans(filas, opciones));
}

/** La misma liquidación como la entrega el adaptador XLSX, sin pasar por ExcelJS (tests rápidos). */
export function finnegansLibro(
  filas: readonly FilaFinnegans[],
  opciones: OpcionesLibro = {},
): Workbook {
  return libroDesdeHojas(hojasFinnegans(filas, opciones));
}

/** Columnas del maestro v1 (docs/03 §B.1), escritas aquí a propósito y no importadas de src. */
export const COLUMNAS_MAESTRO_V1 = [
  'CUIL',
  'LEGAJO',
  'APELLIDO_NOMBRE_REF',
  'CBU',
  'PAT_TIPO_CUENTA',
  'PAT_NUMERO_CUENTA',
  'PAT_CODIGO_BANCO',
  'PAT_CODIGO_SUCURSAL',
  'PAT_TIPO_DOCUMENTO',
  'PAT_NUMERO_DOCUMENTO',
  'PAT_PROVINCIA_DOCUMENTO',
  'PAT_CODIGO_DEPENDENCIA',
] as const;

export type RegistroMaestro = Readonly<
  Record<(typeof COLUMNAS_MAESTRO_V1)[number], CeldaEscenario>
>;

const SIN_DATOS_BANCARIOS = {
  CBU: null,
  PAT_TIPO_CUENTA: null,
  PAT_NUMERO_CUENTA: null,
  PAT_CODIGO_BANCO: null,
  PAT_CODIGO_SUCURSAL: null,
  PAT_TIPO_DOCUMENTO: null,
  PAT_NUMERO_DOCUMENTO: null,
  PAT_PROVINCIA_DOCUMENTO: null,
  PAT_CODIGO_DEPENDENCIA: null,
} as const;

function digitosAleatorios(random: () => number, cantidad: number): string {
  let digitos = '';
  while (digitos.length < cantidad) {
    digitos += String(randomInt(random, 0, 9));
  }
  return digitos;
}

/** Registro con CBU sintético de la entidad 011 (Nación). */
export function registroBna(
  persona: PersonaSintetica,
  random: () => number,
  cambios: Partial<RegistroMaestro> = {},
): RegistroMaestro {
  return {
    CUIL: persona.cuil,
    LEGAJO: persona.legajo,
    APELLIDO_NOMBRE_REF: `${persona.apellido}, ${persona.nombre}`,
    ...SIN_DATOS_BANCARIOS,
    CBU: syntheticCbu('011', digitosAleatorios(random, 4), syntheticCuenta(random)),
    ...cambios,
  };
}

/** Registro con cuenta Patagonia confirmada sintética (banco 034) y documento independiente. */
export function registroPatagonia(
  persona: PersonaSintetica,
  random: () => number,
  cambios: Partial<RegistroMaestro> = {},
): RegistroMaestro {
  return {
    CUIL: persona.cuil,
    LEGAJO: persona.legajo,
    APELLIDO_NOMBRE_REF: `${persona.apellido}, ${persona.nombre}`,
    ...SIN_DATOS_BANCARIOS,
    PAT_TIPO_CUENTA: '2',
    PAT_NUMERO_CUENTA: digitosAleatorios(random, 10),
    PAT_CODIGO_BANCO: '034',
    PAT_CODIGO_SUCURSAL: digitosAleatorios(random, 5),
    PAT_TIPO_DOCUMENTO: '001',
    // El documento no se deriva del CUIL (docs/03 §B.1): se genera aparte.
    PAT_NUMERO_DOCUMENTO: digitosAleatorios(random, 8),
    PAT_PROVINCIA_DOCUMENTO: null,
    PAT_CODIGO_DEPENDENCIA: '100',
    ...cambios,
  };
}

export interface OpcionesMaestro {
  readonly hojaEmpleados?: string;
  readonly encabezados?: readonly CeldaEscenario[];
  readonly columnasExtra?: readonly { encabezado: CeldaEscenario; valor: CeldaEscenario }[];
  /** Filas de la hoja Control (incluido el encabezado); `null` = sin hoja Control. */
  readonly control?: readonly (readonly CeldaEscenario[])[] | null;
  readonly hojasExtra?: readonly SheetSpec[];
  readonly huecosDespuesDe?: readonly number[];
}

export const CONTROL_V1: readonly (readonly CeldaEscenario[])[] = [
  ['CLAVE', 'VALOR'],
  ['VERSION_CONTRATO', '1'],
];

/** Maestro como lo dejaría RRHH tras editarlo en Excel (todas las celdas como texto). */
/** Hojas de un maestro como lo dejaría RRHH tras editarlo en Excel. */
export function hojasMaestro(
  registros: readonly RegistroMaestro[],
  opciones: OpcionesMaestro = {},
): SheetSpec[] {
  const extra = opciones.columnasExtra ?? [];
  const encabezados = [
    ...(opciones.encabezados ?? COLUMNAS_MAESTRO_V1),
    ...extra.map((columna) => columna.encabezado),
  ].map(celdaTexto);
  const datos = registros.map((registro) => [
    ...COLUMNAS_MAESTRO_V1.map((columna) => celdaTexto(registro[columna])),
    ...extra.map((columna) => celdaTexto(columna.valor)),
  ]);
  const control = opciones.control === undefined ? CONTROL_V1 : opciones.control;
  return [
    {
      name: opciones.hojaEmpleados ?? 'Empleados',
      rows: [encabezados, ...filasConHuecos(datos, opciones.huecosDespuesDe)],
    },
    ...(control === null
      ? []
      : [
          {
            name: 'Control',
            state: 'hidden' as const,
            rows: control.map((fila) => fila.map(celdaTexto)),
          },
        ]),
    ...(opciones.hojasExtra ?? []),
  ];
}

/** Maestro como lo dejaría RRHH tras editarlo en Excel (todas las celdas como texto). */
export function maestroXlsx(
  registros: readonly RegistroMaestro[],
  opciones: OpcionesMaestro = {},
): Uint8Array {
  return buildXlsx(hojasMaestro(registros, opciones));
}

/** El mismo maestro como lo entrega el adaptador XLSX, sin pasar por ExcelJS. */
export function maestroLibro(
  registros: readonly RegistroMaestro[],
  opciones: OpcionesMaestro = {},
): Workbook {
  return libroDesdeHojas(hojasMaestro(registros, opciones));
}

function valorDeCelda(celda: CellSpec | null): CellValue | null {
  if (celda === null) {
    return null;
  }
  switch (celda.kind) {
    case 'inlineStr':
    case 'sharedStr':
      // Como el adaptador: un texto vacío es una celda ausente (hallazgo 1 del spike F1).
      return celda.text === '' ? null : { kind: 'text', text: celda.text };
    case 'number': {
      const numero = Number(celda.xml);
      return Number.isFinite(numero)
        ? { kind: 'number', text: String(numero) }
        : { kind: 'unsupported' };
    }
    case 'formula':
      return { kind: 'formula' };
  }
}

/**
 * Convierte hojas sintéticas al contrato del adaptador con su misma semántica (texto vacío =
 * celda ausente, números como `String(n)`, fórmulas sin evaluar, filas vacías omitidas). Un
 * test verifica que da el mismo resultado que leer el XLSX con ExcelJS.
 */
export function libroDesdeHojas(hojas: readonly SheetSpec[]): Workbook {
  return {
    sheets: hojas.map((hoja) => ({
      name: hoja.name,
      state: hoja.state ?? 'visible',
      rows: hoja.rows.flatMap((fila, indice) => {
        const cells = fila.flatMap((celda, columna) => {
          const value = valorDeCelda(celda);
          return value === null ? [] : [{ column: columna + 1, value }];
        });
        return cells.length === 0 ? [] : [{ rowNumber: indice + 1, cells }];
      }),
    })),
  };
}

export interface EspejoMuestra {
  readonly personas: readonly PersonaSintetica[];
  readonly filas: readonly FilaFinnegans[];
  readonly registros: readonly RegistroMaestro[];
}

/**
 * Escenario sintético que reproduce SOLO los agregados documentados de la muestra real
 * (docs/03 §A.2): 156 filas; Nación 116, Patagonia 39, banco vacío 1; un neto cero; 50
 * legajos con cero inicial; 9 apellidos y 12 nombres con espacio final; Agrario 121,
 * Comercio 27, Directivos 4 y Liq. Final 4 en dos variantes. Netos enteros y coherentes.
 * Incluye un maestro completo para todas las personas.
 */
export function espejoMuestra(semilla = 20261020): EspejoMuestra {
  const random = createRandom(semilla);
  const base = personas(156, semilla);
  const LIQ_FINAL: Readonly<Record<number, string>> = {
    17: 'JULIO Liq final ',
    120: 'JULIO Liq final ',
    121: 'JULIO Liq Final',
    122: 'JULIO Liq Final',
  };
  const DIRECTIVOS = new Set([10, 50, 90, 130]);
  let comercio = 0;
  const filas = base.map((persona, indice) => {
    const banco = indice === 17 ? '' : indice % 4 === 3 ? BANCO_PATAGONIA : BANCO_NACION;
    let descripcion = LIQ_FINAL[indice] ?? (DIRECTIVOS.has(indice) ? 'JULIO Directivos' : null);
    if (descripcion === null && indice % 5 === 2 && comercio < 27) {
      comercio += 1;
      descripcion = 'JULIO Comercio ';
    }
    const cero = indice === 43;
    const remunerativo = cero ? 0 : randomInt(random, 300_000, 1_500_000);
    const noRemunerativo = cero ? 0 : randomInt(random, 0, 80_000);
    const descuento = cero ? 0 : randomInt(random, 50_000, 250_000);
    const apellido = indice % 17 === 5 ? `${persona.apellido} ` : persona.apellido;
    const nombre = indice % 13 === 7 ? `${persona.nombre} ` : persona.nombre;
    return filaFinnegans(
      { ...persona, apellido, nombre },
      {
        Banco: banco,
        Remunerativo: String(remunerativo),
        'No remunerativo': String(noRemunerativo),
        Descuento: String(descuento),
        Contribucion: String(randomInt(random, 50_000, 300_000)),
        Neto: String(remunerativo + noRemunerativo - descuento),
        Descripcion: descripcion ?? 'JULIO Agrario',
        Centrodecosto: `Centro de prueba ${String((indice % 30) + 1)}`,
      },
    );
  });
  const registros = base.map((persona, indice) =>
    indice % 4 === 3 ? registroPatagonia(persona, random) : registroBna(persona, random),
  );
  return { personas: base, filas, registros };
}

/**
 * Escenario masivo sintético para integración y rendimiento: ~75 % Nación, ~25 % Patagonia,
 * algunos bancos vacíos y netos cero, netos con centavos coherentes con sus componentes y
 * maestro completo. Determinista por semilla.
 */
export function escenarioMasivo(cantidad: number, semilla = 300): EspejoMuestra {
  const random = createRandom(semilla);
  const base = personas(cantidad, semilla);
  const filas = base.map((persona, indice) => {
    const banco = indice % 97 === 13 ? '' : indice % 4 === 3 ? BANCO_PATAGONIA : BANCO_NACION;
    const cero = indice % 89 === 7;
    const remunerativo = cero ? 0 : randomInt(random, 300_000, 1_500_000);
    const noRemunerativo = cero ? 0 : randomInt(random, 0, 80_000);
    const descuento = cero ? 0 : randomInt(random, 50_000, 250_000);
    const decimales = cero ? '' : `.${String(randomInt(random, 0, 99)).padStart(2, '0')}`;
    return filaFinnegans(persona, {
      Banco: banco,
      Remunerativo: `${String(remunerativo)}${decimales}`,
      'No remunerativo': String(noRemunerativo),
      Descuento: String(descuento),
      Neto: `${String(remunerativo + noRemunerativo - descuento)}${decimales}`,
      Descripcion: indice % 7 === 0 ? 'JULIO Comercio ' : 'JULIO Agrario',
    });
  });
  const registros = base.map((persona, indice) =>
    indice % 4 === 3 ? registroPatagonia(persona, random) : registroBna(persona, random),
  );
  return { personas: base, filas, registros };
}
