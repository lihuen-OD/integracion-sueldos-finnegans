// Parser Finnegans con XLSX sintéticos leídos por el adaptador (D-042: sin literales con forma de
// CUIL/CBU; todos se generan en tiempo de ejecución).
import { describe, expect, it } from 'vitest';
import type { Hallazgo } from '../../../src/domain/incidencias';
import { sumarTodos, type Centavos } from '../../../src/domain/money';
import {
  ENCABEZADOS_FINNEGANS,
  parseFinnegans,
} from '../../../src/import/finnegans/parseFinnegans';
import { readWorkbook, type Workbook } from '../../../src/import/xlsx';
import {
  espejoMuestra,
  filaFinnegans,
  finnegansXlsx,
  personas,
  textoDeCelda,
  type FilaFinnegans,
  type OpcionesLibro,
} from '../../fixtures/synthetic/escenarios.ts';
import { buildFinnegansLike } from '../../fixtures/synthetic/finnegansLike.ts';
import { syntheticCuil } from '../../fixtures/synthetic/identities.ts';
import { formula, inlineStr, num, sharedStr } from '../../fixtures/synthetic/xlsxBuilder.ts';

async function libro(bytes: Uint8Array): Promise<Workbook> {
  const resultado = await readWorkbook(bytes);
  if (!resultado.ok) {
    throw new Error(resultado.error.kind);
  }
  return resultado.value;
}

async function parsear(filas: readonly FilaFinnegans[], opciones?: OpcionesLibro) {
  return parseFinnegans(await libro(finnegansXlsx(filas, opciones)));
}

const gente = personas(6);
const persona = (indice: number) => {
  const elegida = gente[indice];
  if (elegida === undefined) {
    throw new Error('persona sintética inexistente');
  }
  return elegida;
};
const canonico = (cuil: string) => cuil.replaceAll('-', '');
const txt = textoDeCelda;
const netos = (lineas: readonly { neto: Centavos | null }[]): Centavos[] =>
  lineas.flatMap((linea) => (linea.neto === null ? [] : [linea.neto]));
const codigos = (hallazgos: readonly Hallazgo[]) => hallazgos.map((h) => h.codigo);

describe('caso feliz: espejo sintético de la muestra', () => {
  it('lee 156 filas sin hallazgos y conserva cada dato exacto', async () => {
    const espejo = espejoMuestra();
    const lectura = await parsear(espejo.filas);
    expect(lectura.hoja).toBe('hoja1');
    expect(lectura.visibilidadHoja).toBe('visible');
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas).toHaveLength(156);
    lectura.lineas.forEach((linea, indice) => {
      const fila = espejo.filas[indice];
      expect(linea.ref).toEqual({ archivo: 'FINNEGANS', hoja: 'hoja1', fila: indice + 2 });
      expect(linea.cuilTexto).toBe(fila?.Cuil);
      expect(linea.cuil).toBe(canonico(txt(fila?.Cuil)));
      expect(linea.legajo).toBe(fila?.Legajo);
      expect(linea.apellido).toBe(fila?.Apellido);
      expect(linea.nombre).toBe(fila?.Nombre);
      expect(linea.bancoFinnegans).toBe(fila?.Banco);
      expect(linea.neto).toBe(BigInt(txt(fila?.Neto)) * 100n);
      expect(linea.descripcion).toEqual({
        descripcionOriginal: fila?.Descripcion,
        clasificacion: { estado: 'REGLA_PENDIENTE' },
      });
      expect(linea.legajoApellidoNombre).toBe(fila?.Legajoapellidonombre);
    });
  });

  it('el total en centavos coincide con la suma exacta de los netos', async () => {
    const espejo = espejoMuestra();
    const lectura = await parsear(espejo.filas);
    const esperado = espejo.filas.reduce((total, fila) => total + BigInt(txt(fila.Neto)), 0n);
    expect(netos(lectura.lineas)).toHaveLength(156);
    expect(sumarTodos(netos(lectura.lineas))).toBe(esperado * 100n);
  });

  it('lee el fixture tipo POI (dimensión A1, notación científica, centavos)', async () => {
    const fixture = buildFinnegansLike();
    const lectura = parseFinnegans(await libro(fixture.bytes));
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas).toHaveLength(fixture.rows.length);
    lectura.lineas.forEach((linea, indice) => {
      const [enteros = '0', decimales = '00'] = (fixture.rows[indice]?.neto ?? '').split('.');
      expect(linea.neto).toBe(BigInt(enteros) * 100n + BigInt(decimales));
    });
  });
});

