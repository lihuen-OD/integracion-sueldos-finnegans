import { useState } from 'react';
import {
  CATALOGO_IDENTIFICADORES_HABERES_BNA,
  type AplicacionSeleccionesIdentificadorHaberesBna,
  type LiquidacionBnaPendiente,
} from '../run/seleccionIdentificadorHaberesBna';
import type { ErrorSeleccionIdentificadorHaberesBnaCorrida } from './orquestacion';

export type ResultadoSeleccionIdentificadorHaberesBnaPanel =
  | { readonly ok: true; readonly value: AplicacionSeleccionesIdentificadorHaberesBna }
  | {
      readonly ok: false;
      readonly error: readonly ErrorSeleccionIdentificadorHaberesBnaCorrida[];
    };

interface Props {
  readonly huellaFinnegans: string;
  readonly descripciones: readonly LiquidacionBnaPendiente[];
  readonly aplicar: (selecciones: unknown) => ResultadoSeleccionIdentificadorHaberesBnaPanel;
  /** El borrador dejó de representar el último snapshot BNA validado. */
  readonly invalidar: () => void;
}

function textoError(error: ErrorSeleccionIdentificadorHaberesBnaCorrida): string {
  switch (error.codigo) {
    case 'FINNEGANS_AUSENTE':
      return 'La liquidación de Finnegans ya no está cargada.';
    case 'HUELLA_FINNEGANS_AUSENTE':
    case 'HUELLA_CORRIDA_INVALIDA':
      return 'No se puede vincular la selección BNA con la importación vigente.';
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
      return `La selección ${String(error.indiceSeleccion + 1)} no corresponde a Banco Nación.`;
    case 'SELECCION_DESVINCULADA':
      return `La selección ${String(error.indiceSeleccion + 1)} pertenece a otra importación.`;
    case 'CODIGO_FUERA_CATALOGO':
      return `El código ${error.codigoIdentificadorHaberes} no pertenece al catálogo BNA disponible.`;
    case 'SELECCION_DESCONOCIDA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no pertenece a esta importación.`;
    case 'DESCRIPCION_SIN_FILAS_BNA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no tiene filas de Banco Nación.`;
    case 'SELECCION_DUPLICADA':
      return 'La misma descripción de Banco Nación fue seleccionada más de una vez.';
    case 'SELECCION_CONTRADICTORIA':
      return 'La misma descripción de Banco Nación recibió identificadores distintos.';
    case 'REFERENCIA_DUPLICADA_CORRIDA':
      return 'La corrida contiene referencias BNA duplicadas y no se puede aplicar la selección.';
  }
}

