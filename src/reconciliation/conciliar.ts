// Conciliación Finnegans ↔ maestro (docs/03 §E y §G). Función pura: no modifica las lecturas.
// Orden (§E.2): reglas 1–3 para todas las filas; regla 4 excluye; luego destino (10, 11) y, solo
// para filas con destino determinado, las reglas de banco (6, 7, 9, 12, 13, 14, 17, 19).
import type { Cuil } from '../domain/cuil';
import { CATALOGO_BANCOS } from '../domain/destino';
import { aIncidencia, nivelMasGrave, type Hallazgo } from '../domain/incidencias';
import type { MasterRecord } from '../domain/maestro';
import { resolverHallazgoDeFila, resolverHallazgoDeRegistro } from './alcance';
import type { FilaConDestino } from './reglas/contexto';
import {
  reglaBancoCompatible,
  reglaDatosDestino,
  reglaLegajo,
  reglaSinMaestro,
} from './reglas/cruce';
import { reglaBanco, reglaNetoCero } from './reglas/estado';
import { reglaCamposSinEvaluar, reglaMaestroSinLiquidacion } from './reglas/maestro';
import {
  reglaComponentes,
  reglaLegajoNombre,
  reglaLiquidacion,
  reglaNetoNegativo,
} from './reglas/pago';
import {
  SIN_MAPEOS_APROBADOS,
  type EntradaConciliacion,
  type FilaConciliada,
  type IncidenciaConciliada,
  type ResultadoConciliacion,
} from './tipos';

/** Incidencias en orden de aparición y, cuando la tienen, por fila de Finnegans (índice). */
class Coleccion {
  private readonly todas: IncidenciaConciliada[] = [];
  private readonly porFila = new Map<number, IncidenciaConciliada[]>();

  agregar(incidencias: readonly IncidenciaConciliada[], fila?: number): void {
    for (const incidencia of incidencias) {
      this.todas.push(incidencia);
      if (fila !== undefined) {
        this.porFila.set(fila, [...(this.porFila.get(fila) ?? []), incidencia]);
      }
    }
  }

  deFila(fila: number): readonly IncidenciaConciliada[] {
    return this.porFila.get(fila) ?? [];
  }

  lista(): readonly IncidenciaConciliada[] {
    return this.todas;
  }
}

function agrupar<K>(
  hallazgos: readonly Hallazgo[],
  clave: (hallazgo: Hallazgo) => K | undefined,
): Map<K, Hallazgo[]> {
  const grupos = new Map<K, Hallazgo[]>();
  for (const hallazgo of hallazgos) {
    const valor = clave(hallazgo);
    if (valor !== undefined) {
      grupos.set(valor, [...(grupos.get(valor) ?? []), hallazgo]);
    }
  }
  return grupos;
}

