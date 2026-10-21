// Estado por banco (correctivo UX CP-F3-B): dos tarjetas SIMÉTRICAS y compactas. Nada de
// este componente decide si un banco puede generar: muestra lo que calculó el motor con los
// contratos vigentes (en este flujo ningún banco llega a «Listo para generar»).
import type { BnaReadiness, PatagoniaReadiness } from '../reconciliation';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO_READINESS,
  ETIQUETA_MOTIVO_READINESS,
  etiquetaImporte,
} from './etiquetas';

type Readiness = BnaReadiness | PatagoniaReadiness;

interface Props {
  readonly bna: BnaReadiness;
  readonly patagonia: PatagoniaReadiness;
}

function TarjetaBanco({ readiness }: { readiness: Readiness }) {
  return (
    <div
      className="rounded border border-slate-300 p-4"
      data-testid={`readiness-${readiness.destino}`}
    >
      <h3 className="font-medium">{ETIQUETA_DESTINO[readiness.destino]}</h3>
      <p className="mt-2 font-semibold" data-testid={`estado-${readiness.destino}`}>
        {ETIQUETA_ESTADO_READINESS[readiness.estado]}
      </p>
      <p className="text-sm">
        Filas asignadas: {String(readiness.asignadas.cantidad)} · importe $
        {etiquetaImporte(readiness.asignadas.importe)}
      </p>
      {(readiness.bloqueantes > 0 || readiness.revisionesSinResolver > 0) && (
        <p className="text-sm" data-testid={`pendientes-${readiness.destino}`}>
          Bloqueos: {String(readiness.bloqueantes)} · Revisiones sin resolver:{' '}
          {String(readiness.revisionesSinResolver)}
        </p>
      )}
      {readiness.motivos.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          {readiness.motivos.map((motivo) => (
            <li key={motivo}>{ETIQUETA_MOTIVO_READINESS[motivo]}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-red-700" data-testid={`homologacion-${readiness.destino}`}>
        Salida pendiente de homologación bancaria: no apto para pagos reales.
      </p>
    </div>
  );
}

export function PanelReadiness({ bna, patagonia }: Props) {
  return (
    <section className="mt-6" aria-labelledby="readiness-titulo" data-testid="panel-readiness">
      <h2 id="readiness-titulo" className="text-lg font-semibold">
        Estado por banco
      </h2>
      <p className="text-sm text-slate-600">Cada banco se evalúa por separado.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <TarjetaBanco readiness={bna} />
        <TarjetaBanco readiness={patagonia} />
      </div>
    </section>
  );
}