describe('estructura (docs/03 §A.3)', () => {
  it('acepta encabezados con otras mayúsculas, acentos y espacios extremos (N-01)', async () => {
    const encabezados = ENCABEZADOS_FINNEGANS.map((nombre, indice) =>
      indice === 10 ? ' DESCRIPCIÓN ' : indice === 0 ? 'cuil' : nombre,
    );
    const lectura = await parsear([filaFinnegans(persona(0))], { encabezados });
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas).toHaveLength(1);
  });

  it('sin una hoja con los 14 encabezados: BLOQUEANTE global e indica los faltantes', async () => {
    const encabezados = ENCABEZADOS_FINNEGANS.map((nombre) =>
      nombre === 'Neto' ? 'Neto a cobrar' : nombre,
    );
    const lectura = await parsear([filaFinnegans(persona(0))], { encabezados });
    expect(lectura.hoja).toBeNull();
    expect(lectura.lineas).toEqual([]);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'ESTRUCTURA_INVALIDA',
        nivel: 'BLOQUEANTE',
        objetivo: 'GLOBAL',
        motivo: 'HOJA_NO_ENCONTRADA',
        detalle: expect.stringContaining('Faltan: Neto.') as unknown,
      }),
    ]);
  });

  it('informa los faltantes de la hoja más parecida', async () => {
    const sinNeto = ENCABEZADOS_FINNEGANS.filter((nombre) => nombre !== 'Neto');
    const lectura = await parsear([filaFinnegans(persona(0))], {
      encabezados: sinNeto.map((nombre) => (nombre === 'Banco' ? 'Entidad' : nombre)),
      hojasExtra: [{ name: 'Resumen', rows: [sinNeto.map((nombre) => inlineStr(nombre))] }],
    });
    expect(lectura.hallazgos[0]?.detalle).toContain('Faltan: Neto.');
  });

  it('los encabezados deben estar en la fila 1', () => {
    const lectura = parseFinnegans({
      sheets: [
        {
          name: 'hoja1',
          state: 'visible',
          rows: [
            {
              rowNumber: 2,
              cells: ENCABEZADOS_FINNEGANS.map((nombre, indice) => ({
                column: indice + 1,
                value: { kind: 'text' as const, text: nombre },
              })),
            },
          ],
        },
      ],
    });
    expect(lectura.hallazgos[0]).toMatchObject({ motivo: 'HOJA_NO_ENCONTRADA' });
  });

  it('hoja oculta con los 14 encabezados: se procesa y se informa (D-054)', async () => {
    const lectura = await parsear([filaFinnegans(persona(0))], { estadoHoja: 'hidden' });
    expect(lectura.visibilidadHoja).toBe('hidden');
    expect(lectura.lineas).toHaveLength(1);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'HOJA_FINNEGANS_OCULTA',
        nivel: 'INFORMACION',
        objetivo: 'GLOBAL',
        motivo: 'hidden',
      }),
    ]);
  });

  it('hoja muy oculta (veryHidden): también se procesa y se informa', async () => {
    const leido = await libro(finnegansXlsx([filaFinnegans(persona(0))]));
    const muyOculta = {
      sheets: leido.sheets.map((hoja) => ({ ...hoja, state: 'veryHidden' as const })),
    };
    const lectura = parseFinnegans(muyOculta);
    expect(lectura.visibilidadHoja).toBe('veryHidden');
    expect(lectura.lineas).toHaveLength(1);
    expect(lectura.hallazgos[0]).toMatchObject({
      codigo: 'HOJA_FINNEGANS_OCULTA',
      motivo: 'veryHidden',
    });
  });

  it('una hoja visible y una oculta con los 14 encabezados: sigue siendo ambiguo', async () => {
    const bytes = finnegansXlsx([filaFinnegans(persona(0))], {
      hojasExtra: [
        {
          name: 'copia',
          state: 'hidden',
          rows: [ENCABEZADOS_FINNEGANS.map((nombre) => inlineStr(nombre))],
        },
      ],
    });
    const lectura = parseFinnegans(await libro(bytes));
    expect(lectura.hoja).toBeNull();
    expect(lectura.visibilidadHoja).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'ESTRUCTURA_INVALIDA', motivo: 'VARIAS_HOJAS_CANDIDATAS' }),
    ]);
  });

  it('un libro sin hojas también se informa', () => {
    expect(parseFinnegans({ sheets: [] }).hallazgos[0]).toMatchObject({
      motivo: 'HOJA_NO_ENCONTRADA',
    });
  });

  it('encuentra la hoja aunque no sea la primera', async () => {
    const lectura = await parsear([filaFinnegans(persona(0))], {
      hoja: 'Liquidacion',
      hojasExtra: [{ name: 'Notas', rows: [[inlineStr('sin datos')]] }],
    });
    expect(lectura.hoja).toBe('Liquidacion');
  });

  it('dos hojas candidatas: BLOQUEANTE, no elige ninguna', async () => {
    const otra = parseFinnegans(await libro(finnegansXlsx([filaFinnegans(persona(0))])));
    expect(otra.hoja).toBe('hoja1');
    const bytes = finnegansXlsx([filaFinnegans(persona(0))], {
      hojasExtra: [
        { name: 'copia', rows: [ENCABEZADOS_FINNEGANS.map((nombre) => inlineStr(nombre))] },
      ],
    });
    const lectura = parseFinnegans(await libro(bytes));
    expect(lectura.hoja).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'ESTRUCTURA_INVALIDA', motivo: 'VARIAS_HOJAS_CANDIDATAS' }),
    ]);
    expect(lectura.hallazgos[0]?.refs.map((ref) => ref.hoja)).toEqual(['hoja1', 'copia']);
  });

  it('encabezado esperado repetido: BLOQUEANTE y no lee filas', async () => {
    const lectura = await parsear([filaFinnegans(persona(0))], {
      columnasExtra: [
        { encabezado: 'NETO', valor: num('1') },
        { encabezado: 'neto ', valor: num('2') },
      ],
    });
    expect(lectura.lineas).toEqual([]);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'ESTRUCTURA_INVALIDA',
        motivo: 'ENCABEZADO_DUPLICADO',
        campo: 'Neto',
        refs: [
          { archivo: 'FINNEGANS', hoja: 'hoja1', fila: 1, columna: 'J' },
          { archivo: 'FINNEGANS', hoja: 'hoja1', fila: 1, columna: 'O' },
          { archivo: 'FINNEGANS', hoja: 'hoja1', fila: 1, columna: 'P' },
        ],
      }),
    ]);
  });

  it('columna extra con encabezado: INFORMACION; columna con datos sin encabezado: INFORMACION', async () => {
    const lectura = await parsear([filaFinnegans(persona(0))], {
      columnasExtra: [
        { encabezado: 'Observaciones', valor: 'x' },
        { encabezado: null, valor: 'y' },
        { encabezado: num('5'), valor: null },
      ],
    });
    expect(lectura.lineas).toHaveLength(1);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'COLUMNA_DESCONOCIDA',
        nivel: 'INFORMACION',
        campo: 'Observaciones',
      }),
      expect.objectContaining({
        codigo: 'COLUMNA_DESCONOCIDA',
        motivo: 'SIN_ENCABEZADO_DE_TEXTO',
        refs: [expect.objectContaining({ columna: 'P' })],
      }),
      expect.objectContaining({
        codigo: 'COLUMNA_DESCONOCIDA',
        motivo: 'SIN_ENCABEZADO_DE_TEXTO',
        refs: [expect.objectContaining({ columna: 'Q' })],
      }),
    ]);
  });

  it('fórmula en el encabezado: BLOQUEANTE global', async () => {
    const lectura = await parsear([filaFinnegans(persona(0))], {
      columnasExtra: [{ encabezado: formula('"A"&"B"', 'AB'), valor: null }],
    });
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'FORMULA_EN_CELDA',
        nivel: 'BLOQUEANTE',
        objetivo: 'GLOBAL',
      }),
    ]);
  });

  it('sin filas de datos: BLOQUEANTE', async () => {
    const lectura = await parsear([]);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'ESTRUCTURA_INVALIDA', motivo: 'SIN_FILAS_DE_DATOS' }),
    ]);
  });

  it('filas vacías intermedias: se ignoran y se informan', async () => {
    const filas = gente.slice(0, 3).map((p) => filaFinnegans(p));
    const lectura = await parsear(filas, { huecosDespuesDe: [0, 1] });
    expect(lectura.lineas.map((linea) => linea.ref.fila)).toEqual([2, 4, 6]);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'FILAS_VACIAS_IGNORADAS',
        nivel: 'INFORMACION',
        detalle: '2 fila(s) totalmente vacía(s) ignorada(s).',
      }),
    ]);
  });
});

