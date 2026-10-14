import { beforeAll, describe, expect, it } from 'vitest';
import { readWorkbook, type Workbook } from '../../src/import/xlsx';
import {
  buildFinnegansLike,
  FINNEGANS_HEADERS,
  type FinnegansLikeFixture,
} from '../fixtures/synthetic/finnegansLike.ts';
import { cellAt, textAt, unwrap } from './helpers.ts';

let fixture: FinnegansLikeFixture;
let workbook: Workbook;

beforeAll(async () => {
  fixture = buildFinnegansLike();
  workbook = unwrap(await readWorkbook(fixture.bytes));
});

describe('T1 · dimensión declarada incorrecta (<dimension ref="A1">)', () => {
  it('lee la hoja completa: 1 encabezado + 160 filas, 14 columnas', () => {
    expect(workbook.sheets).toHaveLength(1);
    const [sheet] = workbook.sheets;
    expect(sheet?.name).toBe('hoja1');
    expect(sheet?.state).toBe('visible');
    expect(sheet?.rows).toHaveLength(161);
    expect(sheet?.rows.at(-1)?.rowNumber).toBe(161);
    const maxColumn = Math.max(
      ...(sheet?.rows.flatMap((row) => row.cells.map((cell) => cell.column)) ?? []),
    );
    expect(maxColumn).toBe(14);
  });

  it('reconoce los 14 encabezados exactos de Finnegans', () => {
    const headers = FINNEGANS_HEADERS.map((_header, index) => textAt(workbook, 0, 1, index + 1));
    expect(headers).toEqual([...FINNEGANS_HEADERS]);
  });
});

describe('T2 · textos preservados (celdas inlineStr)', () => {
  it('CUIL con guiones, legajos con ceros, nombres y descripciones idénticos', () => {
    fixture.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      expect(textAt(workbook, 0, rowNumber, 1)).toBe(row.cuil);
      expect(textAt(workbook, 0, rowNumber, 2)).toBe(row.apellido);
      expect(textAt(workbook, 0, rowNumber, 3)).toBe(row.nombre);
      expect(textAt(workbook, 0, rowNumber, 4)).toBe(row.legajo);
      expect(textAt(workbook, 0, rowNumber, 11)).toBe(row.descripcion);
      expect(textAt(workbook, 0, rowNumber, 13)).toBe(row.legajoApellidoNombre);
    });
  });

  it('todas las celdas de texto llegan como `text`, nunca como número', () => {
    for (const column of [1, 2, 3, 4, 11, 13, 14]) {
      for (let rowNumber = 2; rowNumber <= 161; rowNumber += 1) {
        expect(cellAt(workbook, 0, rowNumber, column)?.kind).toBe('text');
      }
    }
  });

  it('conserva ceros a la izquierda del legajo y espacios finales', () => {
    const legajos = fixture.rows
      .map((row) => row.legajo)
      .filter((legajo) => legajo.startsWith('0'));
    expect(legajos).toHaveLength(50);
    const conEspacioFinal = fixture.rows.filter((row) => row.apellido.endsWith(' '));
    expect(conEspacioFinal.length).toBeGreaterThan(0);
    for (const row of conEspacioFinal) {
      const index = fixture.rows.indexOf(row);
      expect(textAt(workbook, 0, index + 2, 2)?.endsWith(' ')).toBe(true);
    }
  });

  it('el banco vacío (<is><t></t></is>) llega como celda ausente, igual que en el archivo real', () => {
    // Comportamiento observado también en T10. En F2, celda ausente equivale a texto vacío.
    expect(cellAt(workbook, 0, 17 + 2, 5)).toBeUndefined();
  });
});
