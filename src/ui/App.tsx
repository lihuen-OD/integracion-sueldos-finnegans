// UI operativa de F3 (CP-F3-B): recorrido completo de la corrida en memoria. La UI no
// implementa ni decide reglas de negocio: orquesta a través de `src/ui/orquestacion.ts`
// (y el puente productivo `src/run/puente.ts`) los contratos ya aprobados de F2. Todo es
// local, sin red ni persistencia; "Reiniciar" descarta todo el estado (D-009/D-065).
import { useState } from 'react';
import type { Destino } from '../domain/destino';
import {
  evaluarReadiness,
  type BnaReadiness,
  type IncidenciaConciliada,
  type PatagoniaReadiness,
  type ResultadoConciliacion,
  type TipoDecision,
} from '../reconciliation';
import {
  conDecision,
  conFinnegans,
  conMaestro,
  conPerfil,
  nuevaCorrida,
  reiniciarCorrida,
} from '../run/corrida';
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { LecturaMaestro } from '../domain/maestro';
import {
  conciliarCorrida,
  crearDecisionAsignarDestino,
  crearDecisionConfirmarRevision,
} from './orquestacion';
import { correrDemo } from './demo/datosDemo';
import { ZonaCarga } from './ZonaCarga';
import { PanelPerfil } from './PanelPerfil';
import { PanelResumen } from './PanelResumen';
import { PanelIncidencias } from './PanelIncidencias';
import { PanelDecisiones } from './PanelDecisiones';
import { PanelReadiness } from './PanelReadiness';
import { DetalleFila, TablaFilas } from './TablaFilas';
import type { CompanyProfile } from '../profile/contrato';