describe('CUIL (N-02 estricta D-052, D-050)', () => {
  const cuil = persona(0).cuil;

  it.each([
    ['con guiones', () => cuil],
    ['sin guiones', () => canonico(cuil)],
    ['con espacios U+0020 en los extremos', () => `  ${cuil} `],
    ['como texto compartido', () => sharedStr(cuil)],
  ])('acepta el CUIL %s y conserva el texto original', async (_caso, valor) => {
    const celda = valor();
    const lectura = await parsear([filaFinnegans(persona(0), { Cuil: celda })]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas[0]?.cuil).toBe(canonico(cuil));
    expect(lectura.lineas[0]?.cuilTexto).toBe(typeof celda === 'string' ? celda : cuil);
  });

  it.each([
    ['tab', () => cuil.replace('-', '\t'), 'CARACTER_NO_PERMITIDO'],
    ['espacios internos', () => cuil.replaceAll('-', ' '), 'CARACTER_NO_PERMITIDO'],
    [
      'guiones fuera de posición',
      () => `${canonico(cuil).slice(0, 3)}-${canonico(cuil).slice(3)}`,
      'FORMATO_INVALIDO',
    ],
    ['punto', () => cuil.replace('-', '.'), 'CARACTER_NO_PERMITIDO'],
    [
      'DV alterado',
      () => `${cuil.slice(0, -1)}${String((Number(cuil.at(-1)) + 1) % 10)}`,
      'DV_INVALIDO',
    ],
    ['con guiones y truncado', () => cuil.slice(0, -2), 'FORMATO_INVALIDO'],
    ['canónico corto', () => canonico(cuil).slice(0, -1), 'LONGITUD_INVALIDA'],
    ['vacío', () => '', 'VACIO'],
  ])(
    'CUIL inválido (%s): BLOQUEANTE de la fila con el valor observado',
    async (_caso, valor, motivo) => {
      const texto = valor();
      const lectura = await parsear([
        filaFinnegans(persona(0), { Cuil: texto === '' ? null : texto }),
      ]);
      expect(lectura.lineas[0]?.cuil).toBeNull();
      expect(lectura.hallazgos).toEqual([
        {
          codigo: 'CUIL_INVALIDO',
          nivel: 'BLOQUEANTE',
          objetivo: 'FILA',
          refs: [{ archivo: 'FINNEGANS', hoja: 'hoja1', fila: 2, columna: 'A' }],
          campo: 'Cuil',
          motivo,
          valores: { finnegans: texto },
          detalle: 'CUIL inválido (formato o dígito verificador).',
        },
      ]);
    },
  );

  it('CUIL en celda numérica: BLOQUEANTE (D-050), sin CUIL canónico', async () => {
    const lectura = await parsear([filaFinnegans(persona(0), { Cuil: num(canonico(cuil)) })]);
    expect(lectura.lineas[0]?.cuil).toBeNull();
    expect(lectura.lineas[0]?.cuilTexto).toBe(canonico(cuil));
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'CELDA_NUMERICA_EN_TEXTO',
        nivel: 'BLOQUEANTE',
        campo: 'Cuil',
      }),
    ]);
  });

  it('CUIL repetido: BLOQUEANTE en cada fila involucrada; nunca se suman ni fusionan', async () => {
    const filas = [
      filaFinnegans(persona(0), { Neto: '100' }),
      filaFinnegans(persona(1)),
      filaFinnegans({ ...persona(2), cuil: canonico(cuil) }, { Neto: '200' }),
    ];
    const lectura = await parsear(filas);
    expect(lectura.lineas).toHaveLength(3);
    expect(lectura.lineas.map((linea) => linea.neto)).toEqual([10_000n, 42_000_025n, 20_000n]);
    const repetidos = lectura.hallazgos.filter((h) => h.codigo === 'CUIL_REPETIDO_FINNEGANS');
    expect(repetidos.map((h) => h.refs.map((ref) => ref.fila))).toEqual([
      [2, 4],
      [4, 2],
    ]);
    expect(repetidos.every((h) => h.nivel === 'BLOQUEANTE' && h.objetivo === 'FILA')).toBe(true);
  });
});

