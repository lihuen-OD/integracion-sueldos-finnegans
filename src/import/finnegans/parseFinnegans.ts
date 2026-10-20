// Parser de la liquidación Finnegans (docs/03 §A): contrato del adaptador XLSX → PayrollLine +
// hallazgos localizados por hoja/fila/columna. No decide destinos, exclusiones ni cruces: eso es
// la conciliación. Solo detecta lo que se ve dentro del archivo (estructura, tipos de celda,
// CUIL, importes y CUIL repetidos). Ningún detalle incluye valores de celdas.
import { parseCuil } from '../../domain/cuil';
import {
  DESCRIPCION_CODIGO,
  type CodigoIncidencia,
  type Hallazgo,
  type NivelIncidencia,
  type ObjetivoHallazgo,
  type SourceRef,
} from '../../domain/incidencias';
import {
  descripcionSinClasificar,
  type LecturaFinnegans,
  type PayrollLine,
} from '../../domain/liquidacion';
import type { ValorLeido } from '../../domain/maestro';
import { parseImporte, type Centavos } from '../../domain/money';
import {
  analizarEncabezados,
  celdaEn,
  columnasCompletas,
  filasVaciasIntermedias,
  leerValor,
  letraColumna,
  type Encabezados,
} from '../comun';
import type { Row, Sheet, Workbook } from '../xlsx';

/** Los 14 encabezados de Finnegans (docs/03 §A.2), en su forma original. */
export const ENCABEZADOS_FINNEGANS = [
  'Cuil',
  'Apellido',
  'Nombre',
  'Legajo',
  'Banco',
  'Remunerativo',
  'No remunerativo',
  'Descuento',
  'Contribucion',
  'Neto',
  'Descripcion',
  'Transaccionsubtipoid',
  'Legajoapellidonombre',
  'Centrodecosto',
] as const;
type ColumnaFinnegans = (typeof ENCABEZADOS_FINNEGANS)[number];

/** Columnas que el sistema no usa: una fórmula en ellas es INFORMACION (docs/03 §A.3). */
const NO_USADAS: readonly ColumnaFinnegans[] = [
  'Contribucion',
  'Transaccionsubtipoid',
  'Centrodecosto',
];

interface Hoja {
  readonly nombre: string;
  readonly ref: (fila?: number, columna?: number) => SourceRef;
}

function crearHoja(nombre: string): Hoja {
  return {
    nombre,
    ref: (fila, columna) => ({
      archivo: 'FINNEGANS',
      hoja: nombre,
      ...(fila === undefined ? {} : { fila }),
      ...(columna === undefined ? {} : { columna: letraColumna(columna) }),
    }),
  };
}