export function App() {
  const [estado, setEstado] = useState(nuevaCorrida);
  const [resultado, setResultadoConciliacion] = useState<ResultadoConciliacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalleFila, setDetalleFila] = useState<number | null>(null);
  const [empujandoDemo, setEmpujandoDemo] = useState(false);

  async function conciliar(estadoActual = estado) {
    const r = await conciliarCorrida(estadoActual);
    if (!r.ok) {
      setResultadoConciliacion(null);
      setAviso(
        r.error === 'FINNEGANS_AUSENTE'
          ? 'Todavía falta cargar la liquidación de Finnegans.'
          : 'Todavía falta cargar el maestro de empleados.',
      );
      return;
    }
    setAviso(null);
    setDetalleFila(null);
    setResultadoConciliacion(r.value);
  }

  function cargarFinnegans(lectura: LecturaFinnegans, huella: string) {
    setResultadoConciliacion(null);
    setEstado((prev) => conFinnegans(prev, lectura, huella));
  }

  function cargarMaestro(lectura: LecturaMaestro, huella: string) {
    setResultadoConciliacion(null);
    setEstado((prev) => conMaestro(prev, lectura, huella));
  }

  function cargarPerfil(perfilValidado: CompanyProfile) {
    setEstado((prev) => conPerfil(prev, perfilValidado));
  }

  async function registrarDecision(
    incidencia: IncidenciaConciliada,
    tipo: TipoDecision,
    destino?: Destino,
  ) {
    if (incidencia.resoluble === undefined) {
      return; // El motor marcó que ya no sigue resoluble: nada por hacer.
    }
    const decision =
      tipo === 'ASIGNAR_DESTINO' && destino !== undefined
        ? crearDecisionAsignarDestino(estado, incidencia, destino)
        : crearDecisionConfirmarRevision(estado, incidencia);
    const estadoNuevo = conDecision(estado, decision);
    setEstado(estadoNuevo);
    // Re-conciliación inmediata después de registrar la decisión (recorrido 11 del plan).
    await conciliar(estadoNuevo);
  }

  async function cargarDemo() {
    setEmpujandoDemo(true);
    try {
      const demo = await correrDemo();
      setEstado((prev) =>
        conMaestro(
          conFinnegans(
            conPerfil(prev, demo.perfil),
            demo.finnegans.lectura,
            demo.finnegans.huellaArchivo,
          ),
          demo.maestro.lectura,
          demo.maestro.huellaArchivo,
        ),
      );
      setResultadoConciliacion(null);
    } finally {
      setEmpujandoDemo(false);
    }
  }

  function reiniciar() {
    const confirmado = window.confirm(
      '¿Reiniciar la corrida? Se descarta todo lo cargado y las decisiones guardadas en memoria.',
    );
    if (!confirmado) {
      return;
    }
    setEstado(reiniciarCorrida());
    setResultadoConciliacion(null);
    setAviso(null);
    setDetalleFila(null);
  }

  const ambos = estado.finnegans !== null && estado.maestroRevision !== null;
  const readiness: {
    readonly bna: BnaReadiness;
    readonly patagonia: PatagoniaReadiness;
  } | null = resultado === null ? null : evaluarReadiness(resultado);

  return (
    <main className="mx-auto max-w-5xl p-6 font-sans text-slate-900">
      <h1 className="text-2xl font-semibold">Conciliación de liquidaciones (asistente local)</h1>
      <p
        role="note"
        className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
      >
        Todo funciona en tu computadora (sin internet ni almacenamiento).{' '}
        <strong>No apto para pagos.</strong> Los archivos bancarios quedan pendientes de
        homologación.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="corrida-barra">
        <button
          type="button"
          onClick={() => void conciliar()}
          disabled={!ambos}
          data-testid="boton-conciliar"
          className="rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Conciliar
        </button>
        <button
          type="button"
          onClick={reiniciar}
          data-testid="boton-reiniciar"
          className="rounded border border-slate-400 px-4 py-1.5 text-sm hover:bg-slate-100"
        >
          Reiniciar corrida (descarta todo)
        </button>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => void cargarDemo()}
            disabled={empujandoDemo}
            data-testid="boton-demo"
            className="rounded border border-slate-400 px-4 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            Cargar corrida demo (desarrollo, datos sintéticos)
          </button>
        )}
        <span className="text-sm text-slate-600" data-testid="resumen-carga">
          {[
            `Finnegans: ${estado.finnegans === null ? 'pendiente' : 'cargada'}`,
            `Maestro: ${estado.maestroRevision === null ? 'pendiente' : 'cargado'}`,
            `Perfil: ${estado.perfil === null ? 'sin cargar' : 'cargado'}`,
          ].join(' · ')}
        </span>
      </div>
      <div aria-live="polite">
        {aviso !== null && (
          <p role="alert" data-testid="aviso-orquesta" className="mt-2 text-sm text-red-700">
            {aviso}
          </p>
        )}
      </div>

      {resultado === null && (
        <section className="mt-6 text-sm text-slate-600" data-testid="sin-conciliar">
          Cargá los dos archivos y, si lo tenés, el perfil de la empresa. Después usá «Conciliar».
          La app concilia de nuevo sola cuando tomás una decisión.
        </section>
      )}

      {resultado !== null && detalleFila !== null && (
        <DetalleDetalle
          resultado={resultado}
          detalleFila={detalleFila}
          cerrar={() => {
            setDetalleFila(null);
          }}
        />
      )}

      {resultado !== null && (
        <>
          <PanelResumen resultado={resultado} />
          {readiness !== null && (
            <PanelReadiness bna={readiness.bna} patagonia={readiness.patagonia} />
          )}
          <PanelIncidencias
            incidencias={resultado.incidencias}
            resolver={(incidencia, tipo, destino) =>
              void registrarDecision(incidencia, tipo, destino)
            }
          />
          <PanelDecisiones
            aplicadas={resultado.decisiones.aplicadas}
            noAplicadas={resultado.decisiones.noAplicadas}
          />
          <TablaFilas resultado={resultado} abrirFila={setDetalleFila} />
        </>
      )}

      <ZonaCarga
        cargarFinnegans={cargarFinnegans}
        cargarMaestro={cargarMaestro}
        cargado={{
          finnegans: estado.finnegans === null ? null : { filas: estado.finnegans.lineas.length },
          maestro:
            estado.maestroRevision === null
              ? null
              : { registros: estado.maestroRevision.registros.length },
        }}
      />
      <PanelPerfil perfil={estado.perfil} cargarPerfil={cargarPerfil} />
      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Asistente de conciliación F3 · motor de conciliación de F2 · todo local, sin persistencia.
        Salidas bancarias pendientes de homologación (D-029).
      </footer>
    </main>
  );
}

function DetalleDetalle({
  resultado,
  detalleFila,
  cerrar,
}: {
  readonly resultado: ResultadoConciliacion;
  readonly detalleFila: number;
  readonly cerrar: () => void;
}) {
  const fila = resultado.filas[detalleFila];
  if (fila === undefined) {
    return null;
  }
  return <DetalleFila fila={fila} cerrar={cerrar} />;
}
