// Incidencias vistas por el operador. PROYECCIÓN SOLAMENTE: el dominio sigue teniendo una
// incidencia por fila; acá se agrupan para no imprimir cientos de bloques iguales, y
// cualquier grupo se puede expandir para ver las incidencias individuales del motor con
// origen, fila, alcance y valores. La UI no decide cómo resolver: eso ya lo marca el motor.
import { useState } from 'react';
import { claveRef } from '../domain/incidencias';
import type { FilaConciliada, IncidenciaConciliada } from '../reconciliation';
import type { GrupoProyectado, ProyeccionIncidencias } from './proyeccion';
import { proyectarIncidencias, textoIncidencia } from './proyeccion';
import {
  ESTILO_NIVEL,
  ETIQUETA_NIVEL,
  ETIQUETA_SECCION,
  etiquetaAlcance,
  etiquetaValoresGrupo,
} from './etiquetas';
import { Insignia, type Tono } from './componentes';

interface Props {
  readonly incidencias: readonly IncidenciaConciliada[];
  /** Filas conciliadas para mostrar empleado y legajo cuando estén disponibles. */
  readonly filas?: readonly FilaConciliada[];
}

const TONO_NIVEL: Readonly<Record<IncidenciaConciliada['nivel'] | 'CORRECTO', Tono>> = {
  CORRECTO: 'exito',
  INFORMACION: 'info',
  REQUIERE_REVISION: 'atencion',
  BLOQUEANTE: 'peligro',
};

type FilasPorRef = ReadonlyMap<string, FilaConciliada>;

function indexarFilas(filas: readonly FilaConciliada[]): FilasPorRef {
  const mapa = new Map<string, FilaConciliada>();
  for (const fila of filas) {
    mapa.set(claveRef(fila.linea.ref), fila);
  }
  return mapa;
}

