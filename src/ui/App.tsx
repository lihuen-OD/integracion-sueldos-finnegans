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
import type { FilaConciliada } from '../reconciliation';
import type { LecturaMaestro } from '../domain/maestro';
import {
  conciliarCorrida,
  crearDecisionAsignarDestino,
  crearDecisionConfirmarRevision,
  guardarEdicionMaestro,
} from './orquestacion';
import type { EstadoEdicion } from './EditorMaestro';
import { correrDemo } from './demo/datosDemo';
import { ZonaCarga, fechaLocal } from './ZonaCarga';
import { XLSX_MIME_TYPE, downloadBytes } from '../export/download';
import { PanelPerfil } from './PanelPerfil';
import { PanelAccion } from './PanelAccion';
import { proyectarIncidencias } from './proyeccion';
import { PanelResumen } from './PanelResumen';
import { PanelIncidencias } from './PanelIncidencias';
import { PanelDecisiones } from './PanelDecisiones';
import { PanelReadiness } from './PanelReadiness';
import { DetalleFila, TablaFilas } from './TablaFilas';
import type { CompanyProfile } from '../profile/contrato';
import type { CampoEditableMaestro, MasterRecord } from '../domain/maestro';
import { ETIQUETA_MOTIVO_CAMPO_BANCARIO } from './etiquetas';
import { mensajeErrorEdicion } from './orquestacion';

export function App() {
  const [estado, setEstado] = useState(nuevaCorrida);
  const [resultado, setResultadoConciliacion] = useState<ResultadoConciliacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalleFila, setDetalleFila] = useState<number | null>(null);
  const [empujandoDemo, setEmpujandoDemo] = useState(false);
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoEdicion | null>(null);

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
    // El perfil entra en conciliarCorrida (catalogoBancos): un perfil nuevo invalida el
    // resultado anterior; la conciliación queda a cargo del next «Conciliar» explícito.
    setResultadoConciliacion(null);
    setEstado((prev) => conPerfil(prev, perfilValidado));
  }

  async function guardarEdicion(
    registro: MasterRecord,
    campo: CampoEditableMaestro,
    texto: string,
  ): Promise<void> {
    const r = guardarEdicionMaestro(estado, registro, campo, texto);
    if (!r.ok) {
      setEstadoEdicion({
        campo,
        ok: false,
        mensaje:
          r.error.caso === 'VALOR_INVALIDO'
            ? `El dato no se acepta: ${ETIQUETA_MOTIVO_CAMPO_BANCARIO[r.error.motivo]}`
            : mensajeErrorEdicion(r.error.caso),
      });
      return;
    }
    setEstado(r.estado);
    setEstadoEdicion({
      campo,
      ok: true,
      mensaje:
        'Dato guardado. La tabla volvió a conciliar con la versión nueva del maestro.',
    });
    await conciliar(r.estado);
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

  async function exportarMaestro(): Promise<void> {
    const revision = estado.maestroRevision;
    const maestro = estado.maestro;
    if (revision === null || maestro === null) {
      return;
    }
    const fecha = fechaLocal();
    const modulo = await import('../import/master/maestroRevisionXlsx');
    const bytes = await modulo.generarMaestroEditado(revision, fecha);
    downloadBytes(bytes, modulo.nombreMaestroEditado(fecha, revision.numero), XLSX_MIME_TYPE);
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
  const resolver = (
    incidencia: IncidenciaConciliada,
    tipo: TipoDecision,
    destino?: Destino,
  ): void => void registrarDecision(incidencia, tipo, destino);
  const proyeccion = resultado === null ? null : proyectarIncidencias(resultado.incidencias);
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

      {resultado !== null && (
        <>
          <PanelResumen resultado={resultado} />
          {proyeccion !== null && (
            <PanelAccion
              accionables={proyeccion.accionables}
              filas={resultado.filas}
              resolver={resolver}
            />
          )}
          {readiness !== null && (
            <PanelReadiness bna={readiness.bna} patagonia={readiness.patagonia} />
          )}
          <PanelIncidencias incidencias={resultado.incidencias} />
          <PanelDecisiones
            aplicadas={resultado.decisiones.aplicadas}
            noAplicadas={resultado.decisiones.noAplicadas}
          />
          <TablaFilas resultado={resultado} abrirFila={setDetalleFila} resolver={resolver} />
        </>
      )}

      {resultado !== null && detalleFila !== null && resultado.filas[detalleFila] !== undefined && (
        <DetalleDetalle
          fila={resultado.filas[detalleFila]}
          cerrar={() => {
            setDetalleFila(null);
          }}
          resolver={resolver}
          guardarEdicion={(campo, texto) => {
            const seleccionada = resultado.filas[detalleFila];
            if (seleccionada?.registro != null) {
              void guardarEdicion(seleccionada.registro, campo, texto);
            }
          }}
          estadoEdicion={estadoEdicion}
        />
      )}

      <ZonaCarga
        cargarFinnegans={cargarFinnegans}
        cargarMaestro={cargarMaestro}
        extrasMaestro={
          estado.maestroRevision === null ? null : (
            <>
              <p className="mt-2 text-sm" data-testid="revision-maestro">
                {`Versión del maestro: ${String(estado.maestroRevision.numero)}`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                El archivo original no se modifica: la app guarda tus cambios de esta sesión y
                puede descargar el maestro actualizado con ellos.
              </p>
              <button
                type="button"
                data-testid="boton-exportar-maestro"
                onClick={() => void exportarMaestro()}
                className="mt-1 rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
              >
                Descargar maestro con mis cambios (XLSX)
              </button>
            </>
          )
        }
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
        Todo local, sin persistencia. Salidas bancarias pendientes de homologación bancaria; no apto
        para pagos reales.
      </footer>
    </main>
  );
}

function DetalleDetalle({
  fila,
  cerrar,
  resolver,
  guardarEdicion,
  estadoEdicion,
}: {
  readonly fila: FilaConciliada;
  readonly cerrar: () => void;
  readonly resolver: (inc: IncidenciaConciliada, tipo: TipoDecision, destino?: Destino) => void;
  readonly guardarEdicion: (campo: CampoEditableMaestro, texto: string) => void;
  readonly estadoEdicion: EstadoEdicion | null;
}) {
  return (
    <DetalleFila
      fila={fila}
      cerrar={cerrar}
      resolver={resolver}
      guardarEdicion={guardarEdicion}
      estadoEdicion={estadoEdicion}
    />
  );
}
