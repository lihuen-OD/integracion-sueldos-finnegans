// Escritor XLSX mínimo para fixtures. Escribe el XML a mano para reproducir con exactitud
// las particularidades de Finnegans (Apache POI): celdas inlineStr, números como texto
// literal en <v> y una <dimension> que puede ser incorrecta. Herramienta de test.
import { strToU8, zipSync, type Zippable } from 'fflate';

export type CellSpec =
  | { readonly kind: 'inlineStr'; readonly text: string }
  | { readonly kind: 'sharedStr'; readonly text: string }
  /** `xml` es el literal exacto que irá en <v> (p. ej. "1234567.0" o "1.2345678E7"). */
  | { readonly kind: 'number'; readonly xml: string }
  | { readonly kind: 'formula'; readonly formula: string; readonly cached: string };

export interface SheetSpec {
  readonly name: string;
  readonly state?: 'visible' | 'hidden';
  /** Fila i del arreglo = fila i+1 de Excel. Una fila vacía no se escribe. */
  readonly rows: readonly (readonly (CellSpec | null)[])[];
  /** Literal de <dimension ref>; por defecto se calcula el rango real. */
  readonly dimension?: string;
  readonly merges?: readonly string[];
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const FIXED_MTIME = new Date(2026, 0, 1, 0, 0, 0);

export const inlineStr = (text: string): CellSpec => ({ kind: 'inlineStr', text });
export const sharedStr = (text: string): CellSpec => ({ kind: 'sharedStr', text });
export const num = (xml: string): CellSpec => ({ kind: 'number', xml });
export const formula = (expression: string, cached: string): CellSpec => ({
  kind: 'formula',
  formula: expression,
  cached,
});

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Texto de un double como lo escribe Java `Double.toString` (usado por Apache POI):
 * decimal con al menos un dígito fraccionario en [1e-3, 1e7) y notación científica fuera.
 */
export function javaDoubleText(decimal: string): string {
  const value = Number(decimal);
  if (value === 0) {
    return '0.0';
  }
  if (value >= 1e-3 && value < 1e7) {
    const text = String(value);
    return text.includes('.') ? text : `${text}.0`;
  }
  const [mantissa = '0', exponent = '0'] = value.toExponential().split('e');
  return `${mantissa.includes('.') ? mantissa : `${mantissa}.0`}E${String(Number(exponent))}`;
}

function sheetXml(sheet: SheetSpec, sharedIndex: Map<string, number>): string {
  let maxColumn = 0;
  const rowsXml: string[] = [];
  sheet.rows.forEach((row, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, columnIndex) => {
      if (cell === null) {
        return;
      }
      maxColumn = Math.max(maxColumn, columnIndex + 1);
      const ref = `${columnLetter(columnIndex)}${String(rowIndex + 1)}`;
      switch (cell.kind) {
        case 'inlineStr':
          cells.push(`<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell.text)}</t></is></c>`);
          break;
        case 'sharedStr':
          cells.push(`<c r="${ref}" t="s"><v>${String(sharedIndex.get(cell.text))}</v></c>`);
          break;
        case 'number':
          cells.push(`<c r="${ref}"><v>${cell.xml}</v></c>`);
          break;
        case 'formula':
          cells.push(`<c r="${ref}"><f>${escapeXml(cell.formula)}</f><v>${cell.cached}</v></c>`);
          break;
      }
    });
    if (cells.length > 0) {
      rowsXml.push(`<row r="${String(rowIndex + 1)}">${cells.join('')}</row>`);
    }
  });
  const dimension =
    sheet.dimension ??
    `A1:${columnLetter(Math.max(maxColumn - 1, 0))}${String(Math.max(sheet.rows.length, 1))}`;
  const merges =
    sheet.merges === undefined || sheet.merges.length === 0
      ? ''
      : `<mergeCells count="${String(sheet.merges.length)}">${sheet.merges
          .map((range) => `<mergeCell ref="${range}"/>`)
          .join('')}</mergeCells>`;
  return (
    `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimension}"/>` +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15.0"/>' +
    `<sheetData>${rowsXml.join('')}</sheetData>${merges}</worksheet>`
  );
}

/** Construye un XLSX con la misma lista de partes que el archivo de Finnegans. */
export function buildXlsx(sheets: readonly SheetSpec[]): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (cell?.kind === 'sharedStr' && !sharedIndex.has(cell.text)) {
          sharedIndex.set(cell.text, shared.length);
          shared.push(cell.text);
        }
      }
    }
  }

  const sheetOverrides = sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${String(index + 1)}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  const files: Zippable = {
    '[Content_Types].xml': strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        sheetOverrides +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>',
    ),
    'docProps/app.xml': strToU8(
      `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fixture sintetico (estructura tipo Apache POI)</Application></Properties>`,
    ),
    'docProps/core.xml': strToU8(
      `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        '<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created><dc:creator>fixture-sintetico</dc:creator></cp:coreProperties>',
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><workbookPr date1904="false"/><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
        sheets
          .map(
            (sheet, index) =>
              `<sheet name="${escapeXml(sheet.name)}" r:id="rId${String(index + 3)}" sheetId="${String(index + 1)}"${
                sheet.state === 'hidden' ? ' state="hidden"' : ''
              }/>`,
          )
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        sheets
          .map(
            (_sheet, index) =>
              `<Relationship Id="rId${String(index + 3)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${String(index + 1)}.xml"/>`,
          )
          .join('') +
        '</Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      `${XML_HEADER}<sst xmlns="${NS_MAIN}" count="${String(shared.length)}" uniqueCount="${String(shared.length)}">` +
        shared.map((text) => `<si><t>${escapeXml(text)}</t></si>`).join('') +
        '</sst>',
    ),
    'xl/styles.xml': strToU8(
      `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}">` +
        '<numFmts count="2"><numFmt numFmtId="165" formatCode="d/m/yyyy"/><numFmt numFmtId="166" formatCode="d/m/yyyy hh:mm:ss"/></numFmts>' +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="true"/>' +
        '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="true"/></cellXfs>' +
        '</styleSheet>',
    ),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${String(index + 1)}.xml`] = strToU8(sheetXml(sheet, sharedIndex));
  });
  return zipSync(files, { level: 6, mtime: FIXED_MTIME });
}
