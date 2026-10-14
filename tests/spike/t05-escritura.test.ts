import { userInfo } from 'node:os';
import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { readWorkbook, writeWorkbook, type Workbook } from '../../src/import/xlsx';
import { SPIKE_TEMPLATE, SPIKE_TEMPLATE_ROWS } from '../../src/ui/spike/spikeTemplate';
import { textAt, unwrap } from './helpers.ts';

let bytes: Uint8Array;
let parts: Record<string, string>;
let reread: Workbook;

beforeAll(async () => {
  bytes = await writeWorkbook(SPIKE_TEMPLATE);
  parts = Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]),
  );
  reread = unwrap(await readWorkbook(bytes));
});

function sheetXml(index: number): string {
  return parts[`xl/worksheets/sheet${String(index)}.xml`] ?? '';
}

describe('T5 · escritura de la plantilla de prueba', () => {
  it('escribe 4 hojas con sus estados', () => {
    expect(reread.sheets.map((sheet) => [sheet.name, sheet.state])).toEqual(
      SPIKE_TEMPLATE.sheets.map((sheet) => [sheet.name, sheet.state ?? 'visible']),
    );
  });

  it('la relectura devuelve exactamente los textos escritos', () => {
    const [empleados] = SPIKE_TEMPLATE.sheets;
    empleados?.columns.forEach((column, index) => {
      expect(textAt(reread, 0, 1, index + 1)).toBe(column.header);
    });
    SPIKE_TEMPLATE_ROWS.forEach((values, rowIndex) => {
      values.forEach((value, columnIndex) => {
        if (value !== null) {
          expect(textAt(reread, 0, rowIndex + 2, columnIndex + 1)).toBe(value);
        }
      });
    });
  });

  it('valores que parecen fórmulas o números se escriben como texto', () => {
    const xml = Object.entries(parts)
      .filter(([name]) => name.startsWith('xl/worksheets/'))
      .map(([, content]) => content)
      .join('');
    expect(xml).not.toContain('<f>');
    const cells = reread.sheets[0]?.rows.flatMap((row) => row.cells) ?? [];
    expect(cells.every((cell) => cell.value.kind === 'text')).toBe(true);
  });

  it('las columnas de texto usan el formato Texto (@, numFmtId 49) en <col> y en las celdas', () => {
    const styles = parts['xl/styles.xml'] ?? '';
    const cellXfs = /<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)?.[1] ?? '';
    const xfs = [...cellXfs.matchAll(/<xf [^>]*>/g)].map((match) => match[0]);
    const textStyleIndexes = xfs
      .map((xf, index) => (xf.includes('numFmtId="49"') ? index : -1))
      .filter((index) => index >= 0);
    expect(textStyleIndexes.length).toBeGreaterThan(0);

    const xml = sheetXml(1);
    const colStyles = [...xml.matchAll(/<col [^>]*style="(\d+)"/g)].map((match) =>
      Number(match[1]),
    );
    expect(colStyles.length).toBe(5);
    expect(colStyles.every((style) => textStyleIndexes.includes(style))).toBe(true);
  });

  it('la columna PAT_TIPO_CUENTA tiene validación de lista "1,2" en las filas preparadas', () => {
    const xml = sheetXml(1);
    const validation =
      /<dataValidation [^>]*type="list"[^>]*sqref="([^"]+)"[^>]*>(.*?)<\/dataValidation>/s.exec(
        xml,
      );
    expect(validation?.[1]).toContain('E2');
    // En el XML las comillas de la lista van escapadas: "1,2" → &quot;1,2&quot;.
    expect(validation?.[2]).toContain('&quot;1,2&quot;');
  });

  it('las propiedades del documento no contienen el usuario del sistema', () => {
    const core = parts['docProps/core.xml'] ?? '';
    expect(core).toContain('Conversor de Haberes');
    expect(core).not.toContain(userInfo().username);
  });
});
