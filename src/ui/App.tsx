// UI operativa: recorrido guiado de la corrida en memoria. La UI no implementa ni decide
// reglas de negocio: orquesta a través de `src/ui/orquestacion.ts` los contratos ya
// aprobados. Todo es local, sin red ni persistencia; «Reiniciar» descarta todo el estado.
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
import { PanelTipoLiquidacionPatagonia } from './PanelTipoLiquidacionPatagonia';
import { PanelIdentificadorHaberesBna } from './PanelIdentificadorHaberesBna';
import { PanelDescargaHomologacionSintetica } from './PanelDescargaHomologacionSintetica';
import {
  Boton,
  EncabezadoSeccion,
  EnlaceBoton,
  Insignia,
  Mensaje,
  Metrica,
  ProgresoPasos,
  Tarjeta,
  Vacio,
  type PasoProgreso,
} from './componentes';

export function App() {
  const [estado, setEstado] = useState(nuevaCorrida);
  const [resultado, setResultadoConciliacion] = useState<ResultadoConciliacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mensajeCorrida, setMensajeCorrida] = useState<string | null>(null);
  const [detalleFila, setDetalleFila] = useState<number | null>(null);
  const [empujandoDemo, setEmpujandoDemo] = useState(false);
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoEdicion | null>(null);
  const [versionFinnegans, setVersionFinnegans] = useState(0);
  // La configuración de la empresa se reinicia al reiniciar la corrida o al cargar la demo,
  // pero no al guardar o importar: así el formulario conserva lo que el operador completó.
  const [versionConfiguracion, setVersionConfiguracion] = useState(0);
  const [pasoActivo, setPasoActivo] = useState('paso-carga');
  const ticketConciliacion = useRef(0);
  // El feedback de edición es del EMPLEADO del detalle; se descarta al abrir/cerrar detalle,
  // al reemplazar insumos, al cargar el perfil, la demo o al reiniciar la corrida. Nunca
  // cruza empleados ni corridas (sin ids visibles).
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
    setPasoActivo('paso-validacion');
  }

  function cargarFinnegans(lectura: LecturaFinnegans, huella: string) {
    invalidarConciliacion('Cambió la liquidación de Finnegans. Volvé a conciliar.');
    limpiarEdicion();
    setDetalleFila(null);
    setVersionFinnegans((version) => version + 1);
    setEstado((prev) => conFinnegans(prev, lectura, huella));
    setPasoActivo('paso-selecciones');
  }

  function cargarMaestro(lectura: LecturaMaestro, huella: string) {
    invalidarConciliacion('Cambió el maestro de empleados. Volvé a conciliar.');
    limpiarEdicion();
    setEstado((prev) => conMaestro(prev, lectura, huella));
    setPasoActivo('paso-selecciones');
  }

  function cargarPerfil(perfilValidado: CompanyProfileImportado) {
    // El perfil entra en conciliarCorrida (catalogoBancos): un perfil nuevo invalida el
    // resultado anterior; la conciliación queda a cargo del next «Conciliar» explícito.
    invalidarConciliacion('Cambió la configuración de la empresa. Volvé a conciliar.');
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
      setVersionConfiguracion((version) => version + 1);
      setPasoActivo('paso-validacion');
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
    setVersionConfiguracion((version) => version + 1);
    limpiarEdicion();
    setPasoActivo('paso-carga');
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
  // La configuración de la empresa satisface la parte de perfil de la readiness (v2/v3 para
  // BNA y v3 para Patagonia), pero NUNCA habilita el generador: las salidas siguen pendientes
  // de homologación. No se modifican las reglas de readiness, solo se le informa el contexto.
  const configuracionBnaCompleta =
    estado.perfil !== null &&
    (estado.perfil.schemaVersion === '2' || estado.perfil.schemaVersion === '3');
  const configuracionPatagoniaCompleta = estado.perfil?.schemaVersion === '3';
  const readiness: {
    readonly bna: BnaReadiness;
    readonly patagonia: PatagoniaReadiness;
  } | null =
    resultado === null
      ? null
      : evaluarReadiness(resultado, {
          configuracionCompleta: {
            BNA_GT_HABERES: configuracionBnaCompleta,
            PATAGONIA_B2: configuracionPatagoniaCompleta,
          },
          generadorHabilitado: { BNA_GT_HABERES: false, PATAGONIA_B2: false },
        });
  const preparacionSeleccionPatagonia = seleccionarLiquidacionesPatagoniaCorrida(estado, []);
  const preparacionSeleccionBna = seleccionarIdentificadoresHaberesBnaCorrida(estado, []);

  const descripcionesBna = preparacionSeleccionBna.ok
    ? preparacionSeleccionBna.value.pendientes
    : [];
  const descripcionesPatagonia = preparacionSeleccionPatagonia.ok
    ? preparacionSeleccionPatagonia.value.pendientes
    : [];

  const snapshotBna = estado.seleccionIdentificadorHaberesBna;
  const snapshotPatagonia = estado.seleccionLiquidacionPatagonia;
  const pendientesSeleccionBna =
    snapshotBna === null ? descripcionesBna.length : snapshotBna.pendientes.length;
  const pendientesSeleccionPatagonia =
    snapshotPatagonia === null
      ? descripcionesPatagonia.length
      : snapshotPatagonia.pendientes.length;

  const estadoCarga: PasoProgreso['estado'] =
    estado.finnegans !== null && estado.maestroRevision !== null ? 'completo' : 'en-curso';
  // Un borrador con descripciones pendientes no completa el paso: la política bancaria exige
  // cobertura total, así que una selección parcial no resuelve ninguna fila.
  const configuradoBna =
    descripcionesBna.length === 0 || (snapshotBna !== null && snapshotBna.pendientes.length === 0);
  const configuradoPatagonia =
    descripcionesPatagonia.length === 0 ||
    (snapshotPatagonia !== null && snapshotPatagonia.pendientes.length === 0);
  const estadoSelecciones: PasoProgreso['estado'] =
    estado.finnegans === null
      ? 'pendiente'
      : configuradoBna && configuradoPatagonia
        ? 'completo'
        : 'en-curso';
  const estadoValidacion: PasoProgreso['estado'] =
    resultado === null
      ? ambos
        ? 'en-curso'
        : 'pendiente'
      : resultado.global.estado === 'BLOQUEADA'
        ? 'bloqueado'
        : 'completo';

  const pasos: readonly PasoProgreso[] = [
    {
      id: 'paso-carga',
      numero: '1',
      titulo: 'Cargar archivos',
      detalle: 'Liquidación de Finnegans y maestro de empleados.',
      estado: estadoCarga,
    },
    {
      id: 'paso-selecciones',
      numero: '2',
      titulo: 'Configurar tipos de haberes',
      detalle: 'Identificador Banco Nación y concepto Banco Patagonia.',
      estado: estadoSelecciones,
    },
    {
      id: 'paso-validacion',
      numero: '3',
      titulo: 'Validar liquidación',
      detalle: 'Conciliación explícita, decisiones y estado por banco.',
      estado: estadoValidacion,
    },
    {
      id: 'paso-revision',
      numero: '4',
      titulo: 'Revisar empleados',
      detalle: 'Tabla, datos bancarios e incidencias de cada empleado.',
      estado: resultado === null ? 'pendiente' : 'completo',
    },
    {
      id: 'paso-resultados',
      numero: '5',
      titulo: 'Resultados y descargas',
      detalle: 'Totales, comprobaciones y salidas disponibles.',
      estado: estadoValidacion === 'pendiente' ? 'pendiente' : estadoValidacion,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-marca-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-marca-300 uppercase">
              Recursos Humanos · asistente local
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Conciliación de liquidaciones
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-marca-200">
              De Finnegans a los archivos de Banco Nación y Banco Patagonia, con revisión paso a
              paso y sin enviar datos a internet.
            </p>
          </div>
          <div
            className="rounded-xl border border-marca-700 bg-marca-900/70 p-3 sm:min-w-72"
            data-testid="corrida-barra"
          >
            <p className="text-xs font-semibold tracking-wide text-marca-300 uppercase">
              Estado de la corrida
            </p>
            <p className="mt-1 text-sm text-marca-50" data-testid="resumen-carga">
              {[
                `Finnegans: ${estado.finnegans === null ? 'pendiente' : 'cargada'}`,
                `Maestro: ${estado.maestroRevision === null ? 'pendiente' : 'cargado'}`,
                `Empresa: ${estado.perfil === null ? 'sin configurar' : 'configurada'}`,
              ].join(' · ')}
            </p>
            <button
              type="button"
              onClick={reiniciar}
              data-testid="boton-reiniciar"
              className="mt-2 rounded-lg border border-marca-500 px-3 py-1.5 text-sm font-medium text-marca-50 hover:bg-marca-800"
            >
              Reiniciar corrida (descarta todo)
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-amber-300 bg-amber-50">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p role="note" className="text-sm text-amber-950">
            <strong>Todo funciona en tu computadora</strong> (sin internet ni almacenamiento).{' '}
            <strong>No apto para pagos.</strong> Los archivos bancarios quedan pendientes de
            homologación.
          </p>
        </div>
      </div>

      <ProgresoPasos
        pasos={pasos}
        activoId={pasoActivo}
        onNavegar={(id) => {
          setPasoActivo(id);
        }}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div aria-live="polite">
          {aviso !== null && (
            <p
              role="alert"
              data-testid="aviso-orquesta"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            >
              {aviso}
            </p>
          )}
        </div>

        <ZonaCarga
          cargarFinnegans={cargarFinnegans}
          cargarMaestro={cargarMaestro}
          extrasMaestro={
            estado.maestroRevision === null ? null : (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-sm font-medium" data-testid="revision-maestro">
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
                  className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                >
                  Descargar maestro con mis cambios (XLSX)
                </button>
              </div>
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
              <Boton
                onClick={() => void cargarDemo()}
                disabled={empujandoDemo}
                data-testid="boton-demo"
              >
                Cargar corrida demo (desarrollo, datos sintéticos)
              </Boton>
            ) : null
          }
        />
        <div data-testid="paso-empresa">
          <PanelPerfil
            key={`configuracion-${String(versionConfiguracion)}`}
            perfil={estado.perfil}
            cargarPerfil={cargarPerfil}
          />
        </div>

        <section
          id="paso-selecciones"
          className="mt-10 scroll-mt-24"
          aria-labelledby="selecciones-titulo"
          data-testid="paso-selecciones"
        >
          <EncabezadoSeccion
            id="selecciones-titulo"
            numero="2"
            titulo="Configurar tipos de haberes"
            descripcion="Definí, por descripción exacta de Finnegans, el identificador de haberes de Banco Nación y el concepto de pago de Banco Patagonia. Nunca se elige por vos."
            acciones={<Insignia tono="atencion">Sin preselección</Insignia>}
          />

          {estado.finnegans === null ? (
            <div className="mt-4">
              <Vacio
                titulo="Primero cargá la liquidación de Finnegans."
                acciones={<EnlaceBoton href="#paso-carga">Volver a Cargar archivos</EnlaceBoton>}
              >
                <p>Las descripciones a configurar salen de la liquidación cargada.</p>
              </Vacio>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Metrica
                  etiqueta="Descripciones Banco Nación"
                  valor={String(descripcionesBna.length)}
                  detalle={
                    pendientesSeleccionBna === 0
                      ? 'Sin pendientes de selección'
                      : `${String(pendientesSeleccionBna)} sin selección aplicada`
                  }
                  tono={pendientesSeleccionBna === 0 ? 'exito' : 'atencion'}
                />
                <Metrica
                  etiqueta="Descripciones Banco Patagonia"
                  valor={String(descripcionesPatagonia.length)}
                  detalle={
                    pendientesSeleccionPatagonia === 0
                      ? 'Sin pendientes de selección'
                      : `${String(pendientesSeleccionPatagonia)} sin selección aplicada`
                  }
                  tono={pendientesSeleccionPatagonia === 0 ? 'exito' : 'atencion'}
                />
              </div>

              {descripcionesBna.length > 0 ? (
                <PanelIdentificadorHaberesBna
                  key={`bna-${String(versionFinnegans)}`}
                  huellaFinnegans={
                    preparacionSeleccionBna.ok ? preparacionSeleccionBna.value.huellaFinnegans : ''
                  }
                  descripciones={descripcionesBna}
                  aplicar={aplicarSeleccionesBna}
                  invalidar={invalidarSeleccionBna}
                />
              ) : (
                <Tarjeta
                  titulo="Banco Nación · identificador de haberes"
                  descripcion="No hay descripciones de Banco Nación en esta liquidación."
                >
                  <p className="text-sm text-slate-600">
                    Si cargás otra liquidación con filas de Banco Nación, acá vas a poder asignar el
                    identificador de haberes.
                  </p>
                </Tarjeta>
              )}

              {descripcionesPatagonia.length > 0 ? (
                <PanelTipoLiquidacionPatagonia
                  key={`patagonia-${String(versionFinnegans)}`}
                  huellaFinnegans={
                    preparacionSeleccionPatagonia.ok
                      ? preparacionSeleccionPatagonia.value.huellaFinnegans
                      : ''
                  }
                  descripciones={descripcionesPatagonia}
                  aplicar={aplicarSeleccionesPatagonia}
                  invalidar={invalidarSeleccionPatagonia}
                />
              ) : (
                <Tarjeta
                  titulo="Banco Patagonia · concepto de pago"
                  descripcion="No hay descripciones de Banco Patagonia en esta liquidación."
                >
                  <p className="text-sm text-slate-600">
                    Si cargás otra liquidación con filas de Banco Patagonia, acá vas a poder asignar
                    el concepto de pago.
                  </p>
                </Tarjeta>
              )}

              <Mensaje
                tono="info"
                rol="status"
                titulo="Los cambios de selección se notan al validar"
              >
                <p>
                  Esta pantalla no aplica códigos por defecto. Después de configurar, volvé a
                  «Validar liquidación» para que la corrida use las selecciones aplicadas.
                </p>
              </Mensaje>
            </div>
          )}
        </section>

        <section
          id="paso-validacion"
          className="mt-10 scroll-mt-24"
          aria-labelledby="validacion-titulo"
          data-testid="paso-conciliar"
        >
          <EncabezadoSeccion
            id="validacion-titulo"
            numero="3"
            titulo="Validar liquidación"
            descripcion="La conciliación es siempre explícita. Si cambiaste archivos, datos, la configuración de la empresa, las selecciones o las decisiones, presioná el botón nuevamente."
            acciones={
              <Insignia tono={resultado === null ? 'neutral' : 'exito'}>
                {resultado === null ? 'Pendiente' : 'Validación vigente'}
              </Insignia>
            }
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Tarjeta
              titulo="Ejecutar la validación"
              descripcion="Cruza la liquidación, el maestro, la configuración de la empresa y las decisiones de esta corrida. No modifica los archivos originales."
            >
              <ul className="space-y-2 text-sm">
                <li className="flex flex-wrap items-center gap-2">
                  <Insignia tono={estado.finnegans === null ? 'atencion' : 'exito'}>
                    {estado.finnegans === null ? 'Pendiente' : 'Cargada'}
                  </Insignia>
                  Liquidación de Finnegans
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <Insignia tono={estado.maestroRevision === null ? 'atencion' : 'exito'}>
                    {estado.maestroRevision === null ? 'Pendiente' : 'Cargado'}
                  </Insignia>
                  Maestro de empleados
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <Insignia tono={estado.perfil === null ? 'neutral' : 'exito'}>
                    {estado.perfil === null ? 'Sin configurar' : 'Configurada'}
                  </Insignia>
                  Configuración de la empresa
                </li>
              </ul>

              {(pendientesSeleccionBna > 0 || pendientesSeleccionPatagonia > 0) && (
                <Mensaje tono="atencion" rol="status" className="mt-3">
                  <p>
                    Quedan {String(pendientesSeleccionBna)} descripciones de Banco Nación y{' '}
                    {String(pendientesSeleccionPatagonia)} de Banco Patagonia sin selección
                    aplicada. Mientras falte al menos una descripción, la selección queda como
                    borrador y no resuelve ninguna fila: la validación las seguirá marcando como
                    bloqueos. Completá todas en el paso 2.
                  </p>
                  <a
                    href="#paso-selecciones"
                    className="mt-1 inline-block font-semibold text-marca-800 underline"
                  >
                    Ir a Configurar tipos de haberes
                  </a>
                </Mensaje>
              )}

              <div className="mt-4">
                <Boton
                  variante="primario"
                  className="px-5 py-2.5 text-base"
                  onClick={() => void conciliar()}
                  disabled={!ambos}
                  data-testid="boton-conciliar"
                >
                  {resultado === null ? 'Conciliar ahora' : 'Conciliar nuevamente'}
                </Boton>
              </div>
              <div aria-live="polite">
                {resultado === null && (
                  <p className="mt-2 text-sm text-amber-800" data-testid="sin-conciliar">
                    {ambos
                      ? (mensajeCorrida ??
                        'Los archivos están listos. Falta ejecutar la conciliación.')
                      : 'Cargá Finnegans y el maestro para habilitar la conciliación.'}
                  </p>
                )}
                {resultado !== null && (
                  <p className="mt-2 text-sm text-emerald-800" data-testid="conciliacion-vigente">
                    Los resultados visibles corresponden al estado actual de la corrida.
                  </p>
                )}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Qué revisa la validación">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                <li>Cada fila termina incluida, excluida por neto cero o pendiente.</li>
                <li>Los datos bancarios se comparan con el maestro, sin completar faltantes.</li>
                <li>Las decisiones del operador se revalidan contra los datos vigentes.</li>
                <li>El resultado por banco no afirma homologación ni autoriza pagos.</li>
              </ul>
            </Tarjeta>
          </div>

          {resultado !== null && proyeccion !== null && (
            <div className="mt-6 space-y-6">
              <PanelAccion
                accionables={proyeccion.accionables}
                filas={resultado.filas}
                resolver={resolver}
              />
              <PanelDecisiones
                aplicadas={resultado.decisiones.aplicadas}
                noAplicadas={resultado.decisiones.noAplicadas}
              />
            </div>
          )}
        </section>

        <section
          id="paso-revision"
          className="mt-10 scroll-mt-24"
          aria-labelledby="revision-titulo"
          data-testid="paso-revision"
        >
          <EncabezadoSeccion
            id="revision-titulo"
            numero="4"
            titulo="Revisar empleados"
            descripcion="Después de validar, acá ves cada empleado con su destino, sus datos bancarios y las incidencias que requieren revisión."
            acciones={
              <Insignia tono={resultado === null ? 'neutral' : 'exito'}>
                {resultado === null ? 'Sin validar' : 'Revisión disponible'}
              </Insignia>
            }
          />

          {resultado === null ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Metrica
                  etiqueta="Filas de Finnegans"
                  valor={estado.finnegans === null ? '—' : String(estado.finnegans.lineas.length)}
                  detalle={estado.finnegans === null ? 'Sin cargar' : 'Leídas'}
                />
                <Metrica
                  etiqueta="Registros del maestro"
                  valor={
                    estado.maestroRevision === null
                      ? '—'
                      : String(estado.maestroRevision.registros.length)
                  }
                  detalle={estado.maestroRevision === null ? 'Sin cargar' : 'Leídos'}
                />
                <Metrica
                  etiqueta="Paso previo"
                  valor={ambos ? 'Listo' : 'Falta cargar'}
                  detalle="La tabla se arma con la validación explícita"
                  tono={ambos ? 'exito' : 'atencion'}
                />
              </div>
              <Vacio
                titulo="La tabla de empleados se habilita después de validar la liquidación."
                acciones={
                  <EnlaceBoton href="#paso-validacion" variante="primario">
                    Ir a Validar liquidación
                  </EnlaceBoton>
                }
              >
                <p>
                  La validación cruza Finnegans con el maestro y recién ahí muestra estados,
                  bloqueos y datos bancarios. No se inventan resultados antes de ejecutarla.
                </p>
              </Vacio>
            </div>
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
              <PanelIncidencias incidencias={resultado.incidencias} filas={resultado.filas} />
            </>
          )}
        </section>

        <section
          id="paso-resultados"
          className="mt-10 scroll-mt-24"
          aria-labelledby="resultados-titulo"
          data-testid="paso-resultados"
        >
          <EncabezadoSeccion
            id="resultados-titulo"
            numero="5"
            titulo="Resultados y descargas"
            descripcion="Totales, comprobaciones y estado por banco. Las salidas productivas siguen bloqueadas: acá no se genera ningún archivo de pago."
            acciones={
              <Insignia tono={resultado === null ? 'neutral' : 'info'}>
                {resultado === null ? 'Sin resultados' : 'Resultado vigente'}
              </Insignia>
            }
          />

          {resultado === null ? (
            <div className="mt-4">
              <Vacio
                titulo="Todavía no hay un resultado vigente."
                acciones={
                  <EnlaceBoton href="#paso-validacion" variante="primario">
                    Ir a Validar liquidación
                  </EnlaceBoton>
                }
              >
                <p>
                  Ejecutá la validación del paso anterior para ver los totales y el estado por
                  banco.
                </p>
              </Vacio>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              <Mensaje tono="atencion" rol="note">
                Una conciliación correcta no significa que el banco esté homologado ni que exista
                autorización para generar archivos. Las salidas productivas siguen bloqueadas.
              </Mensaje>
              <PanelResumen resultado={resultado} />
              {readiness !== null && (
                <PanelReadiness bna={readiness.bna} patagonia={readiness.patagonia} />
              )}

              <div>
                <h3 className="text-lg font-semibold text-marca-950">
                  Descarga de archivos bancarios (producción)
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Estas salidas no están disponibles en esta versión. La app no muestra botones de
                  descarga productiva.
                </p>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <Tarjeta
                    titulo="Banco Nación · GT 200"
                    tono="peligro"
                    testid="produccion-bloqueada-BNA_GT_HABERES"
                    acciones={<Insignia tono="peligro">Bloqueado</Insignia>}
                  >
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      <li>Salida pendiente de homologación bancaria.</li>
                      <li>Generador productivo no habilitado.</li>
                      <li>No apto para pagos reales.</li>
                    </ul>
                  </Tarjeta>
                  <Tarjeta
                    titulo="Banco Patagonia · B.2"
                    tono="peligro"
                    testid="produccion-bloqueada-PATAGONIA_B2"
                    acciones={<Insignia tono="peligro">Bloqueado</Insignia>}
                  >
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      <li>Catálogo documentado provisional, no confirmado ni homologado.</li>
                      <li>Generador productivo no habilitado.</li>
                      <li>No apto para pagos reales.</li>
                    </ul>
                  </Tarjeta>
                </div>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">¿Necesitás probar el formato?</p>
                <p className="mt-1">
                  Más abajo hay descargas sintéticas de prueba, separadas del circuito de pago.
                  Nunca contienen los empleados ni los importes de esta liquidación.
                </p>
                <a
                  href="#descargas-sinteticas"
                  className="mt-2 inline-block font-semibold text-marca-800 underline"
                >
                  Ir a las descargas sintéticas
                </a>
              </div>
            </div>
          )}
        </section>

        <div className="mt-12 border-t-2 border-dashed border-slate-300 pt-8">
          <PanelDescargaHomologacionSintetica />
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Todo local, sin persistencia. Salidas bancarias pendientes de homologación bancaria; no
          apto para pagos reales.
        </footer>
      </main>
    </div>
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
