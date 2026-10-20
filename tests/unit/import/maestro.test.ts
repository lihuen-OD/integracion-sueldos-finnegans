// Parser del maestro con XLSX sintéticos (D-042: CUIL y CBU generados en tiempo de ejecución).
import { describe, expect, it } from 'vitest';
import type { Hallazgo } from '../../../src/domain/incidencias';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import {
  definicionPlantillaMaestro,
  generarPlantillaMaestro,
  prellenarDesdeFinnegans,
} from '../../../src/import/master/plantillaMaestro';
import { readWorkbook, writeWorkbook, type Workbook } from '../../../src/import/xlsx';
import { buildMaestroTiposMezclados } from '../../fixtures/synthetic/edgeCases.ts';
import {
  COLUMNAS_MAESTRO_V1,
  CONTROL_V1,
  espejoMuestra,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroBna,
  registroPatagonia,
  textoDeCelda,
  type OpcionesMaestro,
  type RegistroMaestro,
} from '../../fixtures/synthetic/escenarios.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { formula, inlineStr, num } from '../../fixtures/synthetic/xlsxBuilder.ts';

const FECHA = '2026-10-20';

async function libro(bytes: Uint8Array): Promise<Workbook> {
  const resultado = await readWorkbook(bytes);
  if (!resultado.ok) {
    throw new Error(resultado.error.kind);
  }
  return resultado.value;
}

async function parsear(registros: readonly RegistroMaestro[], opciones?: OpcionesMaestro) {
  return parseMaestro(await libro(maestroXlsx(registros, opciones)));
}

const gente = personas(6, 99);
const persona = (indice: number) => {
  const elegida = gente[indice];
  if (elegida === undefined) {
    throw new Error('persona sintética inexistente');
  }
  return elegida;
};
const random = createRandom(4);
const canonico = (cuil: string) => cuil.replaceAll('-', '');
const codigos = (hallazgos: readonly Hallazgo[]) => hallazgos.map((h) => h.codigo);

describe('ida y vuelta con la plantilla generada', () => {
  it('plantilla vacía: válida, sin registros ni hallazgos', async () => {
    const lectura = parseMaestro(
      await libro(await generarPlantillaMaestro({ fechaGeneracion: FECHA })),
    );
    expect(lectura).toEqual({
      hoja: 'Empleados',
      versionContrato: '1',
      registros: [],
      hallazgos: [],
    });
  });

  it('plantilla prellenada: CUIL canónico por N-02, legajo exacto, sin datos bancarios', async () => {
    const espejo = espejoMuestra();
    const { filas } = prellenarDesdeFinnegans(
      parseFinnegans(await libro(finnegansXlsx(espejo.filas))),
    );
    const lectura = parseMaestro(
      await libro(await generarPlantillaMaestro({ fechaGeneracion: FECHA, filas })),
    );
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros).toHaveLength(156);
    lectura.registros.forEach((registro, indice) => {
      const origen = espejo.filas[indice];
      expect(registro.cuilTexto).toBe(textoDeCelda(origen?.Cuil));
      expect(registro.cuil).toBe(canonico(textoDeCelda(origen?.Cuil)));
      expect(registro.legajo).toBe(origen?.Legajo);
      expect(registro.cbu).toEqual({ estado: 'VACIO' });
      const estados = Object.values(registro.patagonia) as readonly { estado: string }[];
      expect(estados.every((campo) => campo.estado === 'VACIO')).toBe(true);
    });
  });

  it('plantilla completada (como lo haría RRHH en Excel): los textos vuelven exactos y válidos', async () => {
    const [bna, patagonia] = [
      registroBna(persona(0), random),
      registroPatagonia(persona(1), random),
    ];
    const definicion = definicionPlantillaMaestro({ fechaGeneracion: FECHA });
    const [empleados, ...resto] = definicion.sheets;
    if (empleados === undefined) {
      throw new Error('sin hoja Empleados');
    }
    const fila = (registro: RegistroMaestro) =>
      COLUMNAS_MAESTRO_V1.map((columna) => {
        const valor = registro[columna];
        return typeof valor === 'string' ? valor : null;
      });
    const bytes = await writeWorkbook({
      sheets: [
        { ...empleados, rows: [fila({ ...bna, LEGAJO: '007' }), fila(patagonia)] },
        ...resto,
      ],
    });
    const lectura = parseMaestro(await libro(bytes));
    expect(lectura.hallazgos).toEqual([]);
    const [primero, segundo] = lectura.registros;
    expect(primero?.legajo).toBe('007');
    expect(primero?.cbu).toEqual({ estado: 'VALIDO', texto: bna.CBU, valor: bna.CBU });
    expect(segundo?.patagonia.tipoDocumento).toEqual({
      estado: 'VALIDO',
      texto: '001',
      valor: '001',
    });
    expect(segundo?.patagonia.codigoBanco).toMatchObject({ estado: 'VALIDO', valor: '034' });
    expect(segundo?.patagonia.codigoDependencia).toMatchObject({ estado: 'VALIDO', valor: '100' });
  });

  it('maestro sintético completo (espejo): 156 registros válidos', async () => {
    const espejo = espejoMuestra();
    const lectura = await parsear(espejo.registros);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros.filter((r) => r.cbu.estado === 'VALIDO')).toHaveLength(117);
    expect(
      lectura.registros.filter((r) => r.patagonia.numeroCuenta.estado === 'VALIDO'),
    ).toHaveLength(39);
  });
});

