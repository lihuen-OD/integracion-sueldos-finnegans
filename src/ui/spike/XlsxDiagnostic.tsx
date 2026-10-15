// Pantalla TEMPORAL del spike F1: lee un XLSX y muestra solo su estructura
// (hojas, filas, encabezados y tipos de celda). Nunca muestra valores de datos.
// Se reemplaza por el flujo real en F3.
import { useRef, useState, type ChangeEvent } from 'react';
import type { CellKind, ReadError, WorkbookDiagnostic } from '../../import/xlsx';
import { downloadBytes, XLSX_MIME_TYPE } from '../../export/download';
import { SPIKE_TEMPLATE } from './spikeTemplate';

type State =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'done'; readonly diagnostic: WorkbookDiagnostic; readonly ms: number }
  | { readonly status: 'error'; readonly message: string };

const KIND_LABELS: Record<CellKind, string> = {
  text: 'texto',
  number: 'número',
  boolean: 'booleano',
  date: 'fecha',
  formula: 'fórmula',
  error: 'error',
  merged: 'combinada',
  unsupported: 'no soportado',
};

function errorMessage(error: ReadError): string {
  switch (error.kind) {
    case 'FILE_TOO_LARGE':
      return 'El archivo supera el tamaño máximo permitido.';
    case 'NOT_A_ZIP':
    case 'NOT_XLSX':
    case 'CORRUPT_ZIP':
      return 'El archivo no es un XLSX válido.';
    case 'TOO_MANY_ENTRIES':
    case 'UNCOMPRESSED_TOO_LARGE':
      return 'El archivo es demasiado grande al descomprimirse.';
    case 'PARSE_FAILED':
      return 'No se pudo interpretar el contenido del XLSX.';
    case 'TOO_MANY_ROWS':
      return `La hoja "${error.sheet}" supera el máximo de ${String(error.limit)} filas.`;
    case 'TOO_MANY_COLUMNS':
      return `La hoja "${error.sheet}" supera el máximo de ${String(error.limit)} columnas.`;
  }
}

function kindsSummary(kinds: Readonly<Partial<Record<CellKind, number>>>): string {
  const parts = Object.entries(kinds).map(
    ([kind, count]) => `${KIND_LABELS[kind as CellKind]} ${String(count)}`,
  );
  return parts.length === 0 ? '—' : parts.join(' · ');
}

export function XlsxDiagnostic() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setState({ status: 'reading' });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Carga diferida: ExcelJS solo se descarga del servidor local cuando se usa.
      const xlsx = await import('../../import/xlsx');
      const start = performance.now();
      const result = await xlsx.readWorkbook(bytes);
      const ms = Math.round(performance.now() - start);
      setState(
        result.ok
          ? { status: 'done', diagnostic: xlsx.diagnoseWorkbook(result.value), ms }
          : { status: 'error', message: errorMessage(result.error) },
      );
    } catch {
      setState({ status: 'error', message: 'Error inesperado al leer el archivo.' });
    }
  }

  async function handleTemplate() {
    const xlsx = await import('../../import/xlsx');
    const bytes = await xlsx.writeWorkbook(SPIKE_TEMPLATE);
    downloadBytes(bytes, 'plantilla_prueba_spike_F1.xlsx', XLSX_MIME_TYPE);
  }

  function handleClear() {
    setState({ status: 'idle' });
    if (inputRef.current !== null) {
      inputRef.current.value = '';
    }
  }

  return (
    <section className="mt-6 space-y-4" aria-labelledby="diagnostico-titulo">
      <h2 id="diagnostico-titulo" className="text-lg font-semibold">
        Diagnóstico de archivo XLSX (spike F1)
      </h2>
      <p className="text-sm text-slate-700">
        Muestra solo la estructura del archivo: hojas, filas, encabezados y tipos de celda. No
        muestra valores ni guarda nada.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="archivo-xlsx" className="text-sm font-medium">
          Archivo XLSX
        </label>
        <input
          id="archivo-xlsx"
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          autoComplete="off"
          onChange={(event) => void handleFile(event)}
          className="text-sm"
        />
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => void handleTemplate()}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Descargar plantilla de prueba (T11)
        </button>
      </div>

      <div aria-live="polite">
        {state.status === 'reading' && <p className="text-sm">Leyendo…</p>}
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        )}
        {state.status === 'done' && (
          <div data-testid="diagnostico" className="space-y-4">
            <p className="text-sm">Lectura: {state.ms} ms</p>
            {state.diagnostic.sheets.map((sheet) => (
              <table key={sheet.name} className="w-full border-collapse text-sm">
                <caption className="text-left font-medium">
                  Hoja «{sheet.name}» ({sheet.state}) · Filas de datos: {sheet.dataRows} · Columnas:{' '}
                  {sheet.columns.length}
                </caption>
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th scope="col" className="py-1 pr-3">
                      Col.
                    </th>
                    <th scope="col" className="py-1 pr-3">
                      Encabezado (fila 1)
                    </th>
                    <th scope="col" className="py-1">
                      Tipos de celda (desde fila 2)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.columns.map((column) => (
                    <tr key={column.column} className="border-b border-slate-100">
                      <td className="py-1 pr-3">{column.column}</td>
                      <td className="py-1 pr-3">{column.header ?? '(sin encabezado)'}</td>
                      <td className="py-1">{kindsSummary(column.kinds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
