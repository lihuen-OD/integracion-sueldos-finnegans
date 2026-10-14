import { describe, expect, it } from 'vitest';
import { DEFAULT_READ_LIMITS, readWorkbook } from '../../src/import/xlsx';
import { buildNumbersSheet } from '../fixtures/synthetic/edgeCases.ts';
import { buildFinnegansLike } from '../fixtures/synthetic/finnegansLike.ts';
import { createRandom } from '../fixtures/synthetic/identities.ts';
import { javaDoubleText } from '../fixtures/synthetic/xlsxBuilder.ts';
import { cellAt, decimalToCents, unwrap } from './helpers.ts';

function centsToDecimal(cents: bigint): string {
  return `${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`;
}

describe('T3 · importes: texto decimal exacto, sin pérdida ni redondeo', () => {
  it('importes del fixture Finnegans (incluye neto >= 10.000.000 en notación científica)', async () => {
    const fixture = buildFinnegansLike();
    const workbook = unwrap(await readWorkbook(fixture.bytes));
    fixture.rows.forEach((row, index) => {
      const amounts = [
        row.remunerativo,
        row.noRemunerativo,
        row.descuento,
        row.contribucion,
        row.neto,
      ];
      amounts.forEach((decimal, offset) => {
        const value = cellAt(workbook, 0, index + 2, 6 + offset);
        expect(value?.kind).toBe('number');
        const text = value?.kind === 'number' ? value.text : '';
        expect(decimalToCents(text)).toBe(decimalToCents(decimal));
      });
    });
  });

  it('100.000 importes aleatorios entre 0,01 y 999.999.999,99 en tres formas de escritura', async () => {
    const random = createRandom(7);
    const expected: bigint[] = [];
    const literals: string[] = [];
    for (let index = 0; index < 100_000; index += 1) {
      const cents = BigInt(1 + Math.floor(random() * 99_999_999_999));
      const decimal = centsToDecimal(cents);
      expected.push(cents);
      // Decimal con ceros finales, formato Java/POI, o notación científica explícita.
      const form = index % 3;
      literals.push(
        form === 0
          ? decimal
          : form === 1
            ? javaDoubleText(decimal)
            : Number(decimal).toExponential().toUpperCase(),
      );
    }
    // Supera el límite por defecto de filas (20.000): se amplía solo para esta prueba.
    const workbook = unwrap(
      await readWorkbook(buildNumbersSheet(literals), {
        ...DEFAULT_READ_LIMITS,
        maxRowsPerSheet: 200_000,
      }),
    );
    const rows = workbook.sheets[0]?.rows ?? [];
    expect(rows).toHaveLength(100_001);
    let mismatches = 0;
    rows.slice(1).forEach((row, index) => {
      const value = row.cells[0]?.value;
      const text = value?.kind === 'number' ? value.text : '';
      if (decimalToCents(text) !== expected[index]) {
        mismatches += 1;
      }
    });
    expect(mismatches).toBe(0);
  });

  it.each([
    ['0.01', '0.01'],
    ['0.1', '0.1'],
    ['0.3', '0.3'],
    ['0.07', '0.07'],
    ['4.35', '4.35'],
    ['1.15', '1.15'],
    ['2.675', '2.675'],
    ['1234567.0', '1234567'],
    ['1234567.8', '1234567.8'],
    ['1.0E7', '10000000'],
    ['1.000000001E7', '10000000.01'],
    ['9.999999999E7', '99999999.99'],
    ['9.9999999999E8', '999999999.99'],
    ['0.0', '0'],
  ])('literal XML %s → texto %s', async (literal, expected) => {
    const workbook = unwrap(await readWorkbook(buildNumbersSheet([literal])));
    const value = cellAt(workbook, 0, 2, 1);
    expect(value).toEqual({ kind: 'number', text: expected });
  });

  it('no redondea: 3 decimales se conservan y quedan para que el dominio los rechace', async () => {
    const workbook = unwrap(await readWorkbook(buildNumbersSheet(['1234.565'])));
    const value = cellAt(workbook, 0, 2, 1);
    expect(value).toEqual({ kind: 'number', text: '1234.565' });
    expect(decimalToCents('1234.565')).toBeNull();
  });

  it('un CBU guardado como número queda en notación científica y se rechaza', async () => {
    const workbook = unwrap(await readWorkbook(buildNumbersSheet(['1.1059923000045988E21'])));
    const value = cellAt(workbook, 0, 2, 1);
    expect(value?.kind).toBe('number');
    const text = value?.kind === 'number' ? value.text : '';
    expect(text).toMatch(/e\+21$/);
    expect(decimalToCents(text)).toBeNull();
  });
});