export function conciliar(entrada: EntradaConciliacion): ResultadoConciliacion {
  const catalogo = entrada.catalogoBancos ?? CATALOGO_BANCOS;
  const politica = entrada.liquidaciones ?? SIN_MAPEOS_APROBADOS;
  const { lineas } = entrada.finnegans;
  const { registros } = entrada.maestro;
  const coleccion = new Coleccion();

  // Hallazgos de los parsers: de archivo (alcance global), de fila y de registro.
  const indicePorFila = new Map(lineas.map((linea, indice) => [linea.ref.fila, indice]));
  const registroPorFila = new Map(registros.map((registro) => [registro.ref.fila, registro]));
  const deFila = agrupar(entrada.finnegans.hallazgos, (h) => indicePorFila.get(h.refs[0]?.fila));
  const deRegistro = agrupar(entrada.maestro.hallazgos, (h) =>
    h.objetivo === 'REGISTRO' ? registroPorFila.get(h.refs[0]?.fila) : undefined,
  );
  coleccion.agregar(
    [
      ...entrada.finnegans.hallazgos.filter(
        (h) => indicePorFila.get(h.refs[0]?.fila) === undefined,
      ),
      ...entrada.maestro.hallazgos.filter((h) => h.objetivo === 'GLOBAL'),
    ].map((h) => aIncidencia(h, 'GLOBAL')),
  );

  const porCuil = new Map<Cuil, MasterRecord[]>();
  for (const registro of registros) {
    if (registro.cuil !== null) {
      porCuil.set(registro.cuil, [...(porCuil.get(registro.cuil) ?? []), registro]);
    }
  }
  const usados = new Set<MasterRecord>();
  const evaluados = new Set<MasterRecord>();

  const filas = lineas.map((linea, indice): Omit<FilaConciliada, 'incidencias' | 'nivel'> => {
    const { estado, banco, incidencias } = reglaNetoCero(linea) ?? reglaBanco(linea, catalogo);
    // Reglas 1, 2 y 5 (y tipos de celda), detectadas por el parser.
    coleccion.agregar(
      (deFila.get(indice) ?? []).map((h) => resolverHallazgoDeFila(h, estado)),
      indice,
    );
    coleccion.agregar(incidencias, indice);
    if (estado.estado === 'EXCLUIDA') {
      // Neto cero: no se exige maestro ni datos bancarios (D-034).
      return { linea, registro: null, estado };
    }
    const candidatos = linea.cuil === null ? [] : (porCuil.get(linea.cuil) ?? []);
    for (const registro of candidatos) {
      usados.add(registro);
      // Regla 3 y celdas de CUIL/LEGAJO del registro: alcance de esta fila.
      coleccion.agregar(
        (deRegistro.get(registro) ?? []).map((h) =>
          resolverHallazgoDeRegistro(h, { linea, estado }),
        ),
        indice,
      );
    }
    // Nunca se elige uno entre duplicados.
    const [unico, ...otros] = candidatos;
    const registro = unico !== undefined && otros.length === 0 ? unico : null;
    if (estado.estado === 'PENDIENTE') {
      // Las reglas de banco se aplican cuando se determina el destino (§E.2 regla 10).
      return { linea, registro, estado };
    }
    const contexto: FilaConDestino = {
      linea,
      destino: estado.destino,
      banco: banco ?? catalogo.find((item) => item.destino === estado.destino),
    };
    coleccion.agregar(
      [...reglaNetoNegativo(contexto), ...reglaSinMaestro(contexto, candidatos.length)],
      indice,
    );
    if (registro !== null) {
      evaluados.add(registro);
      coleccion.agregar(
        [
          ...reglaLegajo(contexto, registro, lineas),
          ...reglaBancoCompatible(contexto, registro),
          ...reglaDatosDestino(contexto, registro),
        ],
        indice,
      );
    }
    coleccion.agregar(
      [
        ...reglaLiquidacion(contexto, politica),
        ...reglaComponentes(contexto),
        ...reglaLegajoNombre(contexto),
      ],
      indice,
    );
    return { linea, registro, estado };
  });

  // Registros que ninguna fila con pago usa, o que no se evaluaron contra un destino.
  const cuilesFinnegans = new Set(
    lineas.flatMap((linea) => (linea.cuil === null ? [] : [linea.cuil])),
  );
  for (const registro of registros) {
    if (!usados.has(registro)) {
      coleccion.agregar(
        (deRegistro.get(registro) ?? []).map((h) => resolverHallazgoDeRegistro(h, null)),
      );
    }
    coleccion.agregar(reglaMaestroSinLiquidacion(registro, cuilesFinnegans));
    if (!evaluados.has(registro)) {
      coleccion.agregar(reglaCamposSinEvaluar(registro));
    }
  }

  return {
    filas: filas.map((fila, indice) => {
      const incidencias = coleccion.deFila(indice);
      return { ...fila, incidencias, nivel: nivelMasGrave(incidencias.map((i) => i.nivel)) };
    }),
    incidencias: coleccion.lista(),
  };
}