describe('Legajo exacto (D-017, D-046)', () => {
  it.each(['007', '7', '0042', '007 ', ' 7', ''])('conserva %j sin normalizar', async (legajo) => {
    const lectura = await parsear([
      filaFinnegans(persona(0), { Legajo: legajo === '' ? null : legajo }),
    ]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas[0]?.legajo).toBe(legajo);
  });

  it('legajo en celda numérica: BLOQUEANTE y legajo ilegible', async () => {
    const lectura = await parsear([filaFinnegans(persona(0), { Legajo: num('7') })]);
    expect(lectura.lineas[0]?.legajo).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'CELDA_NUMERICA_EN_TEXTO',
        campo: 'Legajo',
        valores: { finnegans: '7' },
      }),
    ]);
  });

  it('legajo con fórmula: BLOQUEANTE global', async () => {
    const lectura = await parsear([
      filaFinnegans(persona(0), { Legajo: formula('"0"&"7"', '07') }),
    ]);
    expect(lectura.lineas[0]?.legajo).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'FORMULA_EN_CELDA', objetivo: 'GLOBAL', campo: 'Legajo' }),
    ]);
  });
});

describe('Banco y Descripcion', () => {
  it.each(['', '   ', 'BANCO PATAGONIA S.A.', 'banco nacion '])(
    'Banco %j se conserva tal cual (la clasificación es de la conciliación)',
    async (banco) => {
      const lectura = await parsear([
        filaFinnegans(persona(0), { Banco: banco === '' ? null : banco }),
      ]);
      expect(lectura.lineas[0]?.bancoFinnegans).toBe(banco);
    },
  );

  it('Banco en celda numérica: ilegible y BLOQUEANTE de la fila', async () => {
    const lectura = await parsear([filaFinnegans(persona(0), { Banco: num('11') })]);
    expect(lectura.lineas[0]?.bancoFinnegans).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'TIPO_CELDA_INVALIDO',
        nivel: 'BLOQUEANTE',
        objetivo: 'FILA',
        campo: 'Banco',
      }),
    ]);
  });

  it('Descripcion se conserva exacta y sin clasificar (P-10)', async () => {
    const lectura = await parsear([
      filaFinnegans(persona(0), { Descripcion: 'SEPTIEMBRE Liq final ' }),
    ]);
    expect(lectura.lineas[0]?.descripcion).toEqual({
      descripcionOriginal: 'SEPTIEMBRE Liq final ',
      clasificacion: { estado: 'REGLA_PENDIENTE' },
    });
  });

  it('Descripcion no textual: BLOQUEANTE; nombres no textuales: solo INFORMACION en F2', async () => {
    const lectura = await parsear([
      filaFinnegans(persona(0), {
        Descripcion: num('7'),
        Apellido: num('1'),
        Nombre: num('2'),
        Legajoapellidonombre: num('3'),
      }),
    ]);
    expect(lectura.lineas[0]?.descripcion.descripcionOriginal).toBe('');
    expect(lectura.lineas[0]?.apellido).toBe('');
    expect(lectura.lineas[0]?.nombre).toBe('');
    expect(lectura.lineas[0]?.legajoApellidoNombre).toBe('');
    const tipoInvalido = (campo: string, nivel: string) =>
      expect.objectContaining({ codigo: 'TIPO_CELDA_INVALIDO', nivel, campo }) as unknown;
    expect(lectura.hallazgos).toEqual([
      tipoInvalido('Apellido', 'INFORMACION'),
      tipoInvalido('Nombre', 'INFORMACION'),
      tipoInvalido('Descripcion', 'BLOQUEANTE'),
      tipoInvalido('Legajoapellidonombre', 'INFORMACION'),
    ]);
  });

  it('una celda ausente en columnas informativas queda como texto vacío, sin hallazgos', async () => {
    const lectura = await parsear([filaFinnegans(persona(0), { Legajoapellidonombre: null })]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.lineas[0]?.legajoApellidoNombre).toBe('');
  });
});

