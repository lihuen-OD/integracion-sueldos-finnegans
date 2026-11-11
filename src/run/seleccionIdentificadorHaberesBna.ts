// Adaptador de corrida para CP-F7-BNA-B1/B2. Registra el snapshot BNA, lo revalida contra
// la corrida vigente y ofrece una única resolución por SourceRef para conciliación y
// evaluación técnica. Nunca modifica la política productiva ni habilita generación.
import {
  aplicarSeleccionesIdentificadorHaberesBna,
  CATALOGO_IDENTIFICADORES_HABERES_BNA,
  POLITICA_BNA_PRODUCTIVA,
  resuelto,
  sinResolucion,
  type AplicacionSeleccionesIdentificadorHaberesBna,
  type CoberturaDescripcionBna,
  type CodigoIdentificadorHaberesBna,
  type ErrorSeleccionIdentificadorHaberesBna,
  type LiquidacionBnaPendiente,
  type PagoBna,
  type PoliticaBna,
  type SeleccionIdentificadorHaberesBnaValidada,
} from '../banks/bna';
import { clasificarBanco } from '../domain/destino';
import { claveRef } from '../domain/incidencias';
import type { PayrollLine } from '../domain/liquidacion';
import type { PoliticaLiquidaciones } from '../reconciliation';
import type { Result } from '../shared/result';
import type { EstadoCorrida } from './corrida';
import { lineasBancariasEfectivas } from './lineasBancariasEfectivas';

export { CATALOGO_IDENTIFICADORES_HABERES_BNA };
export type { AplicacionSeleccionesIdentificadorHaberesBna, LiquidacionBnaPendiente };

/** Snapshot interno de una aplicación B1 válida. No duplica las líneas de Finnegans. */
export interface SnapshotSeleccionIdentificadorHaberesBna {
  readonly huellaFinnegans: string;
  readonly seleccionesValidadas: readonly SeleccionIdentificadorHaberesBnaValidada[];
  readonly cantidadesAfectadas: readonly CoberturaDescripcionBna[];
  readonly pendientes: readonly LiquidacionBnaPendiente[];
}

export interface SeleccionValidadaPorRefBna {
  readonly descripcionOriginal: string;
  readonly destino: 'BNA_GT_HABERES';
  readonly codigoIdentificadorHaberes: CodigoIdentificadorHaberesBna;
}

/** Resolución revalidada. B2 consume este índice, nunca el snapshot crudo. */
export interface ResolucionSeleccionIdentificadorHaberesBna {
  readonly huellaFinnegans: string;
  readonly porRef: ReadonlyMap<string, SeleccionValidadaPorRefBna>;
  readonly pendientes: readonly LiquidacionBnaPendiente[];
}

export interface AplicacionSeleccionIdentificadorHaberesBnaCorrida {
  readonly estado: EstadoCorrida;
  readonly aplicacion: AplicacionSeleccionesIdentificadorHaberesBna;
}

export type ErrorSeleccionIdentificadorHaberesBnaCorrida =
  | ErrorSeleccionIdentificadorHaberesBna
  | { readonly codigo: 'FINNEGANS_AUSENTE' }
  | { readonly codigo: 'HUELLA_FINNEGANS_AUSENTE' };

/** Consulta pura usada también para preparar las descripciones pendientes de la UI. */
export function seleccionarIdentificadoresHaberesBnaCorrida(
  estado: EstadoCorrida,
  entrada: unknown,
): Result<
  AplicacionSeleccionesIdentificadorHaberesBna,
  readonly ErrorSeleccionIdentificadorHaberesBnaCorrida[]
> {
  if (estado.finnegans === null) {
    return { ok: false, error: [{ codigo: 'FINNEGANS_AUSENTE' }] };
  }
  if (estado.huellaFinnegans === null) {
    return { ok: false, error: [{ codigo: 'HUELLA_FINNEGANS_AUSENTE' }] };
  }
  // La selección BNA trabaja sobre la vista efectiva: una fila con banco vacío asignada
  // manualmente a BNA participa con su `SourceRef` exacta, sin tocar la línea original.
  return aplicarSeleccionesIdentificadorHaberesBna(
    {
      huellaFinnegans: estado.huellaFinnegans,
      lineas: lineasBancariasEfectivas(estado, 'BNA_GT_HABERES'),
    },
    entrada,
  );
}

function snapshotDe(
  aplicacion: AplicacionSeleccionesIdentificadorHaberesBna,
): SnapshotSeleccionIdentificadorHaberesBna {
  return {
    huellaFinnegans: aplicacion.huellaFinnegans,
    seleccionesValidadas: aplicacion.seleccionesValidadas,
    cantidadesAfectadas: aplicacion.cantidadesAfectadas,
    pendientes: aplicacion.pendientes,
  };
}

