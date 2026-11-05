// Adaptador puro C3/C5-A entre EstadoCorrida y el núcleo C2. Expone el catálogo
// provisional, el contrato de selección y una única resolución validada por SourceRef
// para conciliación y política Patagonia. No modifica líneas, mapper, serialización ni
// generación.
import {
  aplicarSeleccionesLiquidacionPatagonia,
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  resuelto,
  sinResolucion,
  type AplicacionSeleccionesLiquidacionPatagonia,
  type CantidadSeleccionadaPatagonia,
  type CodigoTipoLiquidacionPatagoniaProvisional,
  type ErrorSeleccionLiquidacionPatagonia,
  type LiquidacionPatagoniaPendiente,
  type PagoPatagonia,
  type PoliticaPatagonia,
  type SeleccionLiquidacionPatagoniaValidada,
} from '../banks/patagonia-b2';
import { clasificarBanco } from '../domain/destino';
import { claveRef } from '../domain/incidencias';
import type { PayrollLine } from '../domain/liquidacion';
import type { PoliticaLiquidaciones } from '../reconciliation';
import type { Result } from '../shared/result';
import type { EstadoCorrida } from './corrida';

export { CATALOGO_TIPOS_LIQUIDACION_PATAGONIA };
export type { AplicacionSeleccionesLiquidacionPatagonia, LiquidacionPatagoniaPendiente };

/**
 * Única representación persistida en memoria de una aplicación C2 válida. No conserva las
 * líneas: solo selección documental, cobertura mínima y pendientes de la huella vigente.
 */
export interface SnapshotSeleccionLiquidacionPatagonia {
  readonly huellaFinnegans: string;
  readonly seleccionesValidadas: readonly SeleccionLiquidacionPatagoniaValidada[];
  readonly cantidadesAfectadas: readonly CantidadSeleccionadaPatagonia[];
  readonly pendientes: readonly LiquidacionPatagoniaPendiente[];
}

/** Selección ya validada, indexada por la `SourceRef` exacta que cubrió C2. */
export interface SeleccionValidadaPorRefPatagonia {
  readonly descripcionOriginal: string;
  readonly destino: 'PATAGONIA_B2';
  readonly codigoTipoLiquidacion: CodigoTipoLiquidacionPatagoniaProvisional;
}

/**
 * Única resolución compartida por conciliación y evaluación bancaria. El índice solo
 * contiene referencias de filas Patagonia que C2 volvió a validar contra la huella vigente.
 */
export interface ResolucionSeleccionLiquidacionPatagonia {
  readonly huellaFinnegans: string;
  readonly porRef: ReadonlyMap<string, SeleccionValidadaPorRefPatagonia>;
}

export interface AplicacionSeleccionLiquidacionPatagoniaCorrida {
  readonly estado: EstadoCorrida;
  readonly aplicacion: AplicacionSeleccionesLiquidacionPatagonia;
}

export type ErrorSeleccionLiquidacionPatagoniaCorrida =
  | ErrorSeleccionLiquidacionPatagonia
  | { readonly codigo: 'FINNEGANS_AUSENTE' }
  | { readonly codigo: 'HUELLA_FINNEGANS_AUSENTE' };

/**
 * Entrega controles desconocidos al núcleo junto con las líneas y huella vigentes. Esta
 * consulta pura no altera EstadoCorrida y también se usa para preparar la lista de la UI.
 */
export function seleccionarLiquidacionesPatagoniaCorrida(
  estado: EstadoCorrida,
  entrada: unknown,
): Result<
  AplicacionSeleccionesLiquidacionPatagonia,
  readonly ErrorSeleccionLiquidacionPatagoniaCorrida[]
> {
  if (estado.finnegans === null) {
    return { ok: false, error: [{ codigo: 'FINNEGANS_AUSENTE' }] };
  }
  if (estado.huellaFinnegans === null) {
    return { ok: false, error: [{ codigo: 'HUELLA_FINNEGANS_AUSENTE' }] };
  }
  return aplicarSeleccionesLiquidacionPatagonia(
    { huellaFinnegans: estado.huellaFinnegans, lineas: estado.finnegans.lineas },
    entrada,
  );
}

