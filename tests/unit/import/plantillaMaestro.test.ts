import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { scanText } from '../../../scripts/lib/sensitive.ts';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { COLUMNAS_MAESTRO } from '../../../src/import/master/contrato';
import {
  definicionPlantillaMaestro,
  FILAS_PREPARADAS,
  generarPlantillaMaestro,
  nombreArchivoMaestro,
  prellenarDesdeFinnegans,
} from '../../../src/import/master/plantillaMaestro';
import { readWorkbook, type Workbook } from '../../../src/import/xlsx';
import {
  COLUMNAS_MAESTRO_V1,
  espejoMuestra,
  filaFinnegans,
  finnegansXlsx,
  personas,
  textoDeCelda,
  type FilaFinnegans,
} from '../../fixtures/synthetic/escenarios.ts';
import { num } from '../../fixtures/synthetic/xlsxBuilder.ts';

const FECHA = '2026-10-20';

async function libro(bytes: Uint8Array): Promise<Workbook> {
  const resultado = await readWorkbook(bytes);
  if (!resultado.ok) {
    throw new Error(resultado.error.kind);
  }
  return resultado.value;
}

async function lecturaDe(filas: readonly FilaFinnegans[]) {
  return parseFinnegans(await libro(finnegansXlsx(filas)));
}

const textoDe = (hoja: Workbook['sheets'][number] | undefined, fila: number, columna: number) => {
  const valor = hoja?.rows
    .find((row) => row.rowNumber === fila)
    ?.cells.find((cell) => cell.column === columna)?.value;
  return valor?.kind === 'text' ? valor.text : valor?.kind;
};

describe('definición de la plantilla (docs/03 §B)', () => {
  const definicion = definicionPlantillaMaestro({ fechaGeneracion: FECHA });

  it('tiene las 4 hojas del contrato; Control oculta', () => {
    expect(definicion.sheets.map((hoja) => [hoja.name, hoja.state ?? 'visible'])).toEqual([
      ['Empleados', 'visible'],
      ['Instrucciones', 'visible'],
      ['Catalogos', 'visible'],
      ['Control', 'hidden'],
    ]);
  });

  it('Empleados: las 12 columnas v1 en orden, todas en formato Texto', () => {
    const [empleados] = definicion.sheets;
    expect(empleados?.columns.map((columna) => columna.header)).toEqual([...COLUMNAS_MAESTRO_V1]);
    expect(COLUMNAS_MAESTRO).toEqual(COLUMNAS_MAESTRO_V1);
    expect(empleados?.columns.every((columna) => columna.format === 'text')).toBe(true);
    expect(empleados?.preparedRows).toBe(FILAS_PREPARADAS);
    expect(empleados?.rows).toEqual([]);
  });

  it('listas desplegables solo para tipo de cuenta, tipo de documento y provincia', () => {
    const listas = Object.fromEntries(
      (definicion.sheets[0]?.columns ?? [])
        .filter((columna) => columna.allowedValues !== undefined)
        .map((columna) => [columna.header, columna.allowedValues]),
    );
    expect(Object.keys(listas)).toEqual([
      'PAT_TIPO_CUENTA',
      'PAT_TIPO_DOCUMENTO',
      'PAT_PROVINCIA_DOCUMENTO',
    ]);
    expect(listas['PAT_TIPO_CUENTA']).toEqual(['1', '2']);
    expect(listas['PAT_TIPO_DOCUMENTO']).toEqual(['001', '002', '003', '004', '006']);
    expect(listas['PAT_PROVINCIA_DOCUMENTO']).toHaveLength(24);
  });

  it('Control: versión de contrato 1, fecha y tipo', () => {
    expect(definicion.sheets[3]?.rows).toEqual([
      ['VERSION_CONTRATO', '1'],
      ['FECHA_GENERACION', FECHA],
      ['TIPO', 'VACIA'],
      ['GENERADO_POR', 'Conversor de Haberes'],
    ]);
  });

  it('Catalogos: 2 tipos de cuenta, 5 documentos y 24 provincias, con fuente', () => {
    const filas = definicion.sheets[2]?.rows ?? [];
    const porCatalogo = (nombre: string) => filas.filter((fila) => fila[0] === nombre).length;
    expect([
      porCatalogo('TIPO_CUENTA'),
      porCatalogo('TIPO_DOCUMENTO'),
      porCatalogo('PROVINCIA'),
    ]).toEqual([2, 5, 24]);
    expect(filas.every((fila) => String(fila[3]).startsWith('PAT-DR'))).toBe(true);
  });

  it('las instrucciones no contienen nada con forma de CUIL o CBU (D-042)', () => {
    const texto = (definicion.sheets[1]?.rows ?? []).map((fila) => fila.join(' ')).join('\n');
    expect(scanText('plantilla/instrucciones.txt', texto)).toEqual([]);
    expect(texto).toContain('007 no es igual a 7');
    expect(texto).toContain('No se deriva del CUIL');
  });

  it('rechaza una fecha de generación mal formada', () => {
    expect(() => definicionPlantillaMaestro({ fechaGeneracion: '20/10/2026' })).toThrow(RangeError);
    expect(() => nombreArchivoMaestro('2026-1-2')).toThrow(RangeError);
  });

  it('nombre del archivo: base para la vacía, con fecha para una versión nueva', () => {
    expect(nombreArchivoMaestro()).toBe('MAESTRO_CUENTAS_EMPLEADOS.xlsx');
    expect(nombreArchivoMaestro(FECHA)).toBe('MAESTRO_CUENTAS_EMPLEADOS_2026-10-20.xlsx');
  });
});

