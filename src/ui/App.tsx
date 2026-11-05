// UI operativa de F3 (CP-F3-B): recorrido completo de la corrida en memoria. La UI no
// implementa ni decide reglas de negocio: orquesta a través de `src/ui/orquestacion.ts`
// (y el puente productivo `src/run/puente.ts`) los contratos ya aprobados de F2. Todo es
// local, sin red ni persistencia; "Reiniciar" descarta todo el estado (D-009/D-065).
import { useRef, useState } from 'react';
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
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  clasificarLiquidacionesCorrida,
  crearDecisionAsignarDestino,
  crearDecisionConfirmarRevision,
  guardarEdicionMaestro,
  invalidarSeleccionIdentificadorHaberesBnaCorrida,
  invalidarSeleccionLiquidacionPatagoniaCorrida,
  seleccionarIdentificadoresHaberesBnaCorrida,
  seleccionarLiquidacionesPatagoniaCorrida,
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
import type { CompanyProfileImportado } from '../profile/contrato';
import type { CampoEditableMaestro, MasterRecord } from '../domain/maestro';
import { ETIQUETA_MOTIVO_CAMPO_BANCARIO } from './etiquetas';
import { mensajeErrorEdicion } from './orquestacion';
import {
  PanelClasificacionLiquidaciones,
  type ResultadoAplicacionPanel,
} from './PanelClasificacionLiquidaciones';
import { PanelTipoLiquidacionPatagonia } from './PanelTipoLiquidacionPatagonia';
import { PanelIdentificadorHaberesBna } from './PanelIdentificadorHaberesBna';

