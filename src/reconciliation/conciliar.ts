// Conciliación Finnegans ↔ maestro (docs/03 §E y §G). Función pura: no modifica las lecturas.
// Orden (§E.2): reglas 1–3 para todas las filas; regla 4 excluye; luego destino (10, 11) y, solo
// para filas con destino determinado, las reglas de banco (6, 7, 9, 12, 13, 14, 17, 19).
// Decisiones del operador: ASIGNAR_DESTINO antes de las reglas de banco; CONFIRMAR_REVISION al
// final. Las incidencias resueltas siguen en el resultado, con su resolución.
import type { Cuil } from '../domain/cuil';
import { CATALOGO_BANCOS } from '../domain/destino';
import { aIncidencia, nivelMasGrave, type Hallazgo } from '../domain/incidencias';
import type { MasterRecord } from '../domain/maestro';
import { resolverHallazgoDeFila, resolverHallazgoDeRegistro } from './alcance';
import {
  conResolubilidad,
  decisionVigente,
  enConflicto,
  incidenciaNoAplicada,
  motivoNoAplicada,
} from './decisiones';
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
  type DecisionOperador,
  type EntradaConciliacion,
  type EstadoFila,
  type FilaConciliada,
  type IncidenciaConciliada,
  type Resolucion,
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

  lista(): readonly IncidenciaConciliada[] {
    return this.todas;
  }

  /** Aplica las resoluciones manteniendo la misma instancia en la lista y en cada fila. */
  resolver(resoluciones: ReadonlyMap<string, Resolucion>): {
    readonly todas: readonly IncidenciaConciliada[];
    readonly deFila: (fila: number) => readonly IncidenciaConciliada[];
  } {
    const final = new Map<IncidenciaConciliada, IncidenciaConciliada>();
    for (const incidencia of this.todas) {
      const resolucion = resoluciones.get(incidencia.id);
      final.set(incidencia, resolucion === undefined ? incidencia : { ...incidencia, resolucion });
    }
    const mapear = (lista: readonly IncidenciaConciliada[]) =>
      lista.map((incidencia) => final.get(incidencia) ?? incidencia);
    return {
      todas: mapear(this.todas),
      deFila: (fila) => mapear(this.porFila.get(fila) ?? []),
    };
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

  const decisiones = entrada.decisiones ?? [];
  const conflicto = enConflicto(decisiones);
  const resoluciones = new Map<string, Resolucion>();
  const aplicadas: DecisionOperador[] = [];
  const aplicar = (incidencia: IncidenciaConciliada): DecisionOperador | undefined => {
    const decision = decisionVigente(incidencia, decisiones, conflicto);
    if (decision !== undefined) {
      aplicadas.push(decision);
      resoluciones.set(incidencia.id, {
        decisionId: decision.id,
        tipo: decision.tipo,
        momento: decision.momento,
      });
    }
    return decision;
  };

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
    const deLaFila = (lista: readonly IncidenciaConciliada[]) =>
      lista.map((incidencia) => conResolubilidad(incidencia, linea, entrada.huellas));
    const inicial = reglaNetoCero(linea) ?? reglaBanco(linea, catalogo);
    const incidenciasDeEstado = deLaFila(inicial.incidencias);
    let estado: EstadoFila = inicial.estado;
    // Banco vacío: el destino solo lo asigna una decisión vigente del operador (D-013).
    for (const incidencia of incidenciasDeEstado) {
      const decision = aplicar(incidencia);
      if (decision?.tipo === 'ASIGNAR_DESTINO') {
        estado = { estado: 'INCLUIDA', destino: decision.destino, origen: 'DECISION_OPERADOR' };
      }
    }
    // Reglas 1, 2 y 5 (y tipos de celda), detectadas por el parser.
    coleccion.agregar(
      deLaFila((deFila.get(indice) ?? []).map((h) => resolverHallazgoDeFila(h, estado))),
      indice,
    );
    coleccion.agregar(incidenciasDeEstado, indice);
    if (estado.estado === 'EXCLUIDA') {
      // Neto cero: no se exige maestro ni datos bancarios (D-034).
      return { linea, registro: null, estado };
    }
    const candidatos = linea.cuil === null ? [] : (porCuil.get(linea.cuil) ?? []);
    for (const registro of candidatos) {
      usados.add(registro);
      // Regla 3 y celdas de CUIL/LEGAJO del registro: alcance de esta fila.
      const hallazgos = deRegistro.get(registro) ?? [];
      coleccion.agregar(
        deLaFila(hallazgos.map((h) => resolverHallazgoDeRegistro(h, { linea, estado }))),
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
    const destino = estado.destino;
    const contexto: FilaConDestino = {
      linea,
      destino,
      banco: inicial.banco ?? catalogo.find((item) => item.destino === destino),
    };
    coleccion.agregar(
      deLaFila([...reglaNetoNegativo(contexto), ...reglaSinMaestro(contexto, candidatos.length)]),
      indice,
    );
    if (registro !== null) {
      evaluados.add(registro);
      coleccion.agregar(
        deLaFila([
          ...reglaLegajo(contexto, registro, lineas),
          ...reglaBancoCompatible(contexto, registro),
          ...reglaDatosDestino(contexto, registro),
        ]),
        indice,
      );
    }
    coleccion.agregar(
      deLaFila([
        ...reglaLiquidacion(contexto, politica),
        ...reglaComponentes(contexto),
        ...reglaLegajoNombre(contexto),
      ]),
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
      const hallazgos = deRegistro.get(registro) ?? [];
      coleccion.agregar(hallazgos.map((h) => resolverHallazgoDeRegistro(h, null)));
    }
    coleccion.agregar(reglaMaestroSinLiquidacion(registro, cuilesFinnegans));
    if (!evaluados.has(registro)) {
      coleccion.agregar(reglaCamposSinEvaluar(registro));
    }
  }

  // Confirmaciones de revisión, sobre las incidencias ya calculadas.
  for (const incidencia of coleccion.lista()) {
    if (incidencia.resoluble?.por === 'CONFIRMAR_REVISION') {
      aplicar(incidencia);
    }
  }
  const porId = new Map(coleccion.lista().map((incidencia) => [incidencia.id, incidencia]));
  const noAplicadas = decisiones
    .filter((decision) => !aplicadas.includes(decision))
    .map((decision) => ({ decision, motivo: motivoNoAplicada(decision, porId, conflicto) }));
  coleccion.agregar(noAplicadas.map(incidenciaNoAplicada));

  const final = coleccion.resolver(resoluciones);
  return {
    filas: filas.map((fila, indice) => {
      const incidencias = final.deFila(indice);
      // El nivel visible lo dan las incidencias sin resolver (D-051).
      const pendientes = incidencias.filter((i) => i.resolucion === undefined);
      return { ...fila, incidencias, nivel: nivelMasGrave(pendientes.map((i) => i.nivel)) };
    }),
    incidencias: final.todas,
    decisiones: { aplicadas, noAplicadas },
  };
}
