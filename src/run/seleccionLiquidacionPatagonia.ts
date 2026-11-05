// Adaptador puro C3 entre EstadoCorrida y el núcleo C2. Expone a la interfaz únicamente
// el catálogo provisional y el contrato de selección; no conecta conciliación, mapper,
// serialización ni generación.
import {
  aplicarSeleccionesLiquidacionPatagonia,
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  type AplicacionSeleccionesLiquidacionPatagonia,
  type CantidadSeleccionadaPatagonia,
  type ErrorSeleccionLiquidacionPatagonia,
  type LiquidacionPatagoniaPendiente,
  type SeleccionLiquidacionPatagoniaValidada,
} from '../banks/patagonia-b2';
import { claveRef } from '../domain/incidencias';
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

/**
 * Política pura C4-A2. Revalida el snapshot completo con C2 contra las líneas y huella
 * vigentes antes de reconocer cobertura. Una incoherencia invalida el snapshot entero.
 */
export function politicaLiquidacionesDesdeSeleccionPatagonia(
  estado: EstadoCorrida,
): PoliticaLiquidaciones {
  const snapshot = estado.seleccionLiquidacionPatagonia;
  if (
    snapshot === null ||
    estado.finnegans === null ||
    estado.huellaFinnegans === null ||
    snapshot.huellaFinnegans !== estado.huellaFinnegans
  ) {
    return { resolver: () => SIN_RESOLUCION };
  }
  const recalculo = aplicarSeleccionesLiquidacionPatagonia(
    { huellaFinnegans: estado.huellaFinnegans, lineas: estado.finnegans.lineas },
    snapshot.seleccionesValidadas,
  );
  if (!recalculo.ok || !mismoSnapshot(snapshot, recalculo.value)) {
    return { resolver: () => SIN_RESOLUCION };
  }

  const refsPorDescripcion = new Map(
    recalculo.value.cantidadesAfectadas.map((cantidad) => [
      cantidad.descripcionOriginal,
      new Set(cantidad.refs.map(claveRef)),
    ]),
  );
  const descripcionesSeleccionadas = new Set(
    recalculo.value.seleccionesValidadas.map((seleccion) => seleccion.descripcionOriginal),
  );
  return {
    resolver: (linea, destino) => {
      if (destino !== 'PATAGONIA_B2') return SIN_RESOLUCION;
      const descripcion = linea.descripcion.descripcionOriginal;
      if (!descripcionesSeleccionadas.has(descripcion)) return SIN_RESOLUCION;
      return refsPorDescripcion.get(descripcion)?.has(claveRef(linea.ref)) === true
        ? SELECCION_EXPLICITA_VALIDADA
        : SIN_RESOLUCION;
    },
  };
}