function empleadoDe(
  fila: FilaConciliada | undefined,
): { readonly empleado: string; readonly legajo: string } | null {
  if (fila === undefined) {
    return null;
  }
  return {
    empleado: fila.linea.legajoApellidoNombre || '(empleado sin nombre legible)',
    legajo: fila.linea.legajo ?? '(ilegible)',
  };
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

function EmpleadoIncidencia({
  incidencia,
  filaPorRef,
}: {
  readonly incidencia: IncidenciaConciliada;
  readonly filaPorRef: FilasPorRef;
}) {
  const fila = incidencia.refs
    .map((ref) => filaPorRef.get(claveRef(ref)))
    .find((candidata) => candidata !== undefined);
  const empleado = empleadoDe(fila);
  if (empleado === null) {
    return null;
  }
  return (
    <p className="text-xs text-slate-600" data-testid="empleado-incidencia">
      Empleado: {empleado.empleado} · Legajo: {empleado.legajo}
    </p>
  );
}

function ItemIncidencia({
  incidencia,
  filaPorRef,
}: {
  readonly incidencia: IncidenciaConciliada;
  readonly filaPorRef: FilasPorRef;
}) {
  return (
    <li
      className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5"
      data-testid={`incidencia-${incidencia.id}`}
    >
      <p className={ESTILO_NIVEL[incidencia.nivel]}>
        {incidencia.resolucion !== undefined && 'Resuelta por decisión del operador · '}
        <strong>{ETIQUETA_NIVEL[incidencia.nivel]}</strong> · {textoIncidencia(incidencia)} (
        {etiquetaAlcance(incidencia.alcance)})
      </p>
      <EmpleadoIncidencia incidencia={incidencia} filaPorRef={filaPorRef} />
      <RefsIncidencia refs={incidencia.refs} />
      {incidencia.valores !== undefined && (
        <p className="text-xs text-slate-500">
          Valores observados:{' '}
          {Object.entries(incidencia.valores)
            .map(([fuente, valor]) => `${fuente}: «${valor}»`)
            .join(' · ')}
        </p>
      )}
    </li>
  );
}

/**
 * Guía operativa para el neto cero. La exclusión sigue siendo INFORMACION y la decide el
 * motor: la UI solo explica el origen del importe y cómo corregirlo en Finnegans. El neto
 * no se edita desde esta aplicación.
 */
function GuiaNetoCero({
  grupo,
  filaPorRef,
}: {
  readonly grupo: GrupoProyectado;
  readonly filaPorRef: FilasPorRef;
}) {
  const empleados = grupo.incidencias
    .flatMap((incidencia) =>
      incidencia.refs.map((ref) => ({ ref, fila: filaPorRef.get(claveRef(ref)) })),
    )
    .filter(
      (
        item,
      ): item is {
        readonly ref: IncidenciaConciliada['refs'][number];
        readonly fila: FilaConciliada;
      } => item.fila !== undefined,
    );
  return (
    <div
      className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"
      data-testid="neto-cero-guia"
    >
      <p>
        El importe neto proviene de la liquidación de Finnegans. Esta aplicación no permite
        modificarlo.
      </p>
      <p className="mt-1">
        Si el cero es un error, corregí la liquidación en Finnegans, volvé a exportarla y cargala de
        nuevo en «1. Cargar archivos».
      </p>
      <p className="mt-1">
        La exclusión es informativa: no bloquea la conciliación ni impide pagar al resto de los
        empleados.
      </p>
      {empleados.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs" data-testid="neto-cero-empleados">
          {empleados.map(({ ref, fila }) => {
            const empleado = empleadoDe(fila);
            return (
              <li key={claveRef(ref)}>
                Empleado: {empleado?.empleado ?? '(sin nombre)'} · Legajo:{' '}
                {empleado?.legajo ?? '(ilegible)'} · Origen: Liquidación fila{' '}
                {ref.fila === undefined ? '—' : String(ref.fila)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Grupo de casos repetidos: título con descripción única y conteo; detalle bajo demanda. */
function Grupo({
  grupo,
  indice,
  filaPorRef,
}: {
  readonly grupo: GrupoProyectado;
  readonly indice: number;
  readonly filaPorRef: FilasPorRef;
}) {
  const [abierto, setOpen] = useState(false);
  return (
    <div
      className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"
      data-testid={`grupo-caso-${grupo.codigo}-${String(indice + 1)}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={TONO_NIVEL[grupo.nivel]}>{ETIQUETA_NIVEL[grupo.nivel]}</Insignia>
            <p className={`font-medium ${ESTILO_NIVEL[grupo.nivel]}`}>
              {textoIncidencia(grupo.incidencias[0] ?? exigirPrimero(grupo))}
            </p>
          </div>
          {etiquetaValoresGrupo(grupo.valores) !== '' && (
            <p className="mt-1 text-sm font-medium text-slate-900">
              {etiquetaValoresGrupo(grupo.valores)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {String(grupo.cantidad)}{' '}
            {grupo.cantidad === grupo.filasAfectadas
              ? grupo.cantidad === 1
                ? 'caso'
                : 'casos'
              : `casos · ${String(grupo.filasAfectadas)} empleados afectados`}
            {grupo.alcance !== 'GLOBAL' && ` · ${etiquetaAlcance(grupo.alcance)}`}
          </p>
        </div>
        <button
          type="button"
          data-testid={`detalle-grupo-${grupo.codigo}-${String(indice + 1)}`}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
          aria-expanded={abierto}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          {abierto ? 'Ocultar detalle' : `Ver detalle (${String(grupo.cantidad)})`}
        </button>
      </div>
      {grupo.codigo === 'NETO_CERO' && (
        <div className="px-3 pb-3">
          <GuiaNetoCero grupo={grupo} filaPorRef={filaPorRef} />
        </div>
      )}
      {abierto && (
        <ul className="list-none space-y-2 border-t border-slate-100 bg-slate-50 px-3 py-3">
          {grupo.incidencias.map((incidencia) => (
            <ItemIncidencia key={incidencia.id} incidencia={incidencia} filaPorRef={filaPorRef} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Con grupos construidos por proyección, siempre hay al menos una incidencia. */
function exigirPrimero(grupo: GrupoProyectado): IncidenciaConciliada {
  const primero = grupo.incidencias[0];
  if (primero === undefined) {
    throw new Error('grupo de presentación sin incidencias');
  }
  return primero;
}

/** Sección de grupos o de historial; si no hay nada, la sección no existe. */
function Seccion({
  titulo,
  grupos,
  resueltas,
  testid,
  filaPorRef,
}: {
  readonly titulo: string;
  readonly grupos?: readonly GrupoProyectado[];
  readonly resueltas?: readonly IncidenciaConciliada[];
  readonly testid: string;
  readonly filaPorRef: FilasPorRef;
}) {
  if (grupos?.length === 0 || resueltas?.length === 0) {
    return null;
  }
  return (
    <div className="mt-4" data-testid={testid}>
      <h3 className="font-semibold text-marca-950">{titulo}</h3>
      {grupos?.map((grupo, indice) => (
        <Grupo
          key={exigirPrimero(grupo).id}
          grupo={grupo}
          indice={indice}
          filaPorRef={filaPorRef}
        />
      ))}
      {resueltas !== undefined && resueltas.length > 0 && (
        <ul className="list-none space-y-2 pl-0">
          {resueltas.map((incidencia) => (
            <ItemIncidencia key={incidencia.id} incidencia={incidencia} filaPorRef={filaPorRef} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function PanelIncidencias({ incidencias, filas = [] }: Props) {
  const proyeccion: ProyeccionIncidencias = proyectarIncidencias(incidencias);
  const filaPorRef = indexarFilas(filas);
  return (
    <section
      className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="incidencias-titulo"
      data-testid="panel-incidencias"
    >
      <h3 id="incidencias-titulo" className="text-lg font-semibold text-marca-950">
        Detalles de la corrida
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Los casos repetidos aparecen agrupados; «Ver detalle» muestra cada uno con origen, fila y
        valores, tal como salió de la conciliación.
      </p>
      <Seccion
        titulo={ETIQUETA_SECCION.BLOQUEOS}
        grupos={proyeccion.bloqueosAgrupados}
        testid="incidencias-bloqueos"
        filaPorRef={filaPorRef}
      />
      <Seccion
        titulo={ETIQUETA_SECCION.INFORMACION}
        grupos={proyeccion.informacionAgrupada}
        testid="incidencias-informacion"
        filaPorRef={filaPorRef}
      />
      <Seccion
        titulo={ETIQUETA_SECCION.RESUELTAS}
        resueltas={proyeccion.resueltas}
        testid="incidencias-resueltas"
        filaPorRef={filaPorRef}
      />
    </section>
  );
}