/** Revalida y reemplaza por completo el snapshot BNA anterior solo ante éxito total. */
export function aplicarSeleccionesIdentificadorHaberesBnaCorrida(
  estado: EstadoCorrida,
  entrada: unknown,
): Result<
  AplicacionSeleccionIdentificadorHaberesBnaCorrida,
  readonly ErrorSeleccionIdentificadorHaberesBnaCorrida[]
> {
  const aplicacion = seleccionarIdentificadoresHaberesBnaCorrida(estado, entrada);
  if (!aplicacion.ok) return aplicacion;
  const snapshot = snapshotDe(aplicacion.value);
  return {
    ok: true,
    value: {
      estado: { ...estado, seleccionIdentificadorHaberesBna: snapshot },
      aplicacion: aplicacion.value,
    },
  };
}

/** Invalida una aplicación previa apenas el formulario vuelve a ser borrador. */
export function invalidarSeleccionIdentificadorHaberesBnaCorrida(
  estado: EstadoCorrida,
): EstadoCorrida {
  return estado.seleccionIdentificadorHaberesBna === null
    ? estado
    : { ...estado, seleccionIdentificadorHaberesBna: null };
}

function mismoSnapshot(
  snapshot: SnapshotSeleccionIdentificadorHaberesBna,
  recalculo: AplicacionSeleccionesIdentificadorHaberesBna,
): boolean {
  const iguales = (guardado: unknown, calculado: unknown) =>
    JSON.stringify(guardado) === JSON.stringify(calculado);
  return (
    snapshot.huellaFinnegans === recalculo.huellaFinnegans &&
    iguales(snapshot.seleccionesValidadas, recalculo.seleccionesValidadas) &&
    iguales(snapshot.cantidadesAfectadas, recalculo.cantidadesAfectadas) &&
    iguales(snapshot.pendientes, recalculo.pendientes)
  );
}

function lineasBnaPorRef(lineas: readonly PayrollLine[]): ReadonlyMap<string, PayrollLine> | null {
  const resultado = new Map<string, PayrollLine>();
  for (const linea of lineas) {
    const banco = clasificarBanco(linea.bancoFinnegans);
    if (banco.tipo !== 'CATALOGADO' || banco.banco.destino !== 'BNA_GT_HABERES') continue;
    const clave = claveRef(linea.ref);
    if (resultado.has(clave)) return null;
    resultado.set(clave, linea);
  }
  return resultado;
}

/**
 * Revalida el snapshot completo contra huella y líneas vigentes. Comprueba cobertura,
 * referencias únicas, descripción exacta y destino. Cualquier incoherencia invalida todo.
 */
export function resolverSeleccionIdentificadorHaberesBna(
  snapshot: SnapshotSeleccionIdentificadorHaberesBna | null,
  huellaFinnegans: string,
  lineas: readonly PayrollLine[],
): ResolucionSeleccionIdentificadorHaberesBna | null {
  if (snapshot === null || huellaFinnegans.trim() === '') return null;
  if (snapshot.huellaFinnegans !== huellaFinnegans) return null;
  if (
    snapshot.seleccionesValidadas.some((seleccion) => seleccion.huellaFinnegans !== huellaFinnegans)
  ) {
    return null;
  }

  const recalculo = aplicarSeleccionesIdentificadorHaberesBna(
    { huellaFinnegans, lineas },
    snapshot.seleccionesValidadas,
  );
  if (!recalculo.ok || !mismoSnapshot(snapshot, recalculo.value)) return null;

  const lineasBna = lineasBnaPorRef(lineas);
  if (lineasBna === null) return null;
  const seleccionPorDescripcion = new Map(
    recalculo.value.seleccionesValidadas.map(
      (seleccion) => [seleccion.descripcionOriginal, seleccion] as const,
    ),
  );
  const porRef = new Map<string, SeleccionValidadaPorRefBna>();
  const referenciasSnapshot = new Set<string>();

  for (const cantidad of recalculo.value.cantidadesAfectadas) {
    if (cantidad.cantidadFilasBna !== cantidad.refs.length) return null;
    const seleccion = seleccionPorDescripcion.get(cantidad.descripcionOriginal);
    if (seleccion?.huellaFinnegans !== huellaFinnegans) return null;
    for (const ref of cantidad.refs) {
      const clave = claveRef(ref);
      const linea = lineasBna.get(clave);
      if (
        linea?.descripcion.descripcionOriginal !== cantidad.descripcionOriginal ||
        referenciasSnapshot.has(clave)
      ) {
        return null;
      }
      referenciasSnapshot.add(clave);
      porRef.set(clave, {
        descripcionOriginal: cantidad.descripcionOriginal,
        destino: 'BNA_GT_HABERES',
        codigoIdentificadorHaberes: seleccion.codigoIdentificadorHaberes,
      });
    }
  }

  for (const pendiente of recalculo.value.pendientes) {
    if (pendiente.cantidadFilasBna !== pendiente.refs.length) return null;
    for (const ref of pendiente.refs) {
      const clave = claveRef(ref);
      const linea = lineasBna.get(clave);
      if (
        linea?.descripcion.descripcionOriginal !== pendiente.descripcionOriginal ||
        referenciasSnapshot.has(clave)
      ) {
        return null;
      }
      referenciasSnapshot.add(clave);
    }
  }

  if (referenciasSnapshot.size !== lineasBna.size) return null;
  for (const clave of lineasBna.keys()) {
    if (!referenciasSnapshot.has(clave)) return null;
  }

  return { huellaFinnegans, porRef, pendientes: recalculo.value.pendientes };
}