export function App() {
  const [estado, setEstado] = useState(nuevaCorrida);
  const [resultado, setResultadoConciliacion] = useState<ResultadoConciliacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mensajeCorrida, setMensajeCorrida] = useState<string | null>(null);
  const [detalleFila, setDetalleFila] = useState<number | null>(null);
  const [empujandoDemo, setEmpujandoDemo] = useState(false);
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoEdicion | null>(null);
  const [versionFinnegans, setVersionFinnegans] = useState(0);
  const ticketConciliacion = useRef(0);
  // FIX 2 (correctivo CP-F3-C): el feedback de edición es del EMPLEADO del detalle;
  // se descarta al abrir/cerrar detalle, al reemplazar insumos, al cargar el perfil, la
  // demo o al reiniciar la corrida. Nunca cruza empleados ni corridas (sin ids visibles).
  const limpiarEdicion = () => {
    setEstadoEdicion(null);
  };

  /** Invalida resultados visibles y cualquier conciliación asíncrona todavía en curso. */
  function invalidarConciliacion(mensaje?: string) {
    ticketConciliacion.current += 1;
    setResultadoConciliacion(null);
    if (mensaje !== undefined) {
      setMensajeCorrida(mensaje);
    }
  }

  async function conciliar(estadoActual = estado) {
    const ticket = ++ticketConciliacion.current;
    const r = await conciliarCorrida(estadoActual);
    if (ticket !== ticketConciliacion.current) {
      return;
    }
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
    setMensajeCorrida(null);
    setResultadoConciliacion(r.value);
  }

  function cargarFinnegans(lectura: LecturaFinnegans, huella: string) {
    invalidarConciliacion('Cambió la liquidación de Finnegans. Volvé a conciliar.');
    limpiarEdicion();
    setDetalleFila(null);
    setVersionFinnegans((version) => version + 1);
    setEstado((prev) => conFinnegans(prev, lectura, huella));
  }

  function cargarMaestro(lectura: LecturaMaestro, huella: string) {
    invalidarConciliacion('Cambió el maestro de empleados. Volvé a conciliar.');
    limpiarEdicion();
    setEstado((prev) => conMaestro(prev, lectura, huella));
  }

  function cargarPerfil(perfilValidado: CompanyProfileImportado) {
    // El perfil entra en conciliarCorrida (catalogoBancos): un perfil nuevo invalida el
    // resultado anterior; la conciliación queda a cargo del next «Conciliar» explícito.
    invalidarConciliacion('Cambió el perfil empresarial. Volvé a conciliar.');
    limpiarEdicion();
    setEstado((prev) => conPerfil(prev, perfilValidado));
  }

  function guardarEdicion(
    registro: MasterRecord,
    campo: CampoEditableMaestro,
    texto: string,
  ): void {
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
    invalidarConciliacion(
      'Dato del maestro guardado. Volvé a conciliar para revisar el resultado.',
    );
    setEstado(r.estado);
    setEstadoEdicion({
      campo,
      ok: true,
      mensaje: 'Dato guardado. Volvé a conciliar para actualizar los resultados.',
    });
  }

  function registrarDecision(
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
    invalidarConciliacion('Decisión registrada. Volvé a conciliar para aplicarla al resultado.');
    setEstado(estadoNuevo);
  }

  async function cargarDemo() {
    setEmpujandoDemo(true);
    try {
      const demo = await correrDemo();
      invalidarConciliacion('Se cargó una corrida de demostración. Presioná «Conciliar».');
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
      limpiarEdicion();
      setDetalleFila(null);
      setVersionFinnegans((version) => version + 1);
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
    invalidarConciliacion();
    setAviso(null);
    setMensajeCorrida(null);
    setDetalleFila(null);
    setVersionFinnegans((version) => version + 1);
    limpiarEdicion();
  }

  function aplicarClasificaciones(entrada: unknown): ResultadoAplicacionPanel {
    const aplicacion = clasificarLiquidacionesCorrida(estado, entrada);
    if (!aplicacion.ok) {
      return { ok: false, errores: aplicacion.error };
    }
    invalidarConciliacion('Cambió la clasificación de liquidaciones. Volvé a conciliar.');
    setEstado(aplicacion.value.estado);
    setAviso(null);
    setDetalleFila(null);
    limpiarEdicion();
    return { ok: true, cantidadesAfectadas: aplicacion.value.cantidadesAfectadas };
  }

  function invalidarSeleccionPatagonia() {
    invalidarConciliacion('Cambió la selección de Banco Patagonia. Volvé a conciliar.');
    setEstado((actual) => invalidarSeleccionLiquidacionPatagoniaCorrida(actual));
  }

  function invalidarSeleccionBna() {
    invalidarConciliacion('Cambió la selección de Banco Nación. Volvé a conciliar.');
    setEstado((actual) => invalidarSeleccionIdentificadorHaberesBnaCorrida(actual));
  }

  function aplicarSeleccionesBna(entrada: unknown) {
    const aplicacion = aplicarSeleccionesIdentificadorHaberesBnaCorrida(estado, entrada);
    invalidarConciliacion('Cambió la selección de Banco Nación. Volvé a conciliar.');
    if (!aplicacion.ok) {
      setEstado((actual) => invalidarSeleccionIdentificadorHaberesBnaCorrida(actual));
      return { ok: false as const, error: aplicacion.error };
    }
    setEstado(aplicacion.value.estado);
    setAviso(null);
    setDetalleFila(null);
    limpiarEdicion();
    return { ok: true as const, value: aplicacion.value.aplicacion };
  }

  function aplicarSeleccionesPatagonia(entrada: unknown) {
    const aplicacion = aplicarSeleccionesLiquidacionPatagoniaCorrida(estado, entrada);
    invalidarConciliacion('Cambió la selección de Banco Patagonia. Volvé a conciliar.');
    if (!aplicacion.ok) {
      setEstado((actual) => invalidarSeleccionLiquidacionPatagoniaCorrida(actual));
      return { ok: false as const, error: aplicacion.error };
    }
    setEstado(aplicacion.value.estado);
    setAviso(null);
    setDetalleFila(null);
    limpiarEdicion();
    return { ok: true as const, value: aplicacion.value.aplicacion };
  }

  const ambos = estado.finnegans !== null && estado.maestroRevision !== null;
  const resolver = (
    incidencia: IncidenciaConciliada,
    tipo: TipoDecision,
    destino?: Destino,
  ): void => {
    registrarDecision(incidencia, tipo, destino);
  };
  const proyeccion = resultado === null ? null : proyectarIncidencias(resultado.incidencias);
  const readiness: {
    readonly bna: BnaReadiness;
    readonly patagonia: PatagoniaReadiness;
  } | null = resultado === null ? null : evaluarReadiness(resultado);
  const preparacionSeleccionPatagonia = seleccionarLiquidacionesPatagoniaCorrida(estado, []);
  const preparacionSeleccionBna = seleccionarIdentificadoresHaberesBnaCorrida(estado, []);

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
          onClick={reiniciar}
          data-testid="boton-reiniciar"
          className="rounded border border-slate-400 px-4 py-1.5 text-sm hover:bg-slate-100"
        >
          Reiniciar corrida (descarta todo)
        </button>
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
                El archivo original no se modifica: la app guarda tus cambios de esta sesión y puede
                descargar el maestro actualizado con ellos.
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
        demo={
          import.meta.env.DEV ? (
            <button
              type="button"
              onClick={() => void cargarDemo()}
              disabled={empujandoDemo}
              data-testid="boton-demo"
              className="rounded border border-slate-400 px-4 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Cargar corrida demo (desarrollo, datos sintéticos)
            </button>
          ) : null
        }
      />

      <section className="mt-8" aria-labelledby="revision-titulo" data-testid="paso-revision">
        <h2 id="revision-titulo" className="text-lg font-semibold">
          2 · Revisar empleados y datos bancarios
        </h2>
        {resultado === null ? (
          <p className="mt-2 text-sm text-slate-600">
            La tabla y los errores estarán disponibles después de conciliar los archivos cargados.
          </p>
        ) : (
          <>
            <TablaFilas
              resultado={resultado}
              abrirFila={(indice) => {
                setDetalleFila(indice);
                limpiarEdicion();
              }}
              resolver={resolver}
            />
            {detalleFila !== null && resultado.filas[detalleFila] !== undefined && (
              <DetalleDetalle
                fila={resultado.filas[detalleFila]}
                cerrar={() => {
                  setDetalleFila(null);
                  limpiarEdicion();
                }}
                resolver={resolver}
                guardarEdicion={(campo, texto) => {
                  const seleccionada = resultado.filas[detalleFila];
                  if (seleccionada?.registro != null) {
                    guardarEdicion(seleccionada.registro, campo, texto);
                  }
                }}
                estadoEdicion={estadoEdicion}
              />
            )}
            <PanelIncidencias incidencias={resultado.incidencias} />
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="selecciones-titulo" data-testid="paso-selecciones">
        <h2 id="selecciones-titulo" className="text-lg font-semibold">
          3 · Clasificar y seleccionar liquidaciones bancarias
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Las clasificaciones y selecciones son explícitas. Cualquier cambio deja pendiente una
          nueva conciliación.
        </p>
        {estado.finnegans === null ? (
          <p className="mt-2 text-sm text-slate-600">Primero cargá la liquidación de Finnegans.</p>
        ) : (
          <>
            <PanelClasificacionLiquidaciones
              key={versionFinnegans}
              lectura={estado.finnegans}
              aplicar={aplicarClasificaciones}
            />
            {preparacionSeleccionBna.ok && preparacionSeleccionBna.value.pendientes.length > 0 && (
              <PanelIdentificadorHaberesBna
                key={`bna-${String(versionFinnegans)}`}
                huellaFinnegans={preparacionSeleccionBna.value.huellaFinnegans}
                descripciones={preparacionSeleccionBna.value.pendientes}
                aplicar={aplicarSeleccionesBna}
                invalidar={invalidarSeleccionBna}
              />
            )}
            {preparacionSeleccionPatagonia.ok &&
              preparacionSeleccionPatagonia.value.pendientes.length > 0 && (
                <PanelTipoLiquidacionPatagonia
                  key={`patagonia-${String(versionFinnegans)}`}
                  huellaFinnegans={preparacionSeleccionPatagonia.value.huellaFinnegans}
                  descripciones={preparacionSeleccionPatagonia.value.pendientes}
                  aplicar={aplicarSeleccionesPatagonia}
                  invalidar={invalidarSeleccionPatagonia}
                />
              )}
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="empresa-titulo" data-testid="paso-empresa">
        <h2 id="empresa-titulo" className="text-lg font-semibold">
          4 · Perfil empresarial y decisiones necesarias
        </h2>
        <PanelPerfil perfil={estado.perfil} cargarPerfil={cargarPerfil} />
        {resultado !== null && proyeccion !== null && (
          <>
            <PanelAccion
              accionables={proyeccion.accionables}
              filas={resultado.filas}
              resolver={resolver}
            />
            <PanelDecisiones
              aplicadas={resultado.decisiones.aplicadas}
              noAplicadas={resultado.decisiones.noAplicadas}
            />
          </>
        )}
      </section>

      <section
        className="mt-8 rounded border border-slate-300 p-4"
        aria-labelledby="conciliar-titulo"
        data-testid="paso-conciliar"
      >
        <h2 id="conciliar-titulo" className="text-lg font-semibold">
          5 · Conciliar y validar
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          La conciliación es siempre explícita. Si cambiaste archivos, datos, perfil, selecciones o
          decisiones, presioná el botón nuevamente.
        </p>
        <button
          type="button"
          onClick={() => void conciliar()}
          disabled={!ambos}
          data-testid="boton-conciliar"
          className="mt-3 rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {resultado === null ? 'Conciliar ahora' : 'Conciliar nuevamente'}
        </button>
        <div aria-live="polite">
          {resultado === null && (
            <p className="mt-2 text-sm text-amber-800" data-testid="sin-conciliar">
              {ambos
                ? (mensajeCorrida ?? 'Los archivos están listos. Falta ejecutar la conciliación.')
                : 'Cargá Finnegans y el maestro para habilitar la conciliación.'}
            </p>
          )}
          {resultado !== null && (
            <p className="mt-2 text-sm text-emerald-800" data-testid="conciliacion-vigente">
              Los resultados visibles corresponden al estado actual de la corrida.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="resultados-titulo" data-testid="paso-resultados">
        <h2 id="resultados-titulo" className="text-lg font-semibold">
          6 · Resumen de resultados por banco
        </h2>
        {resultado === null ? (
          <p className="mt-2 text-sm text-slate-600">
            Todavía no hay un resultado vigente. Ejecutá la conciliación del paso anterior.
          </p>
        ) : (
          <>
            <p role="note" className="mt-2 rounded bg-slate-100 p-3 text-sm text-slate-700">
              Una conciliación correcta no significa que el banco esté homologado ni que exista
              autorización para generar archivos. Las salidas productivas siguen bloqueadas.
            </p>
            <PanelResumen resultado={resultado} />
            {readiness !== null && (
              <PanelReadiness bna={readiness.bna} patagonia={readiness.patagonia} />
            )}
          </>
        )}
      </section>
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
