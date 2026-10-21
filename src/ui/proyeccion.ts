// Proyección PRESENTACIONAL de incidencias para la UI (correctivo UX CP-F3-B).
// El dominio conserva una incidencia por fila (P-29.9 intacto): acá SOLO se agrupan en
// grupos de presentación con una clave explícita, determinista y testeada. Nada de esto
// modifica incidencias, niveles, resolucion ni decisiones del motor — todo viene ya
// calculado por conciliar() y las funciones son puras.
import type { IncidenciaConciliada } from '../reconciliation';
import type { AlcanceIncidencia, CodigoIncidencia, NivelVisible } from '../domain/incidencias';
import { DESCRIPCION_CODIGO } from '../domain/incidencias';

/** Texto humano único por incidencia: detalle del motor o descripción del tipo; una sola
 *  frase (antes aparecían las dos y eran prácticamente iguales). */
export function textoIncidencia(incidencia: IncidenciaConciliada): string {
  return incidencia.detalle.trim() !== ''
    ? incidencia.detalle
    : DESCRIPCION_CODIGO[incidencia.codigo];
}

/** Grupo de presentación: casos repetidos que comparten nivel, tipo, alcance y valores. */
export interface GrupoProyectado {
  readonly nivel: NivelVisible;
  readonly codigo: CodigoIncidencia;
  readonly alcance: AlcanceIncidencia;
  readonly valores: IncidenciaConciliada['valores'];
  /** Cantidad de incidencias del grupo (número en pantalla derivado del motor). */
  readonly cantidad: number;
  /** Empleados afectados: filas únicas cuando la tenga; si no, la cantidad misma. */
  readonly filasAfectadas: number;
  /** Las incidencias íntegras del motor, una por una (para «Ver detalle»). */
  readonly incidencias: readonly IncidenciaConciliada[];
}

export interface ProyeccionIncidencias {
  /** Requieren una decisión del operador AHORA (resoluble y sin resolver, en orden del motor). */
  readonly accionables: readonly IncidenciaConciliada[];
  /** Grupos de bloqueo sin acción humana soportada (bloqueantes/revisiones sin decisión). */
  readonly bloqueosAgrupados: readonly GrupoProyectado[];
  /** Grupos informativos. */
  readonly informacionAgrupada: readonly GrupoProyectado[];
  /** Historial: incidencias ya resueltas por decisión del operador. */
  readonly resueltas: readonly IncidenciaConciliada[];
  /** Trazabilidad: incidencias sin resolver y sin acción soportada (completa los grupos). */
  readonly restantes: readonly IncidenciaConciliada[];
}

/**
 * Clave de agrupación presentacional: resuelta/sin-resolver + nivel + código + alcance +
 * valores observados. El valor observado entra en la clave para NO mezclar casos
 * conceptualmente distintos (dos tipos de liquidación distintos no comparten grupo).
 */
export function claveDeGrupoPresentacional(incidencia: IncidenciaConciliada): string {
  const valores =
    incidencia.valores === undefined
      ? ''
      : Object.entries(incidencia.valores)
          .map(([fuente, valor]) => `${fuente}=${valor}`)
          .sort()
          .join(';');
  return [
    incidencia.resolucion === undefined ? 'sin-resolver' : 'resuelta',
    incidencia.nivel,
    incidencia.codigo,
    incidencia.alcance,
    valores,
  ].join('|');
}

/** Cantidades por grupo; orden determinista por clave (estable entre corridas iguales). */
function agruparClave(lista: readonly IncidenciaConciliada[]): readonly GrupoProyectado[] {
  const grupos = new Map<string, readonly IncidenciaConciliada[]>();
  for (const incidencia of lista) {
    const clave = claveDeGrupoPresentacional(incidencia);
    grupos.set(clave, [...(grupos.get(clave) ?? []), incidencia]);
  }
  const ordenNivel: readonly NivelVisible[] = ['BLOQUEANTE', 'REQUIERE_REVISION', 'INFORMACION'];
  return [...grupos.entries()]
    .map(([clave, incidencias]) => {
      const primero = incidencias[0];
      if (primero === undefined) {
        throw new Error(`grupo sin incidencias: ${clave}`);
      }
      const filas = new Set(
        incidencias.flatMap((i) => i.refs.filter((r) => r.fila !== undefined).map((r) => r.fila)),
      );
      return {
        nivel: primero.nivel,
        codigo: primero.codigo,
        alcance: primero.alcance,
        valores: primero.valores,
        cantidad: incidencias.length,
        // Sin fila asociada (alcance global), la cantidad es la de los casos.
        filasAfectadas: filas.size === 0 ? incidencias.length : filas.size,
        incidencias,
      };
    })
    .sort(
      (a, b) =>
        ordenNivel.indexOf(a.nivel) - ordenNivel.indexOf(b.nivel) ||
        a.codigo.localeCompare(b.codigo) ||
        a.alcance.localeCompare(b.alcance) ||
        (a.incidencias[0]?.id ?? '').localeCompare(b.incidencias[0]?.id ?? ''),
    );
}

/** Proyección pura del resultado del motor para la pantalla. */
export function proyectarIncidencias(
  incidencias: readonly IncidenciaConciliada[],
): ProyeccionIncidencias {
  const accionables = incidencias.filter(
    (i) => i.resoluble !== undefined && i.resolucion === undefined,
  );
  const resueltas = incidencias.filter((i) => i.resolucion !== undefined);
  const restantes = incidencias.filter(
    (i) => i.resoluble === undefined && i.resolucion === undefined,
  );
  return {
    accionables,
    bloqueosAgrupados: agruparClave(restantes.filter((i) => i.nivel !== 'INFORMACION')),
    informacionAgrupada: agruparClave(restantes.filter((i) => i.nivel === 'INFORMACION')),
    resueltas,
    restantes,
  };
}