describe('hoja Control y versión del contrato (D-051)', () => {
  const uno = [registroBna(persona(0), random)];

  it.each([
    ['sin hoja Control', { control: null }, 'SIN_HOJA_CONTROL', null],
    ['sin clave VERSION_CONTRATO', { control: [['CLAVE', 'VALOR']] }, 'SIN_VERSION', null],
    ['versión 2', { control: [['VERSION_CONTRATO', '2']] }, 'VERSION_INCOMPATIBLE', '2'],
    [
      'versión numérica',
      { control: [['VERSION_CONTRATO', num('1')]] },
      'VERSION_INCOMPATIBLE',
      null,
    ],
    [
      'versión con espacio',
      { control: [['VERSION_CONTRATO', '1 ']] },
      'VERSION_INCOMPATIBLE',
      '1 ',
    ],
  ] as const)(
    '%s → BLOQUEANTE global, pero los registros se leen igual',
    async (_caso, opciones, motivo, version) => {
      const lectura = await parsear(uno, opciones);
      expect(lectura.versionContrato).toBe(version);
      expect(lectura.registros).toHaveLength(1);
      expect(lectura.hallazgos).toEqual([
        expect.objectContaining({
          codigo: 'VERSION_MAESTRO_NO_SOPORTADA',
          nivel: 'BLOQUEANTE',
          objetivo: 'GLOBAL',
          motivo,
        }),
      ]);
    },
  );

  it('dos hojas Control: no se elige ninguna', async () => {
    const lectura = await parsear(uno, {
      hojasExtra: [
        {
          name: ' Control',
          rows: CONTROL_V1.map((fila) => fila.map((celda) => inlineStr(textoDeCelda(celda)))),
        },
      ],
    });
    expect(lectura.hallazgos[0]).toMatchObject({ motivo: 'VARIAS_HOJAS_CONTROL' });
  });
});

