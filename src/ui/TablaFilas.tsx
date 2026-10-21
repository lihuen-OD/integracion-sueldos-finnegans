// Tabla de empleados (correctivo UX CP-F3-B): búsqueda por nombre/legajo, filtros que son
// proyecciones de los estados existentes del motor y páginas cortas (no 156 filas a la
// vez). Conserva el detalle individual de cada fila, que ahora también ofrece las mismas
// decisiones soportadas que el panel «Requiere tu acción» (misma orquestación).
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
import { textoIncidencia } from './proyeccion';
import type { CampoEditableMaestro } from '../domain/maestro';
import { EditorMaestro, type EstadoEdicion } from './EditorMaestro';

type Resolver = (incidencia: IncidenciaConciliada, tipo: TipoDecision, destino?: Destino) => void;

const FILTROS = [
  'TODOS',
  'ACCION',
  'BLOQUEANTES',
  'INFORMACION',
  'BNA',
  'PATAGONIA',
  'EXCLUIDOS',
  'PENDIENTES',
] as const;
type Filtro = (typeof FILTROS)[number];

const ETIQUETA_FILTRO: Readonly<Record<Filtro, string>> = {
  TODOS: 'Todos',
  ACCION: 'Requieren acción',
  BLOQUEANTES: 'Con bloqueos',
  INFORMACION: 'Informativos',
  BNA: 'Banco Nación',
  PATAGONIA: 'Banco Patagonia',
  EXCLUIDOS: 'Excluidos',
  PENDIENTES: 'Pendientes',
};

const POR_PAGINA = 20;

const accionPendiente = (fila: FilaConciliada) =>
  fila.incidencias.some((i) => i.resoluble !== undefined && i.resolucion === undefined);

function pasaFiltro(fila: FilaConciliada, filtro: Filtro): boolean {
  switch (filtro) {
    case 'TODOS':
      return true;
    case 'ACCION':
      return accionPendiente(fila);
    case 'BLOQUEANTES':
      return fila.nivel === 'BLOQUEANTE';
    case 'INFORMACION':
      return fila.nivel === 'INFORMACION';
    case 'BNA':
      return fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'BNA_GT_HABERES';
    case 'PATAGONIA':
      return fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'PATAGONIA_B2';
    case 'EXCLUIDOS':
      return fila.estado.estado === 'EXCLUIDA';
    case 'PENDIENTES':
      return fila.estado.estado === 'PENDIENTE';
  }
}

/** Busca por texto simple en legajo + nombre (búsqueda de utilidad de la pantalla). */
function coincideBusqueda(fila: FilaConciliada, texto: string): boolean {
  if (texto === '') {
    return true;
  }
  const objetivo = `${fila.linea.legajo ?? ''} ${fila.linea.legajoApellidoNombre}`;
  return objetivo.toLowerCase().includes(texto.toLowerCase());
}

interface TablaProps {
  readonly resultado: ResultadoConciliacion;
  readonly abrirFila: (indiceFila: number) => void;
  readonly resolver: Resolver;
}

