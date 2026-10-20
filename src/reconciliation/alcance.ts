// Resolución del alcance de los hallazgos de los parsers (docs/03 §E.1, D-032, P-25).
import {
  aIncidencia,
  type AlcanceIncidencia,
  type Hallazgo,
  type Incidencia,
} from '../domain/incidencias';
import type { PayrollLine } from '../domain/liquidacion';
import type { EstadoFila } from './tipos';

/** Destino de la fila si está incluida; global si no tiene destino o está excluida (P-25). */
export function alcanceDeFila(estado: EstadoFila): AlcanceIncidencia {
  return estado.estado === 'INCLUIDA' ? estado.destino : 'GLOBAL';
}

/**
 * Hallazgo de una fila de Finnegans (reglas 1, 2 y 5, tipos de celda). En una fila excluida por
 * neto cero solo conservan su nivel los que impiden identificarla (CUIL): no se exigen legajo,
 * banco, descripción ni componentes para un pago que no existe (D-034); se informan.
 */
export function resolverHallazgoDeFila(hallazgo: Hallazgo, estado: EstadoFila): Incidencia {
  if (hallazgo.objetivo === 'GLOBAL') {
    return aIncidencia(hallazgo, 'GLOBAL');
  }
  const identifica = hallazgo.campo === 'Cuil';
  return aIncidencia(
    hallazgo,
    alcanceDeFila(estado),
    estado.estado === 'EXCLUIDA' && !identifica ? 'INFORMACION' : hallazgo.nivel,
  );
}

/**
 * Hallazgo de un registro del maestro (regla 3 y celdas de CUIL/LEGAJO). Si lo usa una fila que
 * participa del pago, toma el alcance de esa fila con su nivel; si ninguna lo usa, se informa
 * (docs/03 §B.3, D-047). Nunca se elige un registro entre duplicados.
 */
export function resolverHallazgoDeRegistro(
  hallazgo: Hallazgo,
  usuario: { readonly linea: PayrollLine; readonly estado: EstadoFila } | null,
): Incidencia {
  if (usuario === null) {
    return aIncidencia(hallazgo, 'GLOBAL', 'INFORMACION');
  }
  return aIncidencia(
    { ...hallazgo, refs: [usuario.linea.ref, ...hallazgo.refs] },
    alcanceDeFila(usuario.estado),
  );
}
