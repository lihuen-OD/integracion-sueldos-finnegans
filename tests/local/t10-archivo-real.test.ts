// T10 · Verificación LOCAL contra el Excel real de Finnegans (D-038).
// Solo se ejecuta si se define T10_FINNEGANS_PATH. Imprime y compara exclusivamente
// datos agregados (conteos, encabezados, tipos y categorías no personales).
// Nunca imprime ni compara CUIL, nombres, legajos ni importes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READ_LIMITS,
  diagnoseWorkbook,
  inspectZip,
  readWorkbook,
  type CellValue,
} from '../../src/import/xlsx';

const path = process.env['T10_FINNEGANS_PATH'];

const HEADERS_DOCUMENTADOS = [
  'Cuil',
  'Apellido',
  'Nombre',
  'Legajo',
  'Banco',
  'Remunerativo',
  'No remunerativo',
  'Descuento',
  'Contribucion',
  'Neto',
  'Descripcion',
  'Transaccionsubtipoid',
  'Legajoapellidonombre',
  'Centrodecosto',
];

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

describe.skipIf(path === undefined)('T10 · archivo real de Finnegans (solo agregados)', () => {
  it('coincide con la estructura documentada en docs/03 §A', async () => {
    const bytes = new Uint8Array(readFileSync(path ?? ''));
    const zip = inspectZip(bytes, DEFAULT_READ_LIMITS);
    const start = performance.now();
    const result = await readWorkbook(bytes);
    const elapsedMs = Math.round(performance.now() - start);
    if (!result.ok) {
      throw new Error(`Lectura fallida: ${result.error.kind}`);
    }
    const diagnostic = diagnoseWorkbook(result.value);
    const data = result.value.sheets[0]?.rows.slice(1) ?? [];
    const column = (n: number): (CellValue | undefined)[] =>
      data.map((row) => row.cells.find((cell) => cell.column === n)?.value);
    // Una celda de texto vacía (<is><t></t></is>) llega como celda ausente.
    const texts = (n: number): string[] =>
      column(n).map((value) =>
        value === undefined ? '(vacía)' : value.kind === 'text' ? value.text : '(no texto)',
      );
    const numberTexts = (n: number): string[] =>
      column(n).map((value) => (value?.kind === 'number' ? value.text : '(no número)'));
    const amounts = (n: number) => {
      const values = numberTexts(n);
      return {
        decimalEstricto: values.filter((text) => /^\d+(\.\d{1,2})?$/.test(text)).length,
        enteros: values.filter((text) => /^\d+$/.test(text)).length,
        ceros: values.filter((text) => text === '0').length,
        negativos: values.filter((text) => text.startsWith('-')).length,
        notacionCientifica: values.filter((text) => /e/i.test(text)).length,
      };
    };

    const resumen = {
      zip: zip.ok ? zip.value : zip.error.kind,
      lecturaMs: elapsedMs,
      hojas: diagnostic.sheets.map((sheet) => ({
        nombre: sheet.name,
        estado: sheet.state,
        filasDeDatos: sheet.dataRows,
        columnas: sheet.columns.length,
      })),
      encabezados: diagnostic.sheets[0]?.columns.map((entry) => entry.header),
      tiposPorColumna: Object.fromEntries(
        diagnostic.sheets[0]?.columns.map((entry) => [entry.header ?? '?', entry.kinds]) ?? [],
      ),
      cuilConFormato: texts(1).filter((text) => /^\d{2}-\d{8}-\d$/.test(text)).length,
      legajo: {
        tresDigitos: texts(4).filter((text) => /^\d{3}$/.test(text)).length,
        conCeroInicial: texts(4).filter((text) => text.startsWith('0')).length,
      },
      espaciosFinales: {
        apellido: texts(2).filter((text) => text.endsWith(' ')).length,
        nombre: texts(3).filter((text) => text.endsWith(' ')).length,
      },
      banco: countBy(texts(5)),
      descripcion: countBy(texts(11)),
      transaccionsubtipoid: countBy(numberTexts(12)),
      importes: {
        remunerativo: amounts(6),
        noRemunerativo: amounts(7),
        descuento: amounts(8),
        contribucion: amounts(9),
        neto: amounts(10),
      },
    };
    process.stdout.write(`T10 (solo agregados):\n${JSON.stringify(resumen, null, 2)}\n`);

    expect(zip.ok).toBe(true);
    expect(resumen.hojas).toEqual([
      { nombre: 'hoja1', estado: 'visible', filasDeDatos: 156, columnas: 14 },
    ]);
    expect(resumen.encabezados).toEqual(HEADERS_DOCUMENTADOS);
    expect(resumen.cuilConFormato).toBe(156);
    expect(resumen.legajo).toEqual({ tresDigitos: 156, conCeroInicial: 50 });
    expect(resumen.espaciosFinales).toEqual({ apellido: 9, nombre: 12 });
    expect(resumen.banco).toEqual({
      'BANCO DE LA NACION ARGENTINA': 116,
      'BANCO PATAGONIA S.A.': 39,
      '(vacía)': 1,
    });
    for (const summary of Object.values(resumen.importes)) {
      expect(summary.decimalEstricto).toBe(156);
      expect(summary.negativos).toBe(0);
      expect(summary.notacionCientifica).toBe(0);
    }
    expect(resumen.importes.neto.enteros).toBe(156);
    expect(resumen.importes.neto.ceros).toBe(1);
  });
});