export function TablaFilas({ resultado, abrirFila }: TablaProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [pagina, setPagina] = useState(0);

  const visibles = useMemo(
    () =>
      resultado.filas
        .map((fila, indice) => ({ fila, indice }))
        .filter(({ fila }) => pasaFiltro(fila, filtro) && coincideBusqueda(fila, busqueda)),
    [resultado, filtro, busqueda],
  );
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const rango = visibles.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  return (
    <section className="mt-6" aria-labelledby="filas-titulo" data-testid="tabla-empleados">
      <h2 id="filas-titulo" className="text-lg font-semibold">
        Empleados
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Buscar por nombre o legajo"
          placeholder="Buscar por nombre o legajo"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          data-testid="busqueda-empleados"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <div data-testid="filtros-empleados" className="flex flex-wrap gap-1">
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
              className={`rounded border px-2 py-1 text-sm ${
                filtro === op
                  ? 'border-slate-700 bg-slate-800 text-white'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {ETIQUETA_FILTRO[op]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm" data-testid="paginacion-empleados">
        {String(visibles.length)} empleados · página {String(paginaActual + 1)} de {String(paginas)}
        {paginas > 1 && (
          <>
            {' '}
            <button
              type="button"
              data-testid="pag-anterior"
              disabled={paginaActual === 0}
              onClick={() => {
                setPagina(Math.max(0, paginaActual - 1));
              }}
              className="rounded border border-slate-400 px-2 py-0.5 text-sm disabled:opacity-50"
            >
              ← Anterior
            </button>{' '}
            <button
              type="button"
              data-testid="pag-siguiente"
              disabled={paginaActual >= paginas - 1}
              onClick={() => {
                setPagina(Math.min(paginas - 1, paginaActual + 1));
              }}
              className="rounded border border-slate-400 px-2 py-0.5 text-sm disabled:opacity-50"
            >
              Siguiente →
            </button>
          </>
        )}
      </p>
      {rango.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600" data-testid="sin-empleados">
          Ningún empleado coincide con la búsqueda o el filtro elegido.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse text-sm" data-testid="filas">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th scope="col" className="py-1 pr-3">
                #
              </th>
              <th scope="col" className="py-1 pr-3">
                Empleado
              </th>
              <th scope="col" className="py-1 pr-3">
                Estado
              </th>
              <th scope="col" className="py-1">
                Gravedad
              </th>
            </tr>
          </thead>
          <tbody>
            {rango.map(({ fila, indice }) => (
              <tr key={indice} data-testid={`fila-${String(indice)}`}>
                <td className="py-1 pr-3">{(indice + 1).toString()}</td>
                <td className="py-1 pr-3">
                  <button
                    type="button"
                    data-testid={`ver-fila-${String(indice)}`}
                    onClick={() => {
                      abrirFila(indice);
                    }}
                    className="underline decoration-dotted"
                  >
                    {fila.linea.legajoApellidoNombre}
                  </button>
                </td>
                <td className="py-1 pr-3">{etiquetaEstadoFila(fila.estado)}</td>
                <td className={`py-1 ${ESTILO_NIVEL[fila.nivel]}`}>{ETIQUETA_NIVEL[fila.nivel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
    <div className="mt-3" data-testid="acciones-detalle-fila">
      <h3 className="text-sm font-semibold">Requiere tu acción</h3>
      {pendientes.map((incidencia) => {
        const resoluble = incidencia.resoluble;
        if (resoluble === undefined) {
          return null;
        }
        return (
          <div key={incidencia.id} className="mt-2">
            {resoluble.por === 'ASIGNAR_DESTINO' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="detalle-asignar-bna"
                  onClick={() => {
                    resolver(incidencia, 'ASIGNAR_DESTINO', 'BNA_GT_HABERES');
                  }}
                  className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
                >
                  Asignar a Banco Nación
                </button>
                <button
                  type="button"
                  data-testid="detalle-asignar-patagonia"
                  onClick={() => {
                    resolver(incidencia, 'ASIGNAR_DESTINO', 'PATAGONIA_B2');
                  }}
                  className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
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
                className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
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
  return (
    <section className="mt-6 rounded border border-slate-300 p-4" data-testid="detalle-fila">
      <button
        type="button"
        data-testid="cerrar-detalle"
        onClick={cerrar}
        className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
      >
        ← Volver a la tabla
      </button>
      <h3 className="mt-3 text-lg font-semibold">
        {fila.linea.legajoApellidoNombre || '(empleado sin nombre legible)'}
      </h3>
      <AccionesDetalle fila={fila} resolver={resolver} />
      {fila.registro !== null && (
        <EditorMaestro registro={fila.registro} guardar={guardarEdicion} estado={estadoEdicion} />
      )}
      <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2" data-testid="datos-fila">
        <dt className="font-medium">Estado</dt>
        <dd>{etiquetaEstadoFila(fila.estado)}</dd>
        <dt className="font-medium">Neto</dt>
        <dd>${etiquetaImporte(fila.linea.neto)}</dd>
        <dt className="font-medium">Remunerativo</dt>
        <dd>${etiquetaImporte(fila.linea.componentes.remunerativo)}</dd>
        <dt className="font-medium">No remunerativo</dt>
        <dd>${etiquetaImporte(fila.linea.componentes.noRemunerativo)}</dd>
        <dt className="font-medium">Descuento</dt>
        <dd>${etiquetaImporte(fila.linea.componentes.descuento)}</dd>
        <dt className="font-medium">Legajo</dt>
        <dd>{fila.linea.legajo ?? '(ilegible)'}</dd>
        <dt className="font-medium">CUIL texto</dt>
        <dd>{fila.linea.cuilTexto === '' ? '(vacío)' : fila.linea.cuilTexto}</dd>
        <dt className="font-medium">Banco en Finnegans</dt>
        <dd>
          {fila.linea.bancoFinnegans === null
            ? '(ilegible)'
            : fila.linea.bancoFinnegans === ''
              ? '(vacío)'
              : fila.linea.bancoFinnegans}
        </dd>
        <dt className="font-medium">Origen</dt>
        <dd>
          Hoja «{fila.linea.ref.hoja ?? '—'}», fila{' '}
          {fila.linea.ref.fila === undefined ? '—' : String(fila.linea.ref.fila)}
        </dd>
      </dl>
      {fila.incidencias.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="incidencias-fila">
          {fila.incidencias.map((incidencia) => (
            <li key={incidencia.id} data-testid="detalle-incidencia">
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