describe('estructura de la hoja Empleados (§B.3)', () => {
  const uno = [registroBna(persona(0), random)];

  it('sin hoja Empleados: BLOQUEANTE global', async () => {
    const lectura = await parsear(uno, { hojaEmpleados: 'Personal' });
    expect(lectura.hoja).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'ESTRUCTURA_INVALIDA', motivo: 'HOJA_NO_ENCONTRADA' }),
    ]);
  });

  it('dos hojas Empleados (N-01): no se elige ninguna', async () => {
    const lectura = await parsear(uno, {
      hojasExtra: [{ name: ' EMPLEADOS', rows: [[inlineStr('CUIL')]] }],
    });
    expect(lectura.hoja).toBeNull();
    expect(lectura.hallazgos[0]).toMatchObject({ motivo: 'VARIAS_HOJAS_CANDIDATAS' });
  });

  it('acepta encabezados con otras mayúsculas o espacios extremos (N-01)', async () => {
    const encabezados = COLUMNAS_MAESTRO_V1.map((nombre) =>
      nombre === 'CUIL' ? 'cuil' : nombre === 'LEGAJO' ? ' Legajo ' : nombre,
    );
    const lectura = await parsear(uno, { encabezados });
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros).toHaveLength(1);
  });

  it('columna requerida faltante: BLOQUEANTE global por columna; no lee registros', async () => {
    const encabezados = COLUMNAS_MAESTRO_V1.map((nombre) =>
      nombre === 'CBU' ? 'CBU_EMPLEADO' : nombre === 'PAT_TIPO_CUENTA' ? null : nombre,
    );
    const lectura = await parsear(uno, { encabezados });
    expect(lectura.hoja).toBe('Empleados');
    expect(lectura.registros).toEqual([]);
    expect(
      lectura.hallazgos.filter((h) => h.motivo === 'COLUMNA_FALTANTE').map((h) => h.campo),
    ).toEqual(['CBU', 'PAT_TIPO_CUENTA']);
  });

  it('APELLIDO_NOMBRE_REF es la única columna opcional', async () => {
    const encabezados = COLUMNAS_MAESTRO_V1.map((nombre) =>
      nombre === 'APELLIDO_NOMBRE_REF' ? null : nombre,
    );
    const lectura = await parsear([{ ...uno[0], APELLIDO_NOMBRE_REF: null } as RegistroMaestro], {
      encabezados,
    });
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros[0]?.apellidoNombreRef).toBe('');
  });

  it('encabezado duplicado: BLOQUEANTE y no lee registros', async () => {
    const lectura = await parsear(uno, { columnasExtra: [{ encabezado: 'legajo', valor: '1' }] });
    expect(lectura.registros).toEqual([]);
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({ motivo: 'ENCABEZADO_DUPLICADO', campo: 'LEGAJO' }),
    ]);
  });

  it('columna desconocida: INFORMACION; filas vacías intermedias: INFORMACION', async () => {
    const lectura = await parsear([...uno, registroBna(persona(1), random)], {
      columnasExtra: [{ encabezado: 'OBSERVACIONES', valor: 'nota' }],
      huecosDespuesDe: [0],
    });
    expect(lectura.registros.map((r) => r.ref.fila)).toEqual([2, 4]);
    expect(codigos(lectura.hallazgos)).toEqual(['COLUMNA_DESCONOCIDA', 'FILAS_VACIAS_IGNORADAS']);
  });

  it('el maestro editado a mano del spike (tipos mezclados, sin Control) se diagnostica sin errores', async () => {
    const lectura = parseMaestro(await libro(buildMaestroTiposMezclados()));
    expect(lectura.registros).toEqual([]);
    expect(lectura.hallazgos[0]).toMatchObject({ motivo: 'SIN_HOJA_CONTROL' });
    expect(
      lectura.hallazgos.filter((h) => h.motivo === 'COLUMNA_FALTANTE').map((h) => h.campo),
    ).toEqual(COLUMNAS_MAESTRO_V1.filter((columna) => columna.startsWith('PAT_')));
  });
});

