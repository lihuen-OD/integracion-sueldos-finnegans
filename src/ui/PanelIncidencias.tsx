// Incidencias vistas por el operador (correctivo UX CP-F3-B). PROYECCIÓN SOLAMENTE:
// el dominio sigue teniendo una incidencia por fila (P-29.9 intacto); acá se agrupan para
// no imprimir cientos de bloques iguales, y cualquier grupo se puede expandir para ver las
// incidencias individuales del motor con origen, fila, alcance y valores. La UI no se
// pregunta cómo resolver nada: eso ya lo marca el motor (resoluble) y lo arma PanelAccion.
import { useState } from 'react';
import type { IncidenciaConciliada } from '../reconciliation';
import type { GrupoProyectado, ProyeccionIncidencias } from './proyeccion';
import { proyectarIncidencias, textoIncidencia } from './proyeccion';
import {
  ESTILO_NIVEL,
  ETIQUETA_NIVEL,
  ETIQUETA_SECCION,
  etiquetaAlcance,
  etiquetaValoresGrupo,
} from './etiquetas';

interface Props {
  readonly incidencias: readonly IncidenciaConciliada[];
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

function ItemIncidencia({ incidencia }: { readonly incidencia: IncidenciaConciliada }) {
  return (
    <li className="mt-2" data-testid={`incidencia-${incidencia.id}`}>
      <p className={ESTILO_NIVEL[incidencia.nivel]}>
        {incidencia.resolucion !== undefined && 'Resuelta por decisión del operador · '}
        <strong>{ETIQUETA_NIVEL[incidencia.nivel]}</strong> · {textoIncidencia(incidencia)} (
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
    </li>
  );
}

/** Grupo de casos repetidos: título con descripción única y conteo; detalle bajo demanda. */
function Grupo({ grupo, indice }: { readonly grupo: GrupoProyectado; readonly indice: number }) {
  const [abierto, setOpen] = useState(false);
  return (
    <div
      className="mt-3 rounded border border-slate-200"
      data-testid={`grupo-caso-${grupo.codigo}-${String(indice + 1)}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 p-3">
        <div>
          <p className={`font-medium ${ESTILO_NIVEL[grupo.nivel]}`}>
            {textoIncidencia(grupo.incidencias[0] ?? exigirPrimero(grupo))}
          </p>
          {etiquetaValoresGrupo(grupo.valores) !== '' && (
            <p className="text-sm font-medium text-slate-900">
              {etiquetaValoresGrupo(grupo.valores)}
            </p>
          )}
          <p className="text-sm text-slate-600">
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
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
        >
          {abierto ? 'Ocultar detalle' : `Ver detalle (${String(grupo.cantidad)})`}
        </button>
      </div>
      {abierto && (
        <ul className="list-none space-y-2 px-3 pb-3">
          {grupo.incidencias.map((incidencia) => (
            <ItemIncidencia key={incidencia.id} incidencia={incidencia} />
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
}: {
  readonly titulo: string;
  readonly grupos?: readonly GrupoProyectado[];
  readonly resueltas?: readonly IncidenciaConciliada[];
  readonly testid: string;
}) {
  if (grupos?.length === 0 || resueltas?.length === 0) {
    return null;
  }
  return (
    <div className="mt-4" data-testid={testid}>
      <h3 className="font-medium">{titulo}</h3>
      {grupos?.map((grupo, indice) => (
        <Grupo key={exigirPrimero(grupo).id} grupo={grupo} indice={indice} />
      ))}
      {resueltas !== undefined && resueltas.length > 0 && (
        <ul className="list-none space-y-2 pl-0">
          {resueltas.map((incidencia) => (
            <ItemIncidencia key={incidencia.id} incidencia={incidencia} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function PanelIncidencias({ incidencias }: Props) {
  const proyeccion: ProyeccionIncidencias = proyectarIncidencias(incidencias);
  return (
    <section className="mt-6" aria-labelledby="incidencias-titulo" data-testid="panel-incidencias">
      <h2 id="incidencias-titulo" className="text-lg font-semibold">
        Detalles de la corrida
      </h2>
      <p className="text-sm text-slate-600">
        Los casos repetidos aparecen agrupados; «Ver detalle» muestra cada uno con origen, fila y
        valores, tal como salió de la conciliación.
      </p>
      <Seccion
        titulo={ETIQUETA_SECCION.BLOQUEOS}
        grupos={proyeccion.bloqueosAgrupados}
        testid="incidencias-bloqueos"
      />
      <Seccion
        titulo={ETIQUETA_SECCION.INFORMACION}
        grupos={proyeccion.informacionAgrupada}
        testid="incidencias-informacion"
      />
      <Seccion
        titulo={ETIQUETA_SECCION.RESUELTAS}
        resueltas={proyeccion.resueltas}
        testid="incidencias-resueltas"
      />
    </section>
  );
}
