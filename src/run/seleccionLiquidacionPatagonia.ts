// Adaptador puro C3 entre EstadoCorrida y el núcleo C2. Expone a la interfaz únicamente
// el catálogo provisional y el contrato de selección; no conecta conciliación, mapper,
// serialización ni generación.
import {
  aplicarSeleccionesLiquidacionPatagonia,
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  type AplicacionSeleccionesLiquidacionPatagonia,
  type ErrorSeleccionLiquidacionPatagonia,
  type LiquidacionPatagoniaPendiente,
} from '../banks/patagonia-b2';
import type { Result } from '../shared/result';
import type { EstadoCorrida } from './corrida';

export { CATALOGO_TIPOS_LIQUIDACION_PATAGONIA };
export type { AplicacionSeleccionesLiquidacionPatagonia, LiquidacionPatagoniaPendiente };

export type ErrorSeleccionLiquidacionPatagoniaCorrida =
  | ErrorSeleccionLiquidacionPatagonia
  | { readonly codigo: 'FINNEGANS_AUSENTE' }
  | { readonly codigo: 'HUELLA_FINNEGANS_AUSENTE' };

/**
 * Entrega controles desconocidos al núcleo junto con las líneas y huella vigentes. El
 * resultado no se incorpora a EstadoCorrida: queda como estado efímero de la interfaz.
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
