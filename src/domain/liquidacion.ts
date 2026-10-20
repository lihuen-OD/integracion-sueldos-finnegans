// Liquidación de Finnegans normalizada (docs/03 §A y §H). Una `PayrollLine` por fila de datos,
// también las inválidas: cuil y neto pueden ser nulos para poder representarlas y conciliarlas
// (D-045). El archivo original nunca se modifica.
import type { Cuil } from './cuil';
import type { Hallazgo, SourceRef } from './incidencias';
import type { Centavos } from './money';

/**
 * Período y tipo de liquidación (D-037). La regla de extracción está PENDIENTE (P-10): en F2
 * toda descripción queda en `REGLA_PENDIENTE` y no se infiere nada de su texto.
 */
export type ClasificacionLiquidacion =
  | { readonly estado: 'REGLA_PENDIENTE' }
  | {
      readonly estado: 'CLASIFICADA';
      readonly periodo: string;
      readonly tipoLiquidacionNormalizado: string;
    };

export interface DescripcionLiquidacion {
  /** Siempre, tal cual vino (sin trim ni cambio de mayúsculas). */
  readonly descripcionOriginal: string;
  readonly clasificacion: ClasificacionLiquidacion;
}

export function descripcionSinClasificar(descripcionOriginal: string): DescripcionLiquidacion {
  return { descripcionOriginal, clasificacion: { estado: 'REGLA_PENDIENTE' } };
}

/** Componentes del neto, solo para el control de integridad (§E.2 regla 17). */
export interface ComponentesNeto {
  readonly remunerativo: Centavos | null;
  readonly noRemunerativo: Centavos | null;
  readonly descuento: Centavos | null;
}

export interface PayrollLine {
  /** Fila de Finnegans (archivo, hoja y fila). */
  readonly ref: SourceRef;
  /** Texto original de `Cuil` ('' si vacío; texto numérico si la celda era número). */
  readonly cuilTexto: string;
  /** CUIL canónico (N-02 + DV), o null si es inválido o la celda no era texto. */
  readonly cuil: Cuil | null;
  /** Legajo exacto, sin trim (D-017, D-046); null si la celda era ilegible (número, fórmula…). */
  readonly legajo: string | null;
  readonly apellido: string;
  readonly nombre: string;
  /** Texto original de `Banco` ('' si vacío); null si la celda era ilegible. */
  readonly bancoFinnegans: string | null;
  /** null si no es interpretable (IMPORTE_INVALIDO). */
  readonly neto: Centavos | null;
  readonly componentes: ComponentesNeto;
  readonly descripcion: DescripcionLiquidacion;
  readonly legajoApellidoNombre: string;
}

export interface LecturaFinnegans {
  /** Hoja reconocida como liquidación, o null si no se encontró una única hoja válida. */
  readonly hoja: string | null;
  readonly lineas: readonly PayrollLine[];
  readonly hallazgos: readonly Hallazgo[];
}