describe('importes (D-031, D-050)', () => {
  it.each([
    ['0', 0n],
    ['-1500.5', -150_050n],
    ['12345678.9', 1_234_567_890n],
  ])(
    'Neto %s → %s centavos, sin juzgar el valor (eso es de la conciliación)',
    async (neto, esperado) => {
      const lectura = await parsear([filaFinnegans(persona(0), { Neto: neto })]);
      expect(lectura.hallazgos).toEqual([]);
      expect(lectura.lineas[0]?.neto).toBe(esperado);
    },
  );

  it.each([
    ['texto con formato argentino', () => inlineStr('1.234,56'), 'CELDA_DE_TEXTO'],
    ['texto con decimal canónico', () => inlineStr('1234.56'), 'CELDA_DE_TEXTO'],
    ['tres decimales', () => num('10.125'), 'MAS_DE_2_DECIMALES'],
    ['celda vacía', () => null, 'VACIO'],
  ])('Neto no interpretable (%s): BLOQUEANTE global', async (_caso, celda, motivo) => {
    const lectura = await parsear([filaFinnegans(persona(0), { Neto: celda() })]);
    expect(lectura.lineas[0]?.neto).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'IMPORTE_INVALIDO',
        nivel: 'BLOQUEANTE',
        objetivo: 'GLOBAL',
        campo: 'Neto',
        motivo,
      }),
    ]);
  });

  it('componente no interpretable: BLOQUEANTE de la fila', async () => {
    const lectura = await parsear([filaFinnegans(persona(0), { Descuento: inlineStr('100') })]);
    expect(lectura.lineas[0]?.componentes.descuento).toBeNull();
    expect(lectura.lineas[0]?.neto).toBe(42_000_025n);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'IMPORTE_INVALIDO',
        objetivo: 'FILA',
        campo: 'Descuento',
        motivo: 'CELDA_DE_TEXTO',
        valores: { finnegans: '100' },
      }),
    ]);
  });

  it('fórmula en Neto: BLOQUEANTE global; en una columna no usada: INFORMACION', async () => {
    const lectura = await parsear([
      filaFinnegans(persona(0), {
        Neto: formula('F2+G2-H2', '1'),
        Centrodecosto: formula('"C"', 'C'),
      }),
    ]);
    expect(lectura.lineas[0]?.neto).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'FORMULA_EN_CELDA', nivel: 'BLOQUEANTE', campo: 'Neto' }),
      expect.objectContaining({
        codigo: 'FORMULA_EN_CELDA',
        nivel: 'INFORMACION',
        campo: 'Centrodecosto',
      }),
    ]);
  });

  it('celda combinada en un importe: tipo no admitido', async () => {
    const bytes = finnegansXlsx([
      filaFinnegans(persona(0), { Remunerativo: '1', 'No remunerativo': null }),
    ]);
    const conCombinada = await libro(bytes);
    const fila = conCombinada.sheets[0]?.rows[1];
    const combinada = {
      sheets: [
        {
          ...(conCombinada.sheets[0] ?? { name: 'hoja1', state: 'visible' as const, rows: [] }),
          rows: [
            conCombinada.sheets[0]?.rows[0] ?? { rowNumber: 1, cells: [] },
            {
              rowNumber: 2,
              cells: [...(fila?.cells ?? []), { column: 7, value: { kind: 'merged' as const } }],
            },
          ],
        },
      ],
    };
    const lectura = parseFinnegans(combinada);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'IMPORTE_INVALIDO',
        campo: 'No remunerativo',
        motivo: 'TIPO_DE_CELDA',
      }),
    ]);
  });
});