describe('prellenado desde Finnegans (D-051)', () => {
  it('una fila por CUIL con guiones, legajo exacto y referencia de nombre; nada bancario', async () => {
    const espejo = espejoMuestra();
    const { filas, resumen } = prellenarDesdeFinnegans(await lecturaDe(espejo.filas));
    expect(resumen).toEqual({
      prellenadas: 156,
      omitidasCuilInvalido: 0,
      omitidasCuilRepetido: 0,
      omitidasLegajoIlegible: 0,
    });
    filas.forEach((fila, indice) => {
      const origen = espejo.filas[indice];
      expect(fila.cuil).toMatch(/^[0-9]{2}-[0-9]{8}-[0-9]$/);
      expect(fila.cuil).toBe(origen?.Cuil);
      expect(fila.legajo).toBe(origen?.Legajo);
      expect(fila.apellidoNombreRef).toBe(
        `${textoDeCelda(origen?.Apellido)}, ${textoDeCelda(origen?.Nombre)}`,
      );
    });
    expect(filas.filter((fila) => fila.legajo.startsWith('0'))).toHaveLength(50);
  });

  it('omite y cuenta CUIL inválidos, CUIL repetidos (sin elegir uno) y legajos ilegibles', async () => {
    const [a, b, c, d] = personas(4);
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      throw new Error('faltan personas sintéticas');
    }
    const lectura = await lecturaDe([
      filaFinnegans(a, { Cuil: `${a.cuil.slice(0, -1)}x` }),
      filaFinnegans(b),
      filaFinnegans({ ...c, cuil: b.cuil }),
      filaFinnegans(d, { Legajo: num('7') }),
      filaFinnegans(c, { Apellido: null, Nombre: null }),
    ]);
    const { filas, resumen } = prellenarDesdeFinnegans(lectura);
    expect(resumen).toEqual({
      prellenadas: 1,
      omitidasCuilInvalido: 1,
      omitidasCuilRepetido: 2,
      omitidasLegajoIlegible: 1,
    });
    expect(filas).toEqual([{ cuil: c.cuil, legajo: c.legajo, apellidoNombreRef: '' }]);
  });

  it('el CUIL sin guiones de Finnegans se muestra con guiones en la plantilla', async () => {
    const [a] = personas(1);
    if (a === undefined) {
      throw new Error('sin persona');
    }
    const lectura = await lecturaDe([filaFinnegans(a, { Cuil: a.cuil.replaceAll('-', '') })]);
    expect(prellenarDesdeFinnegans(lectura).filas[0]?.cuil).toBe(a.cuil);
  });
});

describe('XLSX generado', () => {
  it('vacía: hojas, encabezados y estado se leen de vuelta', async () => {
    const leido = await libro(await generarPlantillaMaestro({ fechaGeneracion: FECHA }));
    expect(leido.sheets.map((hoja) => [hoja.name, hoja.state])).toEqual([
      ['Empleados', 'visible'],
      ['Instrucciones', 'visible'],
      ['Catalogos', 'visible'],
      ['Control', 'hidden'],
    ]);
    const empleados = leido.sheets[0];
    expect(
      COLUMNAS_MAESTRO_V1.map((_columna, indice) => textoDe(empleados, 1, indice + 1)),
    ).toEqual([...COLUMNAS_MAESTRO_V1]);
    expect(empleados?.rows).toHaveLength(1);
  });

  it('formato Texto (numFmt 49), listas con ceros a la izquierda y ninguna fórmula', async () => {
    const partes = unzipSync(await generarPlantillaMaestro({ fechaGeneracion: FECHA }));
    expect(strFromU8(partes['xl/styles.xml'] ?? new Uint8Array())).toContain('numFmtId="49"');
    const hoja1 = strFromU8(partes['xl/worksheets/sheet1.xml'] ?? new Uint8Array());
    expect(hoja1).toContain('&quot;001,002,003,004,006&quot;');
    expect(hoja1).toContain('&quot;01,02,03,04,05,06,07,08,09,10,');
    expect(hoja1).toContain('&quot;1,2&quot;');
    for (const [nombre, contenido] of Object.entries(partes)) {
      if (nombre.startsWith('xl/worksheets/')) {
        expect(strFromU8(contenido)).not.toContain('<f>');
      }
    }
  });

  it('prellenada: datos como texto exacto, incluso un nombre que parece fórmula', async () => {
    const [a, b] = personas(2);
    if (a === undefined || b === undefined) {
      throw new Error('faltan personas sintéticas');
    }
    const lectura = await lecturaDe([
      filaFinnegans({ ...a, legajo: '007' }),
      filaFinnegans({ ...b, legajo: '0042', apellido: '=HYPERLINK("x")' }),
    ]);
    const { filas } = prellenarDesdeFinnegans(lectura);
    const leido = await libro(await generarPlantillaMaestro({ fechaGeneracion: FECHA, filas }));
    const empleados = leido.sheets[0];
    expect([textoDe(empleados, 2, 1), textoDe(empleados, 2, 2)]).toEqual([a.cuil, '007']);
    expect([textoDe(empleados, 3, 2), textoDe(empleados, 3, 3)]).toEqual([
      '0042',
      `=HYPERLINK("x"), ${b.nombre}`,
    ]);
    expect(textoDe(leido.sheets[3], 4, 2)).toBe('PRELLENADA');
  });

  it('se genera en menos de 5 s con 300 empleados', async () => {
    const { filas } = prellenarDesdeFinnegans(
      await lecturaDe(personas(300, 5).map((persona) => filaFinnegans(persona))),
    );
    const inicio = performance.now();
    await generarPlantillaMaestro({ fechaGeneracion: FECHA, filas });
    expect(performance.now() - inicio).toBeLessThan(5_000);
  });
});