describe('CUIL del maestro (N-02, D-046) y LEGAJO exacto', () => {
  const base = registroBna(persona(0), random);
  const cuil = persona(0).cuil;

  it.each([
    ['con guiones', cuil],
    ['sin guiones', canonico(cuil)],
    ['con espacios U+0020', ` ${cuil.replaceAll('-', ' ')} `],
  ])('CUIL %s → canónico, con el texto original conservado', async (_caso, texto) => {
    const lectura = await parsear([{ ...base, CUIL: texto }]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros[0]?.cuil).toBe(canonico(cuil));
    expect(lectura.registros[0]?.cuilTexto).toBe(texto);
  });

  it.each([
    ['tab', cuil.replace('-', '\t'), 'CARACTER_NO_PERMITIDO'],
    ['NBSP', cuil.replace('-', '\u00a0'), 'CARACTER_NO_PERMITIDO'],
    ['punto', cuil.replace('-', '.'), 'CARACTER_NO_PERMITIDO'],
    ['vacío', null, 'VACIO'],
  ])('CUIL con %s → CUIL_INVALIDO de registro', async (_caso, texto, motivo) => {
    const lectura = await parsear([{ ...base, CUIL: texto }]);
    expect(lectura.registros[0]?.cuil).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'CUIL_INVALIDO',
        nivel: 'BLOQUEANTE',
        objetivo: 'REGISTRO',
        campo: 'CUIL',
        motivo,
        refs: [{ archivo: 'MAESTRO', hoja: 'Empleados', fila: 2, columna: 'A' }],
      }),
    ]);
  });

  it.each([
    ['número', num(canonico(cuil)), 'CELDA_NUMERICA_EN_TEXTO', canonico(cuil)],
    ['fórmula', formula('"2"&"0"', '20'), 'FORMULA_EN_CELDA', ''],
  ])(
    'CUIL en celda %s → %s de registro, sin CUIL canónico',
    async (_caso, celda, codigo, texto) => {
      const lectura = await parsear([{ ...base, CUIL: celda }]);
      expect(lectura.registros[0]?.cuil).toBeNull();
      expect(lectura.registros[0]?.cuilTexto).toBe(texto);
      expect(lectura.hallazgos).toEqual([
        expect.objectContaining({
          codigo,
          nivel: 'BLOQUEANTE',
          objetivo: 'REGISTRO',
          campo: 'CUIL',
        }),
      ]);
    },
  );

  it.each(['007', '7', '0042', '007 ', ' 7'])(
    'LEGAJO %j se conserva sin normalizar',
    async (legajo) => {
      const lectura = await parsear([{ ...base, LEGAJO: legajo }]);
      expect(lectura.hallazgos).toEqual([]);
      expect(lectura.registros[0]?.legajo).toBe(legajo);
    },
  );

  it.each([
    ['vacío', null, 'CAMPO_REQUERIDO_FALTANTE'],
    ['numérico', num('7'), 'CELDA_NUMERICA_EN_TEXTO'],
    [
      'con fecha u otro tipo',
      { kind: 'number', xml: 'no-es-numero' } as const,
      'TIPO_CELDA_INVALIDO',
    ],
  ])('LEGAJO %s → %s de registro y legajo nulo', async (_caso, celda, codigo) => {
    const lectura = await parsear([{ ...base, LEGAJO: celda }]);
    expect(lectura.registros[0]?.legajo).toBeNull();
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo,
        nivel: 'BLOQUEANTE',
        objetivo: 'REGISTRO',
        campo: 'LEGAJO',
      }),
    ]);
  });

  it('APELLIDO_NOMBRE_REF no textual: solo INFORMACION (nunca se usa)', async () => {
    const lectura = await parsear([{ ...base, APELLIDO_NOMBRE_REF: formula('"A"', 'A') }]);
    expect(lectura.registros[0]?.apellidoNombreRef).toBe('');
    expect(lectura.hallazgos).toEqual([
      expect.objectContaining({
        codigo: 'FORMULA_EN_CELDA',
        nivel: 'INFORMACION',
        campo: 'APELLIDO_NOMBRE_REF',
      }),
    ]);
  });
});

describe('campos bancarios: estado por campo, sin hallazgos en el parser (D-048)', () => {
  it('un PAT_* inválido en un empleado BNA queda registrado pero no genera bloqueo aquí', async () => {
    const lectura = await parsear([{ ...registroBna(persona(0), random), PAT_TIPO_CUENTA: '9' }]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros[0]?.cbu.estado).toBe('VALIDO');
    expect(lectura.registros[0]?.patagonia.tipoCuenta).toEqual({
      estado: 'INVALIDO',
      texto: '9',
      motivo: 'FUERA_DE_CATALOGO',
    });
  });

  it('CBU numérico (Excel pudo perder dígitos), con espacios o con fórmula: INVALIDO con motivo', async () => {
    const bna = registroBna(persona(0), random);
    const cbu = textoDeCelda(bna.CBU);
    const lectura = await parsear([
      { ...bna, CBU: num('1.1059923000045988E21') },
      { ...registroBna(persona(1), random), CBU: `${cbu.slice(0, 8)} ${cbu.slice(8)}` },
      { ...registroBna(persona(2), random), CBU: formula('"0"', '0') },
    ]);
    expect(lectura.hallazgos).toEqual([]);
    expect(lectura.registros.map((r) => r.cbu.estado === 'INVALIDO' && r.cbu.motivo)).toEqual([
      'CELDA_NUMERICA',
      'CARACTER_NO_PERMITIDO',
      'FORMULA',
    ]);
  });

  it('dependencia: se conserva tal cual (PAT-2)', async () => {
    const lectura = await parsear([
      { ...registroPatagonia(persona(0), random), PAT_CODIGO_DEPENDENCIA: ' Dep. 01 ' },
    ]);
    expect(lectura.registros[0]?.patagonia.codigoDependencia).toEqual({
      estado: 'VALIDO',
      texto: ' Dep. 01 ',
      valor: ' Dep. 01 ',
    });
  });
});

