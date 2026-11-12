import { useState } from 'react';
import type { CantidadClasificadaPorDescripcion } from '../domain/clasificacion';
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { ErrorClasificacionCorrida } from './orquestacion';

interface ResumenDescripcion {
  readonly descripcionOriginal: string;
  readonly cantidadLineas: number;
  readonly periodo: string;
  readonly tipoLiquidacionNormalizado: string;
  readonly clasificada: boolean;
}

interface Borrador {
  readonly seleccionada: boolean;
  readonly periodo: string;
  readonly tipoLiquidacionNormalizado: string;
}

export type ResultadoAplicacionPanel =
  | {
      readonly ok: true;
      readonly cantidadesAfectadas: readonly CantidadClasificadaPorDescripcion[];
    }
  | { readonly ok: false; readonly errores: readonly ErrorClasificacionCorrida[] };

interface Props {
  readonly lectura: LecturaFinnegans;
  readonly aplicar: (selecciones: unknown) => ResultadoAplicacionPanel;
}

function resumir(lectura: LecturaFinnegans): readonly ResumenDescripcion[] {
  const resumen = new Map<string, ResumenDescripcion>();
  for (const linea of lectura.lineas) {
    const descripcion = linea.descripcion;
    const existente = resumen.get(descripcion.descripcionOriginal);
    if (existente !== undefined) {
      resumen.set(descripcion.descripcionOriginal, {
        ...existente,
        cantidadLineas: existente.cantidadLineas + 1,
      });
      continue;
    }
    const clasificada = descripcion.clasificacion.estado === 'CLASIFICADA';
    resumen.set(descripcion.descripcionOriginal, {
      descripcionOriginal: descripcion.descripcionOriginal,
      cantidadLineas: 1,
      clasificada,
      periodo: clasificada ? descripcion.clasificacion.periodo : '',
      tipoLiquidacionNormalizado: clasificada
        ? descripcion.clasificacion.tipoLiquidacionNormalizado
        : '',
    });
  }
  return [...resumen.values()];
}

function borradoresIniciales(
  resumen: readonly ResumenDescripcion[],
): ReadonlyMap<string, Borrador> {
  return new Map(
    resumen.map((item) => [
      item.descripcionOriginal,
      {
        seleccionada: item.clasificada,
        periodo: item.periodo,
        tipoLiquidacionNormalizado: item.tipoLiquidacionNormalizado,
      },
    ]),
  );
}

function textoError(error: ErrorClasificacionCorrida): string {
  switch (error.codigo) {
    case 'FINNEGANS_AUSENTE':
      return 'La liquidación de Finnegans ya no está cargada.';
    case 'ENTRADA_NO_ES_LISTA':
      return 'La selección recibida no tiene el formato esperado.';
    case 'SELECCION_NO_ES_OBJETO':
      return `La selección ${String(error.indiceSeleccion + 1)} no tiene el formato esperado.`;
    case 'TIPO_INVALIDO':
      return `La selección ${String(error.indiceSeleccion + 1)} contiene un valor inválido en ${error.campo}.`;
    case 'CAMPO_VACIO':
      return `La selección ${String(error.indiceSeleccion + 1)} requiere ${error.campo}.`;
    case 'SELECCION_DESCONOCIDA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no pertenece a esta corrida.`;
    case 'SELECCION_DUPLICADA':
      return 'La misma descripción fue seleccionada más de una vez.';
    case 'SELECCION_CONTRADICTORIA':
      return 'La misma descripción recibió clasificaciones contradictorias.';
  }
}