function snapshotDe(
  aplicacion: AplicacionSeleccionesLiquidacionPatagonia,
): SnapshotSeleccionLiquidacionPatagonia {
  return {
    huellaFinnegans: aplicacion.huellaFinnegans,
    seleccionesValidadas: aplicacion.seleccionesValidadas,
    cantidadesAfectadas: aplicacion.cantidadesAfectadas,
    pendientes: aplicacion.pendientes,
  };
}

/**
 * Valida nuevamente con C2 y, solo ante éxito total, devuelve una corrida nueva cuyo
 * snapshot reemplaza por completo al anterior. La aplicación conserva las mismas líneas
 * por identidad, pero el snapshot no las duplica.
 */
export function aplicarSeleccionesLiquidacionPatagoniaCorrida(
  estado: EstadoCorrida,
  entrada: unknown,
): Result<
  AplicacionSeleccionLiquidacionPatagoniaCorrida,
  readonly ErrorSeleccionLiquidacionPatagoniaCorrida[]
> {
  const aplicacion = seleccionarLiquidacionesPatagoniaCorrida(estado, entrada);
  if (!aplicacion.ok) return aplicacion;
  const snapshot = snapshotDe(aplicacion.value);
  return {
    ok: true,
    value: {
      estado: { ...estado, seleccionLiquidacionPatagonia: snapshot },
      aplicacion: aplicacion.value,
    },
  };
}

/** Invalida explícitamente una decisión aplicada cuando el formulario vuelve a ser borrador. */
export function invalidarSeleccionLiquidacionPatagoniaCorrida(
  estado: EstadoCorrida,
): EstadoCorrida {
  return estado.seleccionLiquidacionPatagonia === null
    ? estado
    : { ...estado, seleccionLiquidacionPatagonia: null };
}

const SIN_RESOLUCION = { estado: 'SIN_RESOLUCION' } as const;
const SELECCION_EXPLICITA_VALIDADA = { estado: 'SELECCION_EXPLICITA_VALIDADA' } as const;

