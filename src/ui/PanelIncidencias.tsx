// Incidencias (CP-F3-B): la AGRUPACIÓN es solo presentación (D-067, P-29.9 intacto); cada
// incidencia individual conserva identidad, alcance, refs y trazabilidad. La UI decide si
// la incidencia permite resolverla SOLO mirando lo que el motor F2 ya marcó (resoluble).
import { useMemo } from 'react';
import type { Destino } from '../domain/destino';
import { DESCRIPCION_CODIGO, type NivelIncidencia } from '../domain/incidencias';
import type { IncidenciaConciliada, TipoDecision } from '../reconciliation';
import { ESTILO_NIVEL, ETIQUETA_NIVEL, etiquetaAlcance, etiquetaDestino } from './etiquetas';

const NIVELES: readonly NivelIncidencia[] = ['BLOQUEANTE', 'REQUIERE_REVISION', 'INFORMACION'];

type Resolver = (incidencia: IncidenciaConciliada, tipo: TipoDecision, destino?: Destino) => void;

interface Props {
  readonly incidencias: readonly IncidenciaConciliada[];
  /** Registra la decisión elegida y vuelve a conciliar (orquesta App). */
  readonly resolver: Resolver;
}

function RefsIncidencia({ refs }: { refs: IncidenciaConciliada['refs'] }) {
  if (refs.length === 0) {
    return null;
  }
  return (
    <p className="text-xs text-slate-500" data-testid="refs-incidencia">
      Origen:{' '}
      {refs
        .map(
          (ref) =>
            `${ref.archivo === 'FINNEGANS' ? 'Liquidación' : 'Maestro'}${ref.fila === undefined ? '' : ` fila ${String(ref.fila)}`}${ref.columna === undefined ? '' : `, columna ${ref.columna}`}`,
        )
        .join(' · ')}
    </p>
  );
}

function AccionesResolubles({
  incidencia,
  resolver,
}: {
  incidencia: IncidenciaConciliada;
  resolver: Resolver;
}) {
  const resoluble = incidencia.resoluble;
  if (resoluble === undefined || incidencia.resolucion !== undefined) {
    return null;
  }
  if (resoluble.por === 'ASIGNAR_DESTINO') {
    return (
      <div className="mt-2 flex gap-2" data-testid="acciones-asignar">
        <button
          type="button"
          data-testid="asignar-bna"
          onClick={() => {
            resolver(incidencia, 'ASIGNAR_DESTINO', 'BNA_GT_HABERES');
          }}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Asignar a {etiquetaDestino('BNA_GT_HABERES')}
        </button>
        <button
          type="button"
          data-testid="asignar-patagonia"
          onClick={() => {
            resolver(incidencia, 'ASIGNAR_DESTINO', 'PATAGONIA_B2');
          }}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Asignar a {etiquetaDestino('PATAGONIA_B2')}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid="confirmar-revision"
      onClick={() => {
        resolver(incidencia, 'CONFIRMAR_REVISION');
      }}
      className="mt-2 rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
    >
      Confirmar revisión (los datos son correctos)
    </button>
  );
}

function ItemIncidencia({
  incidencia,
  resolver,
}: {
  incidencia: IncidenciaConciliada;
  resolver: Resolver;
}) {
  return (
    <li className="mt-2" data-testid={`incidencia-${incidencia.id}`}>
      <p className={ESTILO_NIVEL[incidencia.nivel]}>
        <strong>{ETIQUETA_NIVEL[incidencia.nivel]}</strong> ·{' '}
        {incidencia.resolucion === undefined ? '' : 'Resuelta por decisión del operador · '}
        {DESCRIPCION_CODIGO[incidencia.codigo]} — {incidencia.detalle} (
        {etiquetaAlcance(incidencia.alcance)})
      </p>
      <RefsIncidencia refs={incidencia.refs} />
      {incidencia.valores !== undefined && (
        <p className="text-xs text-slate-500">
          Valores observados:{' '}
          {Object.entries(incidencia.valores)
            .map(([fuente, valor]) => `${fuente}: «${valor}»`)
            .join(' · ')}
        </p>
      )}
      <AccionesResolubles incidencia={incidencia} resolver={resolver} />
    </li>
  );
}

export function PanelIncidencias({ incidencias, resolver }: Props) {
  const porNivel = useMemo(
    () =>
      new Map(
        NIVELES.map((nivel) => [nivel, incidencias.filter((i) => i.nivel === nivel)] as const),
      ),
    [incidencias],
  );
  return (
    <section className="mt-6" aria-labelledby="incidencias-titulo" data-testid="panel-incidencias">
      <h2 id="incidencias-titulo" className="text-lg font-semibold">
        Detalles que hay que mirar
      </h2>
      <p className="text-sm text-slate-600">
        Cada incidencia se lista con su origen exacto; el agrupado por gravedad es solo visual.
      </p>
      {NIVELES.map((nivel) => {
        const grupo = porNivel.get(nivel);
        if (grupo === undefined || grupo.length === 0) {
          return null;
        }
        return (
          <div key={nivel} data-testid={`grupo-${nivel}`} className="mt-3">
            <h3 className="font-medium">
              {ETIQUETA_NIVEL[nivel]} ({String(grupo.length)})
            </h3>
            <ul className="list-none space-y-2 pl-0">
              {grupo.map((incidencia) => (
                <ItemIncidencia key={incidencia.id} incidencia={incidencia} resolver={resolver} />
              ))}
            </ul>
          </div>
        );
      })}
      {incidencias.length === 0 && (
        <p data-testid="sin-incidencias" className="text-sm text-slate-600">
          No hay incidencias para mostrar.
        </p>
      )}
    </section>
  );
}