function cantidadDeLineas(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'línea' : 'líneas'}`;
}

export function PanelClasificacionLiquidaciones({ lectura, aplicar }: Props) {
  const resumen = resumir(lectura);
  const [borradores, setBorradores] = useState(() => borradoresIniciales(resumen));
  const [resultado, setResultado] = useState<ResultadoAplicacionPanel | null>(null);

  function actualizar(descripcion: string, cambio: Partial<Borrador>) {
    setBorradores((actuales) => {
      const siguiente = new Map(actuales);
      const actual = actuales.get(descripcion) ?? {
        seleccionada: false,
        periodo: '',
        tipoLiquidacionNormalizado: '',
      };
      siguiente.set(descripcion, { ...actual, ...cambio });
      return siguiente;
    });
    setResultado(null);
  }

  function confirmar() {
    const selecciones = resumen.flatMap((item) => {
      const borrador = borradores.get(item.descripcionOriginal);
      return borrador?.seleccionada === true
        ? [
            {
              descripcionOriginal: item.descripcionOriginal,
              periodo: borrador.periodo,
              tipoLiquidacionNormalizado: borrador.tipoLiquidacionNormalizado,
            },
          ]
        : [];
    });
    setResultado(aplicar(selecciones));
  }

  const totalClasificadas =
    resultado?.ok === true
      ? resultado.cantidadesAfectadas.reduce((total, item) => total + item.cantidadLineas, 0)
      : null;

  return (
    <section
      className="mt-6 rounded border border-slate-300 p-4"
      aria-labelledby="clasificacion-liquidaciones-titulo"
      data-testid="panel-clasificacion-liquidaciones"
    >
      <h3 id="clasificacion-liquidaciones-titulo" className="text-lg font-semibold">
        Clasificación interna de la corrida
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Elegí explícitamente qué descripciones clasificar. Período y clasificación interna son texto
        controlado por el operador: no se infieren categorías ni códigos bancarios.
      </p>
      <div className="mt-4 space-y-3">
        {resumen.map((item, indice) => {
          const borrador = borradores.get(item.descripcionOriginal);
          const seleccionada = borrador?.seleccionada === true;
          const id = `clasificacion-${String(indice)}`;
          return (
            <fieldset
              key={item.descripcionOriginal}
              className="rounded border border-slate-200 p-3"
              data-testid={`descripcion-liquidacion-${String(indice)}`}
            >
              <legend className="px-1 text-sm font-medium">
                <code className="whitespace-pre-wrap">{item.descripcionOriginal || '(vacía)'}</code>
                {` · ${String(item.cantidadLineas)} ${item.cantidadLineas === 1 ? 'línea' : 'líneas'}`}
              </legend>
              <label className="mt-1 flex items-center gap-2 text-sm" htmlFor={`${id}-activa`}>
                <input
                  id={`${id}-activa`}
                  type="checkbox"
                  checked={seleccionada}
                  onChange={(event) => {
                    actualizar(item.descripcionOriginal, { seleccionada: event.target.checked });
                  }}
                />
                Clasificar esta descripción
              </label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-sm" htmlFor={`${id}-periodo`}>
                  Período explícito
                  <input
                    id={`${id}-periodo`}
                    type="text"
                    value={borrador?.periodo ?? ''}
                    disabled={!seleccionada}
                    autoComplete="off"
                    onChange={(event) => {
                      actualizar(item.descripcionOriginal, { periodo: event.target.value });
                    }}
                    className="mt-1 block w-full rounded border border-slate-400 px-2 py-1 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm" htmlFor={`${id}-tipo`}>
                  Clasificación interna explícita
                  <input
                    id={`${id}-tipo`}
                    type="text"
                    value={borrador?.tipoLiquidacionNormalizado ?? ''}
                    disabled={!seleccionada}
                    autoComplete="off"
                    onChange={(event) => {
                      actualizar(item.descripcionOriginal, {
                        tipoLiquidacionNormalizado: event.target.value,
                      });
                    }}
                    className="mt-1 block w-full rounded border border-slate-400 px-2 py-1 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        onClick={confirmar}
        className="mt-4 rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-700"
      >
        Aplicar clasificación explícita
      </button>
      <div aria-live="polite" className="mt-3 text-sm">
        {resultado?.ok === false && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-red-700">
            {resultado.errores.map((error, indice) => (
              <li key={`${error.codigo}-${String(indice)}`}>{textoError(error)}</li>
            ))}
          </ul>
        )}
        {resultado?.ok === true && totalClasificadas !== null && (
          <div data-testid="resultado-clasificacion" className="text-emerald-800">
            <p>{`${cantidadDeLineas(totalClasificadas)} ${totalClasificadas === 1 ? 'clasificada' : 'clasificadas'}; ${cantidadDeLineas(lectura.lineas.length - totalClasificadas)} ${lectura.lineas.length - totalClasificadas === 1 ? 'permanece pendiente' : 'permanecen pendientes'}.`}</p>
            {resultado.cantidadesAfectadas.length > 0 && (
              <ul className="list-disc pl-5">
                {resultado.cantidadesAfectadas.map((item) => (
                  <li key={item.descripcionOriginal}>
                    <code className="whitespace-pre-wrap">{item.descripcionOriginal}</code>
                    {`: ${cantidadDeLineas(item.cantidadLineas)} ${item.cantidadLineas === 1 ? 'afectada' : 'afectadas'}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
