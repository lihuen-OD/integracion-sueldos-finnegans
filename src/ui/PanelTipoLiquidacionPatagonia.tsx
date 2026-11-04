import { useState } from 'react';
import {
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  type AplicacionSeleccionesLiquidacionPatagonia,
  type LiquidacionPatagoniaPendiente,
} from '../run/seleccionLiquidacionPatagonia';
import type { ErrorSeleccionLiquidacionPatagoniaCorrida } from './orquestacion';

export type ResultadoSeleccionPatagoniaPanel =
  | { readonly ok: true; readonly value: AplicacionSeleccionesLiquidacionPatagonia }
  | { readonly ok: false; readonly error: readonly ErrorSeleccionLiquidacionPatagoniaCorrida[] };

interface Props {
  readonly huellaFinnegans: string;
  readonly descripciones: readonly LiquidacionPatagoniaPendiente[];
  readonly aplicar: (selecciones: unknown) => ResultadoSeleccionPatagoniaPanel;
}

function textoError(error: ErrorSeleccionLiquidacionPatagoniaCorrida): string {
  switch (error.codigo) {
    case 'FINNEGANS_AUSENTE':
      return 'La liquidación de Finnegans ya no está cargada.';
    case 'HUELLA_FINNEGANS_AUSENTE':
    case 'HUELLA_CORRIDA_INVALIDA':
      return 'No se puede vincular la selección con la importación vigente.';
    case 'ENTRADA_NO_ES_LISTA':
      return 'La selección recibida no tiene el formato esperado.';
    case 'SELECCION_NO_ES_OBJETO':
      return `La selección ${String(error.indiceSeleccion + 1)} no tiene el formato esperado.`;
    case 'TIPO_INVALIDO':
      return `La selección ${String(error.indiceSeleccion + 1)} contiene un valor inválido en ${error.campo}.`;
    case 'CAMPO_VACIO':
      return `La selección ${String(error.indiceSeleccion + 1)} requiere ${error.campo}.`;
    case 'DESTINO_INVALIDO':
    case 'DESTINO_NO_ADMITIDO':
      return `La selección ${String(error.indiceSeleccion + 1)} no corresponde a Banco Patagonia.`;
    case 'SELECCION_DESVINCULADA':
      return `La selección ${String(error.indiceSeleccion + 1)} pertenece a otra importación.`;
    case 'CODIGO_FUERA_CATALOGO':
      return `El código ${error.codigoTipoLiquidacion} no pertenece al catálogo provisional disponible.`;
    case 'SELECCION_DESCONOCIDA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no pertenece a esta importación.`;
    case 'DESCRIPCION_SIN_FILAS_PATAGONIA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no tiene filas de Banco Patagonia.`;
    case 'SELECCION_DUPLICADA':
      return 'La misma descripción de Banco Patagonia fue seleccionada más de una vez.';
    case 'SELECCION_CONTRADICTORIA':
      return 'La misma descripción de Banco Patagonia recibió conceptos distintos.';
  }
}

