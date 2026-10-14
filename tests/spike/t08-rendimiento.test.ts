import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../../src/import/xlsx';
import { buildFinnegansLike } from '../fixtures/synthetic/finnegansLike.ts';
import { unwrap } from './helpers.ts';

async function measure(rows: number): Promise<number> {
  const { bytes } = buildFinnegansLike(rows);
  const start = performance.now();
  const workbook = unwrap(await readWorkbook(bytes));
  const elapsed = performance.now() - start;
  expect(workbook.sheets[0]?.rows).toHaveLength(rows + 1);
  return elapsed;
}

describe('T8 · rendimiento de lectura (equipo local)', () => {
  it('300 filas en menos de 1 s y 5.000 filas en menos de 5 s', async () => {
    await measure(10); // calentamiento del módulo
    const ms300 = await measure(300);
    const ms5000 = await measure(5000);
    process.stdout.write(
      `T8: 300 filas ${ms300.toFixed(0)} ms · 5.000 filas ${ms5000.toFixed(0)} ms\n`,
    );
    expect(ms300).toBeLessThan(1000);
    expect(ms5000).toBeLessThan(5000);
  });
});
