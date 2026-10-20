// Reglas sobre registros del maestro que ninguna fila con destino usa (docs/03 §B.3 y §E.2
// regla 8): se informan, nunca bloquean un pago que no los usa (D-047, D-048).
import type { Cuil } from '../../domain/cuil';
import type { Incidencia } from '../../domain/incidencias';
import type { MasterRecord } from '../../domain/maestro';
import { nuevaIncidencia } from '../incidencia';
import { camposBancarios, codigoInvalido } from './cruce';

/** Regla 8 (D-018): registro del maestro sin liquidación en Finnegans → INFORMACION. */
export function reglaMaestroSinLiquidacion(
  registro: MasterRecord,
  cuilesFinnegans: ReadonlySet<Cuil>,
): Incidencia[] {
  if (registro.cuil === null || cuilesFinnegans.has(registro.cuil)) {
    return [];
  }
  return [
    nuevaIncidencia('MAESTRO_SIN_LIQUIDACION', 'INFORMACION', 'GLOBAL', [registro.ref], {
      campo: 'CUIL',
      valores: { maestro: registro.cuilTexto },
    }),
  ];
}

/**
 * Campos inválidos de un registro que no se evaluó contra ningún destino (sin uso, solo usado por
 * filas excluidas o pendientes, o duplicado): INFORMACION, para que el maestro pueda corregirse.
 */
export function reglaCamposSinEvaluar(registro: MasterRecord): Incidencia[] {
  return camposBancarios(registro).flatMap(([campo, valor]) =>
    valor.estado === 'INVALIDO'
      ? [
          nuevaIncidencia(codigoInvalido(campo), 'INFORMACION', 'GLOBAL', [registro.ref], {
            campo,
            motivo: valor.motivo,
            valores: { maestro: valor.texto },
          }),
        ]
      : [],
  );
}
