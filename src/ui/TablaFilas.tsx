// Tabla de empleados: búsqueda por nombre/legajo, filtros derivados de los estados ya
// calculados y páginas cortas (no cientos de filas a la vez). Conserva el detalle
// individual, que ofrece las mismas decisiones soportadas que el panel «Requiere tu acción».
import { useMemo, useState } from 'react';
import type { Destino } from '../domain/destino';
import type {
  FilaConciliada,
  IncidenciaConciliada,
  ResultadoConciliacion,
  TipoDecision,
} from '../reconciliation';
import {
  ESTILO_NIVEL,
  ETIQUETA_NIVEL,
  etiquetaAlcance,
  etiquetaEstadoFila,
  etiquetaImporte,
} from './etiquetas';
import { Insignia, Metrica } from './componentes';
import { textoIncidencia } from './proyeccion';
import type { CampoEditableMaestro } from '../domain/maestro';
import { EditorMaestro, type EstadoEdicion } from './EditorMaestro';
import {
  ETIQUETA_FILTRO,
  FILTROS,
  coincideBusqueda,
  estadoDatosBancarios,
  pasaFiltroEmpleado,
  resumirEmpleados,
  type FiltroEmpleados,
} from './resumenEmpleados';

type Resolver = (incidencia: IncidenciaConciliada, tipo: TipoDecision, destino?: Destino) => void;

const POR_PAGINA = 20;

interface TablaProps {
  readonly resultado: ResultadoConciliacion;
  readonly abrirFila: (indiceFila: number) => void;
  readonly resolver: Resolver;
}

