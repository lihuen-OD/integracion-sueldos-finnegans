// «Requiere tu acción»: las incidencias que el motor marcó como resolubles y sin resolver,
// antes de la lista masiva de bloqueos. La UI no hardcodea reglas: solo traduce lo que los
// contratos ya soportan (resoluble.por).
import type { IncidenciaConciliada, TipoDecision, FilaConciliada } from '../reconciliation';
import type { Destino } from '../domain/destino';
import { ETIQUETA_SECCION, etiquetaEstadoFila, etiquetaImporte } from './etiquetas';
import { Boton, Insignia } from './componentes';
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
      className="rounded-xl border border-amber-300 bg-amber-50 p-4"
      data-testid={`accion-${incidencia.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-amber-950">
            {fila === undefined ? '(empleado no localizado)' : fila.linea.legajoApellidoNombre}
          </p>
          {fila !== undefined && (
            <p className="text-sm text-slate-700">{etiquetaEstadoFila(fila.estado)}</p>
          )}
        </div>
        <Insignia tono="atencion">Decisión requerida</Insignia>
      </div>
      <p className="mt-2 text-sm text-amber-950">{textoIncidencia(incidencia)}</p>
      {incidencia.valores !== undefined && (
        <p className="mt-1 text-sm text-slate-600">
          Valores observados:{' '}
          {Object.entries(incidencia.valores)
            .map(([fuente, valor]) => `${fuente}: «${valor}»`)
            .join(' · ')}
        </p>
      )}
      {neto !== null && neto !== undefined && (
        <p className="mt-1 text-sm text-slate-600">Neto: ${etiquetaImporte(neto)}</p>
      )}
      {resoluble.por === 'ASIGNAR_DESTINO' ? (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="acciones-asignar">
          <Boton
            variante="primario"
            data-testid="asignar-bna"
            onClick={() => {
              resolver(incidencia, 'ASIGNAR_DESTINO', 'BNA_GT_HABERES');
            }}
          >
            Asignar a Banco Nación
          </Boton>
          <Boton
            variante="primario"
            data-testid="asignar-patagonia"
            onClick={() => {
              resolver(incidencia, 'ASIGNAR_DESTINO', 'PATAGONIA_B2');
            }}
          >
            Asignar a Banco Patagonia
          </Boton>
        </div>
      ) : (
        <Boton
          variante="primario"
          className="mt-3"
          data-testid="confirmar-revision"
          onClick={() => {
            resolver(incidencia, 'CONFIRMAR_REVISION');
          }}
        >
          Confirmar revisión (los datos son correctos)
        </Boton>
      )}
    </li>
  );
}

export function PanelAccion({ accionables, filas, resolver }: Props) {
  if (accionables.length === 0) {
    return (
      <section aria-labelledby="accion-titulo" data-testid="panel-accion">
        <h3 id="accion-titulo" className="text-lg font-semibold text-marca-950">
          {ETIQUETA_SECCION.ACCION} — 0
        </h3>
        <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Ahora no hay decisiones para vos. Si cambian los archivos o los datos, volvé a validar.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="accion-titulo" data-testid="panel-accion">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 id="accion-titulo" className="text-lg font-semibold text-marca-950">
          {ETIQUETA_SECCION.ACCION} — {String(accionables.length)}
        </h3>
        <p className="text-sm text-slate-500">La validación queda pendiente hasta resolverlas.</p>
      </div>
      <ul className="mt-3 list-none space-y-3 pl-0" data-testid="lista-acciones">
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
