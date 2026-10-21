// «Requiere tu acción» (correctivo UX CP-F3-B): las incidencias que el motor marcó como
// resolubles y sin resolver, ANTES de la lista masiva de bloqueos. La UI no hardcodea
// BANCO_VACIO ni reglas: solo traduce lo que los contratos ya soportan (resoluble.por).
import type { IncidenciaConciliada, TipoDecision, FilaConciliada } from '../reconciliation';
import type { Destino } from '../domain/destino';
import { ETIQUETA_SECCION, etiquetaEstadoFila, etiquetaImporte } from './etiquetas';
import { textoIncidencia } from './proyeccion';

type Resolver = (incidencia: IncidenciaConciliada, tipo: TipoDecision, destino?: Destino) => void;

interface Props {
  readonly accionables: readonly IncidenciaConciliada[];
  /** Filas conciliadas para ubicar al empleado detrás de cada decisión (proyección). */
  readonly filas: readonly FilaConciliada[];
  readonly resolver: Resolver;
}

/** Empleado de la fila que originó la incidencia (solo presentación). */
function empleadoDe(
  incidencia: IncidenciaConciliada,
  filas: readonly FilaConciliada[],
): FilaConciliada | undefined {
  const filaOrigen = incidencia.refs.find((r) => r.fila !== undefined)?.fila;
  return filas.find((f) => f.linea.ref.fila === filaOrigen);
}

function AccionTarjeta({
  incidencia,
  filas,
  resolver,
}: {
  readonly incidencia: IncidenciaConciliada;
  readonly filas: readonly FilaConciliada[];
  readonly resolver: Resolver;
}) {
  const resoluble = incidencia.resoluble;
  if (resoluble === undefined) {
    return null;
  }
  const fila = empleadoDe(incidencia, filas);
  const neto = fila?.linea.neto;
  return (
    <li
      className="mt-2 rounded border border-amber-300 bg-amber-50 p-3"
      data-testid={`accion-${incidencia.id}`}
    >
      <p className="font-medium">
        {fila === undefined ? '(empleado no localizado)' : fila.linea.legajoApellidoNombre}
      </p>
      {fila !== undefined && <p className="text-sm">{etiquetaEstadoFila(fila.estado)}</p>}
      <p className="text-sm">{textoIncidencia(incidencia)}</p>
      {incidencia.valores !== undefined && (
        <p className="text-sm text-slate-600">
          Valores observados:{' '}
          {Object.entries(incidencia.valores)
            .map(([fuente, valor]) => `${fuente}: «${valor}»`)
            .join(' · ')}
        </p>
      )}
      {neto !== null && neto !== undefined && (
        <p className="text-sm text-slate-600">Neto: ${etiquetaImporte(neto)}</p>
      )}
      {resoluble.por === 'ASIGNAR_DESTINO' ? (
        <div className="mt-2 flex gap-2" data-testid="acciones-asignar">
          <button
            type="button"
            data-testid="asignar-bna"
            onClick={() => {
              resolver(incidencia, 'ASIGNAR_DESTINO', 'BNA_GT_HABERES');
            }}
            className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Asignar a Banco Nación
          </button>
          <button
            type="button"
            data-testid="asignar-patagonia"
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
          data-testid="confirmar-revision"
          onClick={() => {
            resolver(incidencia, 'CONFIRMAR_REVISION');
          }}
          className="mt-2 rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
        >
          Confirmar revisión (los datos son correctos)
        </button>
      )}
    </li>
  );
}

export function PanelAccion({ accionables, filas, resolver }: Props) {
  if (accionables.length === 0) {
    return (
      <section className="mt-6" data-testid="panel-accion">
        <h2 className="text-lg font-semibold">{ETIQUETA_SECCION.ACCION} — 0</h2>
        <p className="text-sm text-slate-600">Ahora no hay decisiones para vos.</p>
      </section>
    );
  }
  return (
    <section className="mt-6" aria-labelledby="accion-titulo" data-testid="panel-accion">
      <h2 id="accion-titulo" className="text-lg font-semibold">
        {ETIQUETA_SECCION.ACCION} — {String(accionables.length)}
      </h2>
      <ul className="list-none space-y-2 pl-0" data-testid="lista-acciones">
        {accionables.map((incidencia) => (
          <AccionTarjeta
            key={incidencia.id}
            incidencia={incidencia}
            filas={filas}
            resolver={resolver}
          />
        ))}
      </ul>
    </section>
  );
}