function mismoSnapshot(
  snapshot: SnapshotSeleccionLiquidacionPatagonia,
  recalculo: AplicacionSeleccionesLiquidacionPatagonia,
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

function lineasPatagoniaPorRef(lineas: readonly PayrollLine[]): ReadonlyMap<string, PayrollLine> {
  const resultado = new Map<string, PayrollLine>();
  for (const linea of lineas) {
    const banco = clasificarBanco(linea.bancoFinnegans);
    if (banco.tipo !== 'CATALOGADO' || banco.banco.destino !== 'PATAGONIA_B2') continue;
    resultado.set(claveRef(linea.ref), linea);
  }
  return resultado;
}

/**
 * Resolución única C5-A. No confía en la huella guardada en el snapshot: exige que
 * coincida con la huella vigente recibida, revalida el snapshot completo con C2 y
 * construye un solo índice por `SourceRef` con descripción original y destino exactos.
 * Devuelve `null` ante cualquier ausencia o inconsistencia; nunca resuelve parcialmente.
 */
export function resolverSeleccionLiquidacionPatagonia(
  snapshot: SnapshotSeleccionLiquidacionPatagonia | null,
  huellaFinnegans: string,
  lineas: readonly PayrollLine[],
): ResolucionSeleccionLiquidacionPatagonia | null {
  if (snapshot === null || huellaFinnegans.trim() === '') return null;
  if (snapshot.huellaFinnegans !== huellaFinnegans) return null;
  if (
    snapshot.seleccionesValidadas.some((seleccion) => seleccion.huellaFinnegans !== huellaFinnegans)
  ) {
    return null;
  }

  const recalculo = aplicarSeleccionesLiquidacionPatagonia(
    { huellaFinnegans, lineas },
    snapshot.seleccionesValidadas,
  );
  if (!recalculo.ok || !mismoSnapshot(snapshot, recalculo.value)) return null;

  const seleccionPorDescripcion = new Map(
    recalculo.value.seleccionesValidadas.map(
      (seleccion) => [seleccion.descripcionOriginal, seleccion] as const,
    ),
  );
  const lineasPatagonia = lineasPatagoniaPorRef(lineas);
  const porRef = new Map<string, SeleccionValidadaPorRefPatagonia>();

  for (const cantidad of recalculo.value.cantidadesAfectadas) {
    if (cantidad.cantidadFilasPatagonia !== cantidad.refs.length) return null;
    const seleccion = seleccionPorDescripcion.get(cantidad.descripcionOriginal);
    if (seleccion === undefined) return null;
    if (seleccion.huellaFinnegans !== huellaFinnegans) return null;
    for (const ref of cantidad.refs) {
      const clave = claveRef(ref);
      const linea = lineasPatagonia.get(clave);
      if (linea === undefined) return null;
      if (
        linea.descripcion.descripcionOriginal !== cantidad.descripcionOriginal ||
        porRef.has(clave)
      ) {
        return null;
      }
      porRef.set(clave, {
        descripcionOriginal: cantidad.descripcionOriginal,
        destino: 'PATAGONIA_B2',
        codigoTipoLiquidacion: seleccion.codigoTipoLiquidacion,
      });
    }
  }

  return { huellaFinnegans, porRef };
}

/**
 * Política Patagonia derivada de una resolución ya validada. Solo resuelve
 * `tipoLiquidacion`; el resto de los puntos conserva la política productiva.
 */
export function politicaPatagoniaDesdeSeleccionPatagonia(
  snapshot: SnapshotSeleccionLiquidacionPatagonia | null,
  huellaFinnegans: string,
  lineas: readonly PayrollLine[],
): PoliticaPatagonia {
  const resolucion = resolverSeleccionLiquidacionPatagonia(snapshot, huellaFinnegans, lineas);
  if (resolucion === null) return POLITICA_PATAGONIA_PRODUCTIVA;

  return {
    ...POLITICA_PATAGONIA_PRODUCTIVA,
    tipoLiquidacion: (pago: PagoPatagonia) => {
      const seleccion = resolucion.porRef.get(claveRef(pago.ref));
      if (seleccion === undefined) return sinResolucion('PAT-7/P-09/P-10');
      if (seleccion.descripcionOriginal !== pago.descripcion.descripcionOriginal) {
        return sinResolucion('PAT-7/P-09/P-10');
      }
      return resuelto(seleccion.codigoTipoLiquidacion);
    },
  };
}

/**
 * Política pura C4-A2. Revalida el snapshot completo con C2 contra las líneas y huella
 * vigentes antes de reconocer cobertura. Una incoherencia invalida el snapshot entero.
 * Consume la misma resolución que la política Patagonia C5-A.
 */
export function politicaLiquidacionesDesdeSeleccionPatagonia(
  estado: EstadoCorrida,
): PoliticaLiquidaciones {
  const snapshot = estado.seleccionLiquidacionPatagonia;
  if (snapshot === null || estado.finnegans === null || estado.huellaFinnegans === null) {
    return { resolver: () => SIN_RESOLUCION };
  }
  const resolucion = resolverSeleccionLiquidacionPatagonia(
    snapshot,
    estado.huellaFinnegans,
    estado.finnegans.lineas,
  );
  if (resolucion === null) {
    return { resolver: () => SIN_RESOLUCION };
  }

  return {
    resolver: (linea, destino) => {
      if (destino !== 'PATAGONIA_B2') return SIN_RESOLUCION;
      const seleccion = resolucion.porRef.get(claveRef(linea.ref));
      if (seleccion === undefined) return SIN_RESOLUCION;
      return seleccion.descripcionOriginal === linea.descripcion.descripcionOriginal
        ? SELECCION_EXPLICITA_VALIDADA
        : SIN_RESOLUCION;
    },
  };
}
