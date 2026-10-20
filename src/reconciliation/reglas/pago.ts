// Reglas de banco sobre los datos de la fila de Finnegans (docs/03 §E.2 reglas 6, 14, 17 y 19).
// Solo se aplican a filas con destino determinado; su alcance es ese destino.
import type { Incidencia } from '../../domain/incidencias';
import { aTextoDecimal, esNegativo, restar, sumar } from '../../domain/money';
import { nuevaIncidencia } from '../incidencia';
import type { PoliticaLiquidaciones } from '../tipos';
import type { FilaConDestino } from './contexto';

/** Regla 6 (D-047): neto negativo → BLOQUEANTE. El máximo por layout NO se controla en F2. */
export function reglaNetoNegativo({ linea, destino }: FilaConDestino): Incidencia[] {
  if (linea.neto === null || !esNegativo(linea.neto)) {
    return [];
  }
  return [
    nuevaIncidencia('NETO_NEGATIVO', 'BLOQUEANTE', destino, [linea.ref], {
      campo: 'Neto',
      valores: { finnegans: aTextoDecimal(linea.neto) },
    }),
  ];
}

/**
 * Regla 14 (D-026): sin mapeo aprobado del tipo de liquidación → BLOQUEANTE del banco. En F2 no
 * hay mapeos ni regla de clasificación (P-09, P-10): nunca se inventa un código.
 */
export function reglaLiquidacion(
  { linea, destino }: FilaConDestino,
  politica: PoliticaLiquidaciones,
): Incidencia[] {
  if (politica.tieneMapeoAprobado(linea.descripcion, destino)) {
    return [];
  }
  return [
    nuevaIncidencia('LIQUIDACION_SIN_MAPEO', 'BLOQUEANTE', destino, [linea.ref], {
      campo: 'Descripcion',
      motivo: linea.descripcion.clasificacion.estado,
      valores: { finnegans: linea.descripcion.descripcionOriginal },
    }),
  ];
}

/** Regla 17 (D-047): Remunerativo + No remunerativo − Descuento ≠ Neto → REQUIERE_REVISION. */
export function reglaComponentes({ linea, destino }: FilaConDestino): Incidencia[] {
  const { remunerativo, noRemunerativo, descuento } = linea.componentes;
  if (
    linea.neto === null ||
    remunerativo === null ||
    noRemunerativo === null ||
    descuento === null
  ) {
    return [];
  }
  const calculado = restar(sumar(remunerativo, noRemunerativo), descuento);
  if (calculado === linea.neto) {
    return [];
  }
  return [
    nuevaIncidencia('NETO_NO_CUADRA_COMPONENTES', 'REQUIERE_REVISION', destino, [linea.ref], {
      campo: 'Neto',
      valores: {
        finnegans: `${aTextoDecimal(remunerativo)} + ${aTextoDecimal(noRemunerativo)} − ${aTextoDecimal(descuento)} = ${aTextoDecimal(calculado)}; Neto = ${aTextoDecimal(linea.neto)}`,
      },
    }),
  ];
}

/** Regla 19 (D-047): `Legajoapellidonombre` no empieza con `Legajo + " - "` → INFORMACION. */
export function reglaLegajoNombre({ linea, destino }: FilaConDestino): Incidencia[] {
  if (linea.legajo === null || linea.legajoApellidoNombre.startsWith(`${linea.legajo} - `)) {
    return [];
  }
  return [
    nuevaIncidencia('LEGAJO_NOMBRE_INCONSISTENTE', 'INFORMACION', destino, [linea.ref], {
      campo: 'Legajoapellidonombre',
    }),
  ];
}