function cantidadFilas(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'fila Patagonia' : 'filas Patagonia'}`;
}

export function PanelTipoLiquidacionPatagonia({ huellaFinnegans, descripciones, aplicar }: Props) {
  const [codigos, setCodigos] = useState<ReadonlyMap<string, string>>(
    () => new Map(descripciones.map((item) => [item.descripcionOriginal, ''] as const)),
  );
  const [resultado, setResultado] = useState<ResultadoSeleccionPatagoniaPanel | null>(null);

  function cambiarCodigo(descripcionOriginal: string, codigoTipoLiquidacion: string) {
    setCodigos((actuales) => {
      const siguientes = new Map(actuales);
      siguientes.set(descripcionOriginal, codigoTipoLiquidacion);
      return siguientes;
    });
    setResultado(null);
  }

  function confirmar() {
    const selecciones = descripciones.flatMap((item) => {
      const codigoTipoLiquidacion = codigos.get(item.descripcionOriginal) ?? '';
      return codigoTipoLiquidacion === ''
        ? []
        : [
            {
              huellaFinnegans,
              descripcionOriginal: item.descripcionOriginal,
              destino: 'PATAGONIA_B2',
              codigoTipoLiquidacion,
            },
          ];
    });
    setResultado(aplicar(selecciones));
  }

  const totalAfectadas =
    resultado?.ok === true
      ? resultado.value.cantidadesAfectadas.reduce(
          (total, item) => total + item.cantidadFilasPatagonia,
          0,
        )
      : null;

  return (
    <section
      className="mt-6 rounded border border-slate-300 p-4"
      aria-labelledby="tipo-liquidacion-patagonia-titulo"
      data-testid="panel-tipo-liquidacion-patagonia"
    >
      <h2 id="tipo-liquidacion-patagonia-titulo" className="text-lg font-semibold">
        Tipo de liquidación — Banco Patagonia
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Elegí el concepto de pago que corresponde a cada descripción exacta de Finnegans. No se
        infiere desde Agrario, Comercio, Directivos ni ningún otro texto.
      </p>
      <p role="note" className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
        Catálogo PAT-DR documentado provisionalmente, todavía no confirmado ni homologado. Los
        códigos 006 y 007 conservan una discrepancia documental con PAT-XL. Esta selección no
        autoriza pagos.
      </p>
      <div className="mt-4 space-y-3">
        {descripciones.map((item, indice) => {
          const codigo = codigos.get(item.descripcionOriginal) ?? '';
          const id = `tipo-liquidacion-patagonia-${String(indice)}`;
          return (
            <fieldset
              key={item.descripcionOriginal}
              className="rounded border border-slate-200 p-3"
              data-testid={`descripcion-patagonia-${String(indice)}`}
            >
              <legend className="px-1 text-sm font-medium">
                <code className="whitespace-pre-wrap">{item.descripcionOriginal || '(vacía)'}</code>
                {` · ${cantidadFilas(item.cantidadFilasPatagonia)}`}
              </legend>
              <label className="mt-1 block text-sm" htmlFor={id}>
                Concepto bancario
                <select
                  id={id}
                  value={codigo}
                  onChange={(event) => {
                    cambiarCodigo(item.descripcionOriginal, event.target.value);
                  }}
                  className="mt-1 block w-full rounded border border-slate-400 px-2 py-1"
                >
                  <option value="">Sin seleccionar</option>
                  {CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.map((entrada) => (
                    <option key={entrada.codigo} value={entrada.codigo}>
                      {`${entrada.codigo} — ${entrada.concepto}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className={`mt-1 text-xs ${codigo === '' ? 'text-amber-800' : 'text-slate-600'}`}>
                {codigo === '' ? 'Pendiente de selección.' : 'Selección preparada para aplicar.'}
              </p>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        onClick={confirmar}
        className="mt-4 rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-700"
      >
        Aplicar tipos de liquidación Patagonia
      </button>
      <div aria-live="polite" className="mt-3 text-sm">
        {resultado?.ok === false && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-red-700">
            {resultado.error.map((error, indice) => (
              <li key={`${error.codigo}-${String(indice)}`}>{textoError(error)}</li>
            ))}
          </ul>
        )}
        {resultado?.ok === true && totalAfectadas !== null && (
          <div data-testid="resultado-tipo-liquidacion-patagonia" className="text-emerald-800">
            <p>
              {`${cantidadFilas(totalAfectadas)} con selección validada; ${cantidadFilas(
                resultado.value.pendientes.reduce(
                  (total, item) => total + item.cantidadFilasPatagonia,
                  0,
                ),
              )} ${
                resultado.value.pendientes.reduce(
                  (total, item) => total + item.cantidadFilasPatagonia,
                  0,
                ) === 1
                  ? 'pendiente'
                  : 'pendientes'
              }.`}
            </p>
            {resultado.value.seleccionesValidadas.length > 0 && (
              <ul className="list-disc pl-5">
                {resultado.value.seleccionesValidadas.map((seleccion, indice) => {
                  const cantidad = resultado.value.cantidadesAfectadas[indice];
                  return (
                    <li key={seleccion.descripcionOriginal}>
                      <code className="whitespace-pre-wrap">{seleccion.descripcionOriginal}</code>
                      {`: ${seleccion.codigoTipoLiquidacion} — ${seleccion.concepto}; ${cantidadFilas(
                        cantidad?.cantidadFilasPatagonia ?? 0,
                      )}`}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
