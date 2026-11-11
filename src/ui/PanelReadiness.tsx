// Estado por banco: dos tarjetas simétricas y compactas. Nada de este componente decide
// si un banco puede generar: muestra el readiness de conciliación con la configuración de
// la empresa vigente. El generador sigue deshabilitado y no representa homologación.
import type { BnaReadiness, PatagoniaReadiness } from '../reconciliation';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO_READINESS,
  ETIQUETA_MOTIVO_READINESS,
  etiquetaImporte,
} from './etiquetas';
import { Insignia, Metrica, type Tono } from './componentes';

type Readiness = BnaReadiness | PatagoniaReadiness;

interface Props {
  readonly bna: BnaReadiness;
  readonly patagonia: PatagoniaReadiness;
}

function tonoReadiness(estado: Readiness['estado']): Tono {
  switch (estado) {
    case 'LISTO_PARA_GENERAR':
      return 'exito';
    case 'BLOQUEADO':
    case 'BLOQUEADO_POR_CONCILIACION_GLOBAL':
      return 'peligro';
    case 'REQUIERE_REVISION':
    case 'CONFIGURACION_INCOMPLETA':
    case 'GENERADOR_NO_HABILITADO':
      return 'atencion';
    case 'SIN_REGISTROS':
      return 'neutral';
  }
}

function TarjetaBanco({ readiness }: { readiness: Readiness }) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={`readiness-${readiness.destino}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-marca-950">{ETIQUETA_DESTINO[readiness.destino]}</h3>
        <Insignia tono={tonoReadiness(readiness.estado)}>
          {ETIQUETA_ESTADO_READINESS[readiness.estado]}
        </Insignia>
      </div>
      <p className="mt-2 font-semibold text-slate-900" data-testid={`estado-${readiness.destino}`}>
        {ETIQUETA_ESTADO_READINESS[readiness.estado]}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metrica etiqueta="Filas asignadas" valor={String(readiness.asignadas.cantidad)} />
        <Metrica etiqueta="Importe" valor={`$${etiquetaImporte(readiness.asignadas.importe)}`} />
      </div>
      {(readiness.bloqueantes > 0 || readiness.revisionesSinResolver > 0) && (
        <p className="mt-2 text-sm text-amber-900" data-testid={`pendientes-${readiness.destino}`}>
          Bloqueos: {String(readiness.bloqueantes)} · Revisiones sin resolver:{' '}
          {String(readiness.revisionesSinResolver)}
        </p>
      )}
      {readiness.motivos.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {readiness.motivos.map((motivo) => (
            <li key={motivo}>{ETIQUETA_MOTIVO_READINESS[motivo]}</li>
          ))}
        </ul>
      )}
      <p
        className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-800"
        data-testid={`homologacion-${readiness.destino}`}
      >
        Salida pendiente de homologación bancaria: no apto para pagos reales.
      </p>
    </div>
  );
}

export function PanelReadiness({ bna, patagonia }: Props) {
  return (
    <section aria-labelledby="readiness-titulo" data-testid="panel-readiness">
      <h3 id="readiness-titulo" className="text-lg font-semibold text-marca-950">
        Estado de conciliación por banco
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Cada banco se resume por separado según la configuración de la empresa y el resultado de la
        liquidación. Este estado no evalúa la aptitud del archivo ni la homologación bancaria.
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <TarjetaBanco readiness={bna} />
        <TarjetaBanco readiness={patagonia} />
      </div>
    </section>
  );
}
