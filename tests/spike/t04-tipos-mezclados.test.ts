import { beforeAll, describe, expect, it } from 'vitest';
import { diagnoseWorkbook, readWorkbook, type Workbook } from '../../src/import/xlsx';
import { buildMaestroTiposMezclados } from '../fixtures/synthetic/edgeCases.ts';
import { cellAt, unwrap } from './helpers.ts';

let workbook: Workbook;

beforeAll(async () => {
  workbook = unwrap(await readWorkbook(buildMaestroTiposMezclados()));
});

describe('T4 · detección de tipos en un maestro editado a mano', () => {
  it('reporta la hoja oculta con su estado', () => {
    expect(workbook.sheets.map((sheet) => [sheet.name, sheet.state])).toEqual([
      ['Empleados', 'visible'],
      ['Oculta', 'hidden'],
    ]);
  });

  it('legajo y CBU numéricos llegan como `number` (detectables para bloquear en F2)', () => {
    expect(cellAt(workbook, 0, 2, 2)).toEqual({ kind: 'number', text: '7' });
    const cbu = cellAt(workbook, 0, 2, 3);
    expect(cbu?.kind).toBe('number');
  });

  it('la fórmula se detecta sin evaluarla ni exponer su resultado', () => {
    expect(cellAt(workbook, 0, 2, 4)).toEqual({ kind: 'formula' });
  });

  it('texto compartido (sharedStrings) conserva los ceros a la izquierda', () => {
    expect(cellAt(workbook, 0, 4, 2)).toEqual({ kind: 'text', text: '007' });
  });

  it('celdas combinadas: la secundaria se marca como `merged`', () => {
    expect(cellAt(workbook, 0, 4, 5)).toEqual({ kind: 'text', text: 'combinada' });
    expect(cellAt(workbook, 0, 4, 6)).toEqual({ kind: 'merged' });
  });

  it('omite filas vacías y conserva la numeración real de filas', () => {
    expect(workbook.sheets[0]?.rows.map((row) => row.rowNumber)).toEqual([1, 2, 4]);
  });

  it('el diagnóstico informa columnas sin encabezado y no expone valores', () => {
    const diagnostic = diagnoseWorkbook(workbook);
    const empleados = diagnostic.sheets[0];
    expect(empleados?.dataRows).toBe(2);
    expect(empleados?.columns.find((column) => column.column === 6)?.header).toBeNull();
    expect(empleados?.columns.find((column) => column.column === 7)?.header).toBe('EXTRA');
    expect(JSON.stringify(diagnostic)).not.toContain('combinada');
  });
});