export function TablaFilas({ resultado, abrirFila }: TablaProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEmpleados>('TODOS');
  const [pagina, setPagina] = useState(0);

  const resumen = useMemo(() => resumirEmpleados(resultado.filas), [resultado]);
  const visibles = useMemo(
    () =>
      resultado.filas
        .map((fila, indice) => ({ fila, indice }))
        .filter(({ fila }) => pasaFiltroEmpleado(fila, filtro) && coincideBusqueda(fila, busqueda)),
    [resultado, filtro, busqueda],
  );
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const rango = visibles.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  return (
    <section className="mt-6" aria-labelledby="filas-titulo" data-testid="tabla-empleados">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 id="filas-titulo" className="text-lg font-semibold text-marca-950">
          Empleados de la liquidación
        </h3>
        <p className="text-sm text-slate-500">
          {String(resumen.total)} filas · {String(resumen.conBloqueos)} con bloqueos
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica etiqueta="Total" valor={String(resumen.total)} />
        <Metrica etiqueta="Banco Nación" valor={String(resumen.bna)} tono="exito" />
        <Metrica etiqueta="Banco Patagonia" valor={String(resumen.patagonia)} tono="exito" />
        <Metrica etiqueta="Sin destino" valor={String(resumen.pendientes)} tono="atencion" />
        <Metrica etiqueta="Excluidos" valor={String(resumen.excluidos)} />
        <Metrica
          etiqueta="Requieren acción"
          valor={String(resumen.requierenAccion)}
          tono={resumen.requierenAccion > 0 ? 'atencion' : 'neutral'}
        />
        <Metrica
          etiqueta="Datos a revisar"
          valor={String(resumen.datosBancariosARevisar)}
          tono={resumen.datosBancariosARevisar > 0 ? 'peligro' : 'neutral'}
        />
        <Metrica
          etiqueta="Datos completos"
          valor={String(resumen.datosCompletos)}
          tono={resumen.datosCompletos > 0 ? 'exito' : 'neutral'}
        />
        <Metrica
          etiqueta="Nuevos / sin maestro"
          valor={String(resumen.sinMaestro)}
          tono={resumen.sinMaestro > 0 ? 'atencion' : 'neutral'}
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <label
              htmlFor="busqueda-empleados"
              className="block text-sm font-medium text-slate-700"
            >
              Buscar empleado
            </label>
            <input
              id="busqueda-empleados"
              type="search"
              aria-label="Buscar por nombre o legajo"
              placeholder="Nombre o legajo"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(0);
              }}
              data-testid="busqueda-empleados"
              className="mt-1 w-full min-w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca-500 focus:ring-2 focus:ring-marca-200 focus:outline-none"
            />
          </div>
          <div className="min-w-0">
            <p id="filtros-etiqueta" className="text-sm font-medium text-slate-700">
              Filtrar la lista
            </p>
            <div
              data-testid="filtros-empleados"
              role="group"
              aria-labelledby="filtros-etiqueta"
              className="mt-1 flex flex-wrap gap-1.5"
            >
              {FILTROS.map((op) => (
                <button
                  key={op}
                  type="button"
                  data-testid={`filtro-empleados-${op}`}
                  aria-pressed={filtro === op}
                  onClick={() => {
                    setFiltro(op);
                    setPagina(0);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    filtro === op
                      ? 'border-marca-900 bg-marca-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {ETIQUETA_FILTRO[op]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600" data-testid="paginacion-empleados">
            {String(visibles.length)} empleados · página {String(paginaActual + 1)} de{' '}
            {String(paginas)}
          </p>
          {paginas > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="pag-anterior"
                disabled={paginaActual === 0}
                onClick={() => {
                  setPagina(Math.max(0, paginaActual - 1));
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-50"
              >
                ← Anterior
              </button>
              <button
                type="button"
                data-testid="pag-siguiente"
                disabled={paginaActual >= paginas - 1}
                onClick={() => {
                  setPagina(Math.min(paginas - 1, paginaActual + 1));
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-50"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

        {rango.length === 0 ? (
          <p
            className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"
            data-testid="sin-empleados"
          >
            Ningún empleado coincide con la búsqueda o el filtro elegido.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm" data-testid="filas">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-600 uppercase">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Empleado
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Legajo
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Datos bancarios
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Gravedad
                  </th>
                </tr>
              </thead>
              <tbody>
                {rango.map(({ fila, indice }) => {
                  const datos = estadoDatosBancarios(fila);
                  return (
                    <tr
                      key={indice}
                      data-testid={`fila-${String(indice)}`}
                      className="border-b border-slate-100 align-top last:border-0 hover:bg-marca-50/60"
                    >
                      <td className="px-3 py-2 text-slate-500 tabular-nums">
                        {(indice + 1).toString()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          data-testid={`ver-fila-${String(indice)}`}
                          onClick={() => {
                            abrirFila(indice);
                          }}
                          className="text-left font-medium text-marca-800 underline decoration-marca-300 underline-offset-2 hover:text-marca-950"
                        >
                          {fila.linea.legajoApellidoNombre}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {fila.linea.legajo ?? '(ilegible)'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {etiquetaEstadoFila(fila.estado)}
                      </td>
                      <td className="px-3 py-2">
                        <Insignia tono={datos.tono}>{datos.texto}</Insignia>
                      </td>
                      <td className={`px-3 py-2 font-medium ${ESTILO_NIVEL[fila.nivel]}`}>
                        {ETIQUETA_NIVEL[fila.nivel]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

interface DetalleProps {
  readonly fila: FilaConciliada;
  readonly cerrar: () => void;
  readonly resolver: Resolver;
  readonly guardarEdicion: (campo: CampoEditableMaestro, texto: string) => void;
  readonly estadoEdicion: EstadoEdicion | null;
}

/** Mismas decisiones que PanelAccion, adentro del detalle del empleado (misma orquestación). */
function AccionesDetalle({
  fila,
  resolver,
}: {
  readonly fila: FilaConciliada;
  readonly resolver: Resolver;
}) {
  const pendientes = fila.incidencias.filter(
    (i) => i.resoluble !== undefined && i.resolucion === undefined,
  );
  if (pendientes.length === 0) {
    return null;
  }
  return (
    <div
      className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3"
      data-testid="acciones-detalle-fila"
    >
      <h3 className="text-sm font-semibold text-amber-950">Requiere tu acción</h3>
      {pendientes.map((incidencia) => {
        const resoluble = incidencia.resoluble;
        if (resoluble === undefined) {
          return null;
        }
        return (
          <div key={incidencia.id} className="mt-2">
            <p className="text-sm text-amber-950">{textoIncidencia(incidencia)}</p>
            {resoluble.por === 'ASIGNAR_DESTINO' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="detalle-asignar-bna"
                  onClick={() => {
                    resolver(incidencia, 'ASIGNAR_DESTINO', 'BNA_GT_HABERES');
                  }}
                  className="rounded-lg bg-marca-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800"
                >
                  Asignar a Banco Nación
                </button>
                <button
                  type="button"
                  data-testid="detalle-asignar-patagonia"
                  onClick={() => {
                    resolver(incidencia, 'ASIGNAR_DESTINO', 'PATAGONIA_B2');
                  }}
                  className="rounded-lg bg-marca-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800"
                >
                  Asignar a Banco Patagonia
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="detalle-confirmar-revision"
                onClick={() => {
                  resolver(incidencia, 'CONFIRMAR_REVISION');
                }}
                className="mt-2 rounded-lg bg-marca-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800"
              >
                Confirmar revisión (los datos son correctos)
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DetalleFila({
  fila,
  cerrar,
  resolver,
  guardarEdicion,
  estadoEdicion,
}: DetalleProps) {
  const datos = estadoDatosBancarios(fila);
  return (
    <section
      className="mt-6 rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:p-6"
      aria-labelledby="detalle-titulo"
      data-testid="detalle-fila"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid="cerrar-detalle"
          onClick={cerrar}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          ← Volver a la tabla
        </button>
        <Insignia tono={datos.tono}>Datos bancarios: {datos.texto}</Insignia>
      </div>
      <h3 id="detalle-titulo" className="mt-3 text-xl font-semibold text-marca-950">
        {fila.linea.legajoApellidoNombre || '(empleado sin nombre legible)'}
      </h3>
      <AccionesDetalle fila={fila} resolver={resolver} />
      {fila.registro !== null && (
        <EditorMaestro registro={fila.registro} guardar={guardarEdicion} estado={estadoEdicion} />
      )}
      <dl
        className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2"
        data-testid="datos-fila"
      >
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Estado</dt>
          <dd className="mt-0.5">{etiquetaEstadoFila(fila.estado)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Neto</dt>
          <dd className="mt-0.5 tabular-nums">${etiquetaImporte(fila.linea.neto)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Remunerativo
          </dt>
          <dd className="mt-0.5 tabular-nums">
            ${etiquetaImporte(fila.linea.componentes.remunerativo)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            No remunerativo
          </dt>
          <dd className="mt-0.5 tabular-nums">
            ${etiquetaImporte(fila.linea.componentes.noRemunerativo)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Descuento
          </dt>
          <dd className="mt-0.5 tabular-nums">
            ${etiquetaImporte(fila.linea.componentes.descuento)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Legajo</dt>
          <dd className="mt-0.5">{fila.linea.legajo ?? '(ilegible)'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            CUIL texto
          </dt>
          <dd className="mt-0.5">
            {fila.linea.cuilTexto === '' ? '(vacío)' : fila.linea.cuilTexto}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Banco en Finnegans
          </dt>
          <dd className="mt-0.5">
            {fila.linea.bancoFinnegans === null
              ? '(ilegible)'
              : fila.linea.bancoFinnegans === ''
                ? '(vacío)'
                : fila.linea.bancoFinnegans}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Origen</dt>
          <dd className="mt-0.5">
            Hoja «{fila.linea.ref.hoja ?? '—'}», fila{' '}
            {fila.linea.ref.fila === undefined ? '—' : String(fila.linea.ref.fila)}
          </dd>
        </div>
      </dl>
      {fila.incidencias.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="incidencias-fila">
          {fila.incidencias.map((incidencia) => (
            <li
              key={incidencia.id}
              data-testid="detalle-incidencia"
              className="rounded-lg border border-slate-200 p-2.5"
            >
              <p className={ESTILO_NIVEL[incidencia.nivel]}>
                <strong>{ETIQUETA_NIVEL[incidencia.nivel]}</strong> ·{' '}
                {incidencia.resolucion !== undefined ? 'Resuelta por decisión del operador · ' : ''}
                {textoIncidencia(incidencia)} ({etiquetaAlcance(incidencia.alcance)})
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