describe('privacidad y rendimiento', () => {
  it('ningún detalle contiene valores de celdas', async () => {
    const cuilAlterado = `${persona(0).cuil.slice(0, -1)}x`;
    const lectura = await parsear([
      filaFinnegans(persona(0), {
        Cuil: cuilAlterado,
        Legajo: num('7'),
        Neto: inlineStr('1.234,56'),
      }),
      filaFinnegans(persona(1)),
      filaFinnegans(persona(1)),
    ]);
    expect(lectura.hallazgos.length).toBeGreaterThanOrEqual(4);
    for (const h of lectura.hallazgos) {
      expect(h.detalle).not.toContain(canonico(persona(0).cuil).slice(2, 10));
      expect(h.detalle).not.toContain(canonico(persona(1).cuil).slice(2, 10));
      expect(h.detalle).not.toContain('1.234,56');
    }
  });

  it('lee 5.000 filas en menos de 1 s (después de la lectura XLSX)', async () => {
    const muchas = personas(5_000, 77).map((p) => filaFinnegans(p));
    const leido = await libro(finnegansXlsx(muchas));
    const inicio = performance.now();
    const lectura = parseFinnegans(leido);
    expect(performance.now() - inicio).toBeLessThan(1_000);
    expect(lectura.lineas).toHaveLength(5_000);
    expect(codigos(lectura.hallazgos)).toEqual([]);
  });

  it('un CUIL que no admite DV se informa como DV_NO_ASIGNABLE', async () => {
    let dni = 10_000;
    while (syntheticCuil('20', dni) !== null) {
      dni += 1;
    }
    const texto = `20${String(dni).padStart(8, '0')}0`;
    const lectura = await parsear([filaFinnegans(persona(0), { Cuil: texto })]);
    expect(lectura.hallazgos[0]).toMatchObject({
      codigo: 'CUIL_INVALIDO',
      motivo: 'DV_NO_ASIGNABLE',
    });
  });
});
