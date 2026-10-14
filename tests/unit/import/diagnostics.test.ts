import { describe, expect, it } from 'vitest';
import { diagnoseWorkbook, readWorkbook } from '../../../src/import/xlsx';
import { buildFinnegansLike, FINNEGANS_HEADERS } from '../../fixtures/synthetic/finnegansLike.ts';
import { unwrap } from '../../spike/helpers.ts';

describe('diagnoseWorkbook', () => {
  it('resume la estructura de Finnegans sin exponer valores', async () => {
    const fixture = buildFinnegansLike();
    const diagnostic = diagnoseWorkbook(unwrap(await readWorkbook(fixture.bytes)));
    const [sheet] = diagnostic.sheets;

    expect(sheet?.dataRows).toBe(160);
    expect(sheet?.columns.map((column) => column.header)).toEqual([...FINNEGANS_HEADERS]);
    expect(sheet?.columns[0]?.kinds).toEqual({ text: 160 });
    expect(sheet?.columns[9]?.kinds).toEqual({ number: 160 });

    const serialized = JSON.stringify(diagnostic);
    for (const row of fixture.rows) {
      expect(serialized).not.toContain(row.cuil);
      expect(serialized).not.toContain(row.legajoApellidoNombre);
    }
  });
});