const REVISION_MULTIPLICADOR = 0x100000001b3n;
const REVISION_MODULO = 0x10000000000000000n;

function checksumRevision(texto: string): string {
  let acumulado = 0xcbf29ce484222325n;
  for (const caracter of texto) {
    acumulado =
      (acumulado * REVISION_MULTIPLICADOR + BigInt(caracter.codePointAt(0) ?? 0)) % REVISION_MODULO;
  }
  return acumulado.toString(16).padStart(16, '0');
}

/** Revisión estable de la resolución exacta usada por conciliación y evaluación BNA. */
export function revisionSeleccionIdentificadorHaberesBna(
  resolucion: ResolucionSeleccionIdentificadorHaberesBna,
): string {
  const selecciones = [...resolucion.porRef.entries()]
    .map(([ref, seleccion]) =>
      [
        ref,
        seleccion.destino,
        seleccion.descripcionOriginal,
        seleccion.codigoIdentificadorHaberes,
      ].join('\u0000'),
    )
    .sort();
  return checksumRevision([resolucion.huellaFinnegans, ...selecciones].join('\u0001'));
}

const LIQUIDACION_SIN_RESOLUCION = { estado: 'SIN_RESOLUCION' } as const;
const SELECCION_EXPLICITA_VALIDADA = { estado: 'SELECCION_EXPLICITA_VALIDADA' } as const;

function resolucionCompleta(
  resolucion: ResolucionSeleccionIdentificadorHaberesBna | null,
): resolucion is ResolucionSeleccionIdentificadorHaberesBna {
  return resolucion !== null && resolucion.pendientes.length === 0;
}

/**
 * Política B2 para conciliación. Una aplicación parcial sigue siendo un borrador válido de
 * B1, pero no aporta evidencia consumible: hasta cubrir todas las filas BNA, ninguna se
 * resuelve y no se publica revisión.
 */
export function politicaLiquidacionesDesdeSeleccionBna(
  estado: EstadoCorrida,
): PoliticaLiquidaciones {
  if (estado.finnegans === null || estado.huellaFinnegans === null) {
    return { resolver: () => LIQUIDACION_SIN_RESOLUCION };
  }
  const resolucion = resolverSeleccionIdentificadorHaberesBna(
    estado.seleccionIdentificadorHaberesBna,
    estado.huellaFinnegans,
    lineasBancariasEfectivas(estado, 'BNA_GT_HABERES'),
  );
  if (!resolucionCompleta(resolucion)) {
    return { resolver: () => LIQUIDACION_SIN_RESOLUCION };
  }

  return {
    resolver: (linea, destino) => {
      if (destino !== 'BNA_GT_HABERES') return LIQUIDACION_SIN_RESOLUCION;
      const seleccion = resolucion.porRef.get(claveRef(linea.ref));
      return seleccion?.descripcionOriginal === linea.descripcion.descripcionOriginal
        ? SELECCION_EXPLICITA_VALIDADA
        : LIQUIDACION_SIN_RESOLUCION;
    },
    revisionSeleccionIdentificadorHaberesBna: revisionSeleccionIdentificadorHaberesBna(resolucion),
  };
}

/**
 * Política técnica B2. Conserva íntegra la política productiva y solo resuelve P-09/P-10
 * para pagos cubiertos por una resolución completa. Sin evidencia exacta falla cerrado,
 * incluso si un doble de test sustituyera la política productiva.
 */
export function politicaBnaDesdeResolucionIdentificadorHaberesBna(
  resolucion: ResolucionSeleccionIdentificadorHaberesBna | null,
): PoliticaBna {
  return {
    ...POLITICA_BNA_PRODUCTIVA,
    identificadorPrestamo: (pago: PagoBna) => {
      if (!resolucionCompleta(resolucion)) return sinResolucion('P-09/P-10');
      const seleccion = resolucion.porRef.get(claveRef(pago.ref));
      if (seleccion?.descripcionOriginal !== pago.descripcion.descripcionOriginal) {
        return sinResolucion('P-09/P-10');
      }
      return resuelto(seleccion.codigoIdentificadorHaberes);
    },
  };
}