function cantidadFilas(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'empleado BNA' : 'empleados BNA'}`;
}

export function PanelIdentificadorHaberesBna({
  huellaFinnegans,
  descripciones,
  aplicar,
  invalidar,
}: Props) {
  const [codigos, setCodigos] = useState<ReadonlyMap<string, string>>(
    () => new Map(descripciones.map((item) => [item.descripcionOriginal, ''] as const)),
  );
  const [resultado, setResultado] = useState<ResultadoSeleccionIdentificadorHaberesBnaPanel | null>(
    null,
  );

  function cambiarCodigo(descripcionOriginal: string, codigoIdentificadorHaberes: string) {
    invalidar();
    setCodigos((actuales) => {
      const siguientes = new Map(actuales);
      siguientes.set(descripcionOriginal, codigoIdentificadorHaberes);
      return siguientes;
    });
    setResultado(null);
  }

  function confirmar() {
    const selecciones = descripciones.flatMap((item) => {
      const codigoIdentificadorHaberes = codigos.get(item.descripcionOriginal) ?? '';
      return codigoIdentificadorHaberes === ''
        ? []
        : [
            {
              huellaFinnegans,
              descripcionOriginal: item.descripcionOriginal,
              destino: 'BNA_GT_HABERES',
              codigoIdentificadorHaberes,
            },
          ];
    });
    setResultado(aplicar(selecciones));
  }

  const totalAfectadas =
    resultado?.ok === true
      ? resultado.value.cantidadesAfectadas.reduce(
          (total, item) => total + item.cantidadFilasBna,
          0,
        )
      : null;
  const totalPendientes =
    resultado?.ok === true
      ? resultado.value.pendientes.reduce((total, item) => total + item.cantidadFilasBna, 0)
      : null;

  return (
    <section
      className="mt-6 rounded border border-slate-300 p-4"
      aria-labelledby="identificador-haberes-bna-titulo"
      data-testid="panel-identificador-haberes-bna"
    >
      <h3 id="identificador-haberes-bna-titulo" className="text-lg font-semibold">
        Identificador de haberes — Banco Nación
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Recursos Humanos debe elegir un código para cada descripción exacta de Finnegans. La
        elección se aplica a todos los empleados BNA que compartan exactamente esa descripción.
      </p>
      <p role="note" className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
        No hay códigos preseleccionados ni inferencias por palabras. Si una misma descripción
        requiere tratamientos distintos entre empleados, dejala sin seleccionar hasta contar con una
        diferenciación segura. Esta decisión no habilita pagos ni producción BNA.
      </p>
      <div className="mt-4 space-y-3">
        {descripciones.map((item, indice) => {
          const codigo = codigos.get(item.descripcionOriginal) ?? '';
          const catalogo = CATALOGO_IDENTIFICADORES_HABERES_BNA.find(
            (entrada) => entrada.codigo === codigo,
          );
          const id = `identificador-haberes-bna-${String(indice)}`;
          return (
            <fieldset
              key={item.descripcionOriginal}
              className="rounded border border-slate-200 p-3"
              data-testid={`descripcion-bna-${String(indice)}`}
            >
              <legend className="px-1 text-sm font-medium">
                <code className="whitespace-pre-wrap">{item.descripcionOriginal || '(vacía)'}</code>
                {` · ${cantidadFilas(item.cantidadFilasBna)}`}
              </legend>
              <label className="mt-1 block text-sm" htmlFor={id}>
                Identificador de haberes
                <select
                  id={id}
                  value={codigo}
                  onChange={(event) => {
                    cambiarCodigo(item.descripcionOriginal, event.target.value);
                  }}
                  className="mt-1 block w-full rounded border border-slate-400 px-2 py-1"
                >
                  <option value="">Sin seleccionar</option>
                  {CATALOGO_IDENTIFICADORES_HABERES_BNA.map((entrada) => (
                    <option key={entrada.codigo} value={entrada.codigo}>
                      {`${entrada.codigo} — ${entrada.descripcion}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className={`mt-1 text-xs ${codigo === '' ? 'text-amber-800' : 'text-slate-600'}`}>
                {catalogo === undefined ? 'Pendiente de selección.' : catalogo.consecuencia}
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
        Aplicar identificadores de haberes BNA
      </button>
      <div aria-live="polite" className="mt-3 text-sm">
        {resultado?.ok === false && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-red-700">
            {resultado.error.map((error, indice) => (
              <li key={`${error.codigo}-${String(indice)}`}>{textoError(error)}</li>
            ))}
          </ul>
        )}
        {resultado?.ok === true && totalAfectadas !== null && totalPendientes !== null && (
          <div data-testid="resultado-identificador-haberes-bna" className="text-emerald-800">
            <p>
              {`${cantidadFilas(totalAfectadas)} con selección validada; ${cantidadFilas(
                totalPendientes,
              )} ${totalPendientes === 1 ? 'pendiente' : 'pendientes'}.`}
            </p>
            {resultado.value.seleccionesValidadas.length > 0 && (
              <ul className="list-disc pl-5">
                {resultado.value.seleccionesValidadas.map((seleccion, indice) => {
                  const cantidad = resultado.value.cantidadesAfectadas[indice];
                  return (
                    <li key={seleccion.descripcionOriginal}>
                      <code className="whitespace-pre-wrap">{seleccion.descripcionOriginal}</code>
                      {`: ${seleccion.codigoIdentificadorHaberes} — ${seleccion.descripcionCodigo}; ${cantidadFilas(
                        cantidad?.cantidadFilasBna ?? 0,
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
