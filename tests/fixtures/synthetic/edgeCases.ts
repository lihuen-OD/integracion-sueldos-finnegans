// Fixtures de casos límite: tipos mezclados (T4), números (T3) y archivos inválidos (T9).
import { strToU8, zipSync } from 'fflate';
import { syntheticCuil } from './identities.ts';
import { buildXlsx, formula, inlineStr, num, sharedStr, type CellSpec } from './xlsxBuilder.ts';

/**
 * Maestro con problemas típicos de una planilla editada a mano:
 * legajo y CBU guardados como número, fórmula, fila vacía, celdas combinadas,
 * columna extra, texto compartido (sharedStrings) y una hoja oculta.
 */
export function buildMaestroTiposMezclados(): Uint8Array {
  // Sin literales con forma de CUIL en el código: si no se puede generar, el fixture falla.
  const cuil = syntheticCuil('20', 10_001);
  if (cuil === null) {
    throw new Error('No se pudo generar el CUIL sintético del fixture');
  }
  return buildXlsx([
    {
      name: 'Empleados',
      rows: [
        ['CUIL', 'LEGAJO', 'CBU', 'CONTROL', 'COMBINADA', null, 'EXTRA'].map((header) =>
          header === null ? null : inlineStr(header),
        ),
        [
          inlineStr(cuil),
          num('7'),
          num('1.1059923000045988E21'),
          formula('1+1', '2'),
          null,
          null,
          inlineStr('x'),
        ],
        [],
        [inlineStr(cuil), sharedStr('007'), null, null, inlineStr('combinada'), null, null],
      ],
      merges: ['E4:F4'],
    },
    { name: 'Oculta', state: 'hidden', rows: [[inlineStr('hoja oculta')]] },
  ]);
}

/** Hoja de una columna con importes escritos con el literal XML indicado. */
export function buildNumbersSheet(xmlLiterals: readonly string[]): Uint8Array {
  const rows: CellSpec[][] = [[inlineStr('Importe')], ...xmlLiterals.map((xml) => [num(xml)])];
  return buildXlsx([{ name: 'hoja1', rows, dimension: 'A1' }]);
}

export function notAZip(): Uint8Array {
  return new TextEncoder().encode('Esto no es un XLSX.');
}

export function zipWithoutWorkbook(): Uint8Array {
  return zipSync({ 'hola.txt': strToU8('sin libro') });
}

/** XLSX con una hoja que se expande a `bytes` bytes al descomprimirse. */
export function inflatedXlsx(bytes: number): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8('<workbook/>'),
    'xl/worksheets/sheet1.xml': new Uint8Array(bytes).fill(0x20),
  });
}

/** Zip con las partes de un XLSX pero con el XML del libro truncado. */
export function malformedXlsx(): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    ),
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="hoja1" sheetId="1"'),
  });
}