function hallazgo(
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

interface HojaEncontrada {
  readonly hoja: Sheet;
  readonly encabezados: Encabezados;
  readonly columnas: Readonly<Record<ColumnaFinnegans, number>>;
}

/** Busca la única hoja con los 14 encabezados en la fila 1. */
function buscarHoja(libro: Workbook, hallazgos: Hallazgo[]): HojaEncontrada | null {
  const analizadas = libro.sheets.map((hoja) => {
    const encabezados = analizarEncabezados(hoja, ENCABEZADOS_FINNEGANS);
    return { hoja, encabezados, columnas: columnasCompletas(encabezados, ENCABEZADOS_FINNEGANS) };
  });
  const candidatas = analizadas.flatMap(({ hoja, encabezados, columnas }) =>
    columnas === null ? [] : [{ hoja, encabezados, columnas }],
  );
  const [unica, ...otras] = candidatas;
  if (unica !== undefined && otras.length === 0) {
    return unica;
  }
  if (unica !== undefined) {
    hallazgos.push(
      hallazgo(
        'ESTRUCTURA_INVALIDA',
        'BLOQUEANTE',
        'GLOBAL',
        candidatas.map((item) => crearHoja(item.hoja.name).ref()),
        {
          motivo: 'VARIAS_HOJAS_CANDIDATAS',
          detalle: 'Hay más de una hoja con los encabezados de Finnegans: no se elige ninguna.',
        },
      ),
    );
    return null;
  }
  // Se informan los encabezados que faltan en la hoja más parecida.
  const faltantes = analizadas.reduce<readonly string[]>(
    (menos, item) =>
      item.encabezados.faltantes.length < menos.length ? item.encabezados.faltantes : menos,
    ENCABEZADOS_FINNEGANS,
  );
  hallazgos.push(
    hallazgo('ESTRUCTURA_INVALIDA', 'BLOQUEANTE', 'GLOBAL', [{ archivo: 'FINNEGANS' }], {
      motivo: 'HOJA_NO_ENCONTRADA',
      detalle: `Ninguna hoja tiene en la fila 1 los 14 encabezados de Finnegans. Faltan: ${faltantes.join(', ')}.`,
    }),
  );
  return null;
}

/** Hallazgos de la fila 1 y de columnas sin encabezado. Devuelve false si la hoja es ambigua. */
function revisarEncabezados(
  hoja: Hoja,
  datos: readonly Row[],
  encabezados: Encabezados,
  hallazgos: Hallazgo[],
): boolean {
  for (const [nombre, columnas] of encabezados.duplicados) {
    hallazgos.push(
      hallazgo(
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
    hallazgos.push(hallazgo('FORMULA_EN_CELDA', 'BLOQUEANTE', 'GLOBAL', [hoja.ref(1, columna)]));
  }
  for (const { columna, texto } of encabezados.desconocidas) {
    hallazgos.push(
      hallazgo('COLUMNA_DESCONOCIDA', 'INFORMACION', 'GLOBAL', [hoja.ref(1, columna)], {
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
  const sinEncabezado = new Set(datos.flatMap((fila) => fila.cells.map((celda) => celda.column)));
  for (const columna of [...sinEncabezado, ...encabezados.noTexto].sort((a, b) => a - b)) {
    if (!conEncabezado.has(columna)) {
      conEncabezado.add(columna);
      hallazgos.push(
        hallazgo('COLUMNA_DESCONOCIDA', 'INFORMACION', 'GLOBAL', [hoja.ref(1, columna)], {
          motivo: 'SIN_ENCABEZADO_DE_TEXTO',
        }),
      );
    }
  }
  return encabezados.duplicados.size === 0;
}

class LectorFila {
  private readonly hallazgos: Hallazgo[];
  private readonly fila: Row;
  private readonly hoja: Hoja;
  private readonly columnas: Readonly<Record<ColumnaFinnegans, number>>;

  constructor(
    hoja: Hoja,
    fila: Row,
    columnas: Readonly<Record<ColumnaFinnegans, number>>,
    hallazgos: Hallazgo[],
  ) {
    this.hoja = hoja;
    this.fila = fila;
    this.columnas = columnas;
    this.hallazgos = hallazgos;
  }

  private columna(nombre: ColumnaFinnegans): number {
    return this.columnas[nombre];
  }

  ref(nombre?: ColumnaFinnegans): SourceRef {
    return this.hoja.ref(
      this.fila.rowNumber,
      nombre === undefined ? undefined : this.columna(nombre),
    );
  }

  valor(nombre: ColumnaFinnegans): ValorLeido {
    return leerValor(celdaEn(this.fila, this.columna(nombre)));
  }

  agregar(
    codigo: CodigoIncidencia,
    nivel: NivelIncidencia,
    objetivo: ObjetivoHallazgo,
    nombre: ColumnaFinnegans,
    extra: { motivo?: string; valores?: Hallazgo['valores'] } = {},
  ): void {
    this.hallazgos.push(
      hallazgo(codigo, nivel, objetivo, [this.ref(nombre)], { campo: nombre, ...extra }),
    );
  }

  /**
   * Texto de una columna. Fórmula → BLOQUEANTE global (docs/03 §A.3); número u otro tipo →
   * `TIPO_CELDA_INVALIDO` con el nivel indicado. Devuelve null si la celda no es texto.
   */
  texto(nombre: ColumnaFinnegans, nivelTipoInvalido: NivelIncidencia): string | null {
    const valor = this.valor(nombre);
    if (valor.tipo === 'TEXTO') {
      return valor.texto;
    }
    if (valor.tipo === 'FORMULA') {
      this.agregar('FORMULA_EN_CELDA', 'BLOQUEANTE', 'GLOBAL', nombre);
    } else {
      this.agregar('TIPO_CELDA_INVALIDO', nivelTipoInvalido, 'FILA', nombre, {
        motivo: valor.tipo,
      });
    }
    return null;
  }

  /** Identificador (Cuil, Legajo): en celda numérica → CELDA_NUMERICA_EN_TEXTO (D-050). */
  identificador(nombre: 'Cuil' | 'Legajo'): { texto: string; legible: boolean } {
    const valor = this.valor(nombre);
    if (valor.tipo === 'NUMERO') {
      this.agregar('CELDA_NUMERICA_EN_TEXTO', 'BLOQUEANTE', 'FILA', nombre, {
        valores: { finnegans: valor.texto },
      });
      return { texto: valor.texto, legible: false };
    }
    const texto = this.texto(nombre, 'BLOQUEANTE');
    return texto === null ? { texto: '', legible: false } : { texto, legible: true };
  }

  /**
   * Importe: solo desde celda numérica (D-050). Neto no interpretable → alcance global, porque
   * el total Finnegans no puede calcularse (§E.2 regla 5); componentes → la fila.
   */
  importe(nombre: 'Remunerativo' | 'No remunerativo' | 'Descuento' | 'Neto'): Centavos | null {
    const valor = this.valor(nombre);
    const objetivo: ObjetivoHallazgo = nombre === 'Neto' ? 'GLOBAL' : 'FILA';
    const invalido = (motivo: string, valores?: Hallazgo['valores']) => {
      this.agregar('IMPORTE_INVALIDO', 'BLOQUEANTE', objetivo, nombre, {
        motivo,
        ...(valores === undefined ? {} : { valores }),
      });
      return null;
    };
    switch (valor.tipo) {
      case 'NUMERO': {
        const resultado = parseImporte(valor.texto);
        return resultado.ok
          ? resultado.value
          : invalido(resultado.error, { finnegans: valor.texto });
      }
      case 'TEXTO':
        return valor.texto === ''
          ? invalido('VACIO')
          : invalido('CELDA_DE_TEXTO', { finnegans: valor.texto });
      case 'FORMULA':
        this.agregar('FORMULA_EN_CELDA', 'BLOQUEANTE', 'GLOBAL', nombre);
        return null;
      case 'OTRO':
        return invalido('TIPO_DE_CELDA');
    }
  }

  /** En columnas no usadas solo se informa una fórmula. */
  noUsada(nombre: ColumnaFinnegans): void {
    if (this.valor(nombre).tipo === 'FORMULA') {
      this.agregar('FORMULA_EN_CELDA', 'INFORMACION', 'GLOBAL', nombre);
    }
  }
}

function leerFila(
  hoja: Hoja,
  fila: Row,
  columnas: Readonly<Record<ColumnaFinnegans, number>>,
  hallazgos: Hallazgo[],
): PayrollLine {
  const lector = new LectorFila(hoja, fila, columnas, hallazgos);

  const cuilLeido = lector.identificador('Cuil');
  let cuil: PayrollLine['cuil'] = null;
  if (cuilLeido.legible) {
    const resultado = parseCuil(cuilLeido.texto);
    if (resultado.ok) {
      cuil = resultado.value;
    } else {
      lector.agregar('CUIL_INVALIDO', 'BLOQUEANTE', 'FILA', 'Cuil', {
        motivo: resultado.error,
        valores: { finnegans: cuilLeido.texto },
      });
    }
  }
  const legajo = lector.identificador('Legajo');

  const linea: PayrollLine = {
    ref: lector.ref(),
    cuilTexto: cuilLeido.texto,
    cuil,
    legajo: legajo.legible ? legajo.texto : null,
    // Solo informativos en F2 (nombre Patagonia en F6): un tipo inválido no bloquea.
    apellido: lector.texto('Apellido', 'INFORMACION') ?? '',
    nombre: lector.texto('Nombre', 'INFORMACION') ?? '',
    bancoFinnegans: lector.texto('Banco', 'BLOQUEANTE'),
    neto: lector.importe('Neto'),
    componentes: {
      remunerativo: lector.importe('Remunerativo'),
      noRemunerativo: lector.importe('No remunerativo'),
      descuento: lector.importe('Descuento'),
    },
    descripcion: descripcionSinClasificar(lector.texto('Descripcion', 'BLOQUEANTE') ?? ''),
    legajoApellidoNombre: lector.texto('Legajoapellidonombre', 'INFORMACION') ?? '',
  };
  for (const nombre of NO_USADAS) {
    lector.noUsada(nombre);
  }
  return linea;
}

/** CUIL repetido (regla 2): todas las filas involucradas, sin sumar ni fusionar nada. */
function marcarCuilRepetidos(lineas: readonly PayrollLine[], hallazgos: Hallazgo[]): void {
  const porCuil = new Map<string, PayrollLine[]>();
  for (const linea of lineas) {
    if (linea.cuil !== null) {
      porCuil.set(linea.cuil, [...(porCuil.get(linea.cuil) ?? []), linea]);
    }
  }
  for (const grupo of porCuil.values()) {
    if (grupo.length < 2) {
      continue;
    }
    for (const linea of grupo) {
      hallazgos.push(
        hallazgo(
          'CUIL_REPETIDO_FINNEGANS',
          'BLOQUEANTE',
          'FILA',
          [linea.ref, ...grupo.filter((otra) => otra !== linea).map((otra) => otra.ref)],
          { campo: 'Cuil', valores: { finnegans: linea.cuilTexto } },
        ),
      );
    }
  }
}

/** Lee la liquidación. Nunca modifica el libro ni descarta filas con datos. */
export function parseFinnegans(libro: Workbook): LecturaFinnegans {
  const hallazgos: Hallazgo[] = [];
  const encontrada = buscarHoja(libro, hallazgos);
  if (encontrada === null) {
    return { hoja: null, lineas: [], hallazgos };
  }
  const hoja = crearHoja(encontrada.hoja.name);
  const datos = encontrada.hoja.rows.filter((fila) => fila.rowNumber > 1);
  if (!revisarEncabezados(hoja, datos, encontrada.encabezados, hallazgos)) {
    return { hoja: hoja.nombre, lineas: [], hallazgos };
  }
  if (datos.length === 0) {
    hallazgos.push(
      hallazgo('ESTRUCTURA_INVALIDA', 'BLOQUEANTE', 'GLOBAL', [hoja.ref()], {
        motivo: 'SIN_FILAS_DE_DATOS',
        detalle: 'La hoja de Finnegans no tiene filas de datos.',
      }),
    );
    return { hoja: hoja.nombre, lineas: [], hallazgos };
  }
  const vacias = filasVaciasIntermedias(datos);
  if (vacias > 0) {
    hallazgos.push(
      hallazgo('FILAS_VACIAS_IGNORADAS', 'INFORMACION', 'GLOBAL', [hoja.ref()], {
        detalle: `${String(vacias)} fila(s) totalmente vacía(s) ignorada(s).`,
      }),
    );
  }
  const lineas = datos.map((fila) => leerFila(hoja, fila, encontrada.columnas, hallazgos));
  marcarCuilRepetidos(lineas, hallazgos);
  return { hoja: hoja.nombre, lineas, hallazgos };
}