describe('duplicados (regla 3, D-047): se detectan siempre y nunca se elige uno', () => {
  it('CUIL repetido (aunque uno tenga guiones y el otro no) en todos los registros involucrados', async () => {
    const a = registroBna(persona(0), random);
    const lectura = await parsear([
      a,
      registroBna(persona(1), random),
      { ...registroPatagonia(persona(2), random), CUIL: canonico(persona(0).cuil) },
    ]);
    const repetidos = lectura.hallazgos.filter((h) => h.codigo === 'CUIL_REPETIDO_MAESTRO');
    expect(repetidos.map((h) => h.refs.map((ref) => ref.fila))).toEqual([
      [2, 4],
      [4, 2],
    ]);
    expect(repetidos.map((h) => h.valores)).toEqual([
      { maestro: persona(0).cuil },
      { maestro: canonico(persona(0).cuil) },
    ]);
    expect(repetidos.every((h) => h.nivel === 'BLOQUEANTE' && h.objetivo === 'REGISTRO')).toBe(
      true,
    );
    expect(lectura.registros).toHaveLength(3);
  });

  it('LEGAJO repetido exacto; 007 y 7 no son el mismo legajo', async () => {
    const lectura = await parsear([
      { ...registroBna(persona(0), random), LEGAJO: '007' },
      { ...registroBna(persona(1), random), LEGAJO: '7' },
      { ...registroBna(persona(2), random), LEGAJO: '007' },
      { ...registroBna(persona(3), random), LEGAJO: null },
      { ...registroBna(persona(4), random), LEGAJO: null },
    ]);
    const repetidos = lectura.hallazgos.filter((h) => h.codigo === 'LEGAJO_REPETIDO_MAESTRO');
    expect(repetidos.map((h) => h.refs[0]?.fila)).toEqual([2, 4]);
    expect(repetidos.map((h) => h.valores)).toEqual([{ maestro: '007' }, { maestro: '007' }]);
  });
});

describe('privacidad y rendimiento', () => {
  it('ningún detalle contiene valores de celdas', async () => {
    const lectura = await parsear([
      {
        ...registroBna(persona(0), random),
        CUIL: `${persona(0).cuil.slice(0, -1)}x`,
        LEGAJO: num('7'),
      },
      registroBna(persona(1), random),
      registroBna(persona(1), random),
    ]);
    expect(lectura.hallazgos.length).toBeGreaterThanOrEqual(4);
    for (const h of lectura.hallazgos) {
      expect(h.detalle).not.toContain(canonico(persona(0).cuil).slice(2, 10));
      expect(h.detalle).not.toContain(canonico(persona(1).cuil).slice(2, 10));
    }
  });

  it('lee 5.000 registros en menos de 1 s (después de la lectura XLSX)', async () => {
    const muchos = personas(5_000, 3).map((p, i) =>
      i % 4 === 3 ? registroPatagonia(p, random) : registroBna(p, random),
    );
    const leido = await libro(maestroXlsx(muchos));
    const inicio = performance.now();
    const lectura = parseMaestro(leido);
    expect(performance.now() - inicio).toBeLessThan(1_000);
    expect(lectura.registros).toHaveLength(5_000);
    expect(lectura.hallazgos).toEqual([]);
  });
});
