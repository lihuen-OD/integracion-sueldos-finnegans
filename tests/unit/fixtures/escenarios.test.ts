// Verifica que los generadores sintéticos producen lo que dicen (lectura con el adaptador).
import { describe, expect, it } from 'vitest';
import { readWorkbook, type Workbook } from '../../../src/import/xlsx';
import {
  COLUMNAS_MAESTRO_V1,
  espejoMuestra,
  finnegansXlsx,
  maestroXlsx,
  personas,
} from '../../fixtures/synthetic/escenarios.ts';
import { formula } from '../../fixtures/synthetic/xlsxBuilder.ts';

async function leer(bytes: Uint8Array): Promise<Workbook> {
  const resultado = await readWorkbook(bytes);
  if (!resultado.ok) {
    throw new Error(resultado.error.kind);
  }
  return resultado.value;
}

function columna(libro: Workbook, numero: number): string[] {
  return (libro.sheets[0]?.rows.slice(1) ?? []).map((fila) => {
    const valor = fila.cells.find((celda) => celda.column === numero)?.value;
    return valor === undefined
      ? ''
      : valor.kind === 'text' || valor.kind === 'number'
        ? valor.text
        : `(${valor.kind})`;
  });
}

const contar = (valores: readonly string[]) =>
  valores.reduce<Record<string, number>>(
    (acc, valor) => ({ ...acc, [valor]: (acc[valor] ?? 0) + 1 }),
    {},
  );

describe('espejoMuestra: agregados de docs/03 §A.2 con datos sintéticos', () => {
  const espejo = espejoMuestra();

  it('156 filas, bancos 116 / 39 / 1 vacío, un neto cero', async () => {
    const libro = await leer(finnegansXlsx(espejo.filas));
    expect(libro.sheets[0]?.rows).toHaveLength(157);
    const bancos = contar(columna(libro, 5));
    expect(bancos).toEqual({
      'BANCO DE LA NACION ARGENTINA': 116,
      'BANCO PATAGONIA S.A.': 39,
      '': 1,
    });
    expect(columna(libro, 10).filter((neto) => neto === '0')).toHaveLength(1);
  });

  it('legajos: 3 dígitos, 50 con cero inicial, sin repetidos; CUIL sin repetidos', async () => {
    const libro = await leer(finnegansXlsx(espejo.filas));
    const legajos = columna(libro, 4);
    expect(legajos.every((legajo) => /^[0-9]{3}$/.test(legajo))).toBe(true);
    expect(legajos.filter((legajo) => legajo.startsWith('0'))).toHaveLength(50);
    expect(new Set(legajos).size).toBe(156);
    expect(new Set(columna(libro, 1)).size).toBe(156);
  });

  it('espacios finales: 9 apellidos y 12 nombres', async () => {
    const libro = await leer(finnegansXlsx(espejo.filas));
    expect(columna(libro, 2).filter((texto) => texto.endsWith(' '))).toHaveLength(9);
    expect(columna(libro, 3).filter((texto) => texto.endsWith(' '))).toHaveLength(12);
  });

  it('descripciones: Agrario 121, Comercio 27, Directivos 4, Liq. Final 4 en dos variantes', async () => {
    const libro = await leer(finnegansXlsx(espejo.filas));
    expect(contar(columna(libro, 11))).toEqual({
      'JULIO Agrario': 121,
      'JULIO Comercio ': 27,
      'JULIO Directivos': 4,
      'JULIO Liq final ': 2,
      'JULIO Liq Final': 2,
    });
  });

  it('netos enteros y coherentes con sus componentes', () => {
    for (const fila of espejo.filas) {
      const valor = (celda: unknown) => Number(celda);
      expect(Number.isInteger(valor(fila.Neto))).toBe(true);
      expect(
        valor(fila.Remunerativo) + valor(fila['No remunerativo']) - valor(fila.Descuento),
      ).toBe(valor(fila.Neto));
    }
  });

  it('maestro completo: una fila por persona, Control oculto con VERSION_CONTRATO 1', async () => {
    const libro = await leer(maestroXlsx(espejo.registros));
    expect(libro.sheets.map((hoja) => [hoja.name, hoja.state])).toEqual([
      ['Empleados', 'visible'],
      ['Control', 'hidden'],
    ]);
    expect(libro.sheets[0]?.rows).toHaveLength(157);
    expect(columna(libro, 7).filter((banco) => banco === '034')).toHaveLength(39);
    expect(columna(libro, 4).filter((cbu) => cbu.startsWith('011'))).toHaveLength(117);
  });
});

describe('opciones de los generadores', () => {
  const [persona] = personas(1);

  it('permite celdas ausentes, fórmulas, huecos, encabezados y columnas extra', async () => {
    if (persona === undefined) {
      throw new Error('sin persona');
    }
    const libro = await leer(
      maestroXlsx(
        [
          {
            CUIL: persona.cuil,
            LEGAJO: formula('1+1', '2'),
            APELLIDO_NOMBRE_REF: null,
            CBU: null,
            PAT_TIPO_CUENTA: null,
            PAT_NUMERO_CUENTA: null,
            PAT_CODIGO_BANCO: null,
            PAT_CODIGO_SUCURSAL: null,
            PAT_TIPO_DOCUMENTO: null,
            PAT_NUMERO_DOCUMENTO: null,
            PAT_PROVINCIA_DOCUMENTO: null,
            PAT_CODIGO_DEPENDENCIA: null,
          },
        ],
        {
          control: null,
          columnasExtra: [{ encabezado: 'OBS', valor: 'x' }],
          huecosDespuesDe: [0],
        },
      ),
    );
    expect(libro.sheets).toHaveLength(1);
    const [encabezado, datos] = libro.sheets[0]?.rows ?? [];
    expect(encabezado?.cells).toHaveLength(COLUMNAS_MAESTRO_V1.length + 1);
    expect(datos?.cells.map((celda) => celda.value.kind)).toEqual(['text', 'formula', 'text']);
  });
});
