// Reglas que determinan el estado de una fila (docs/03 §E.2 reglas 4, 10 y 11; §G.1).
import { clasificarBanco, type BancoCatalogado } from '../../domain/destino';
import type { Incidencia } from '../../domain/incidencias';
import type { PayrollLine } from '../../domain/liquidacion';
import { esCero } from '../../domain/money';
import { nuevaIncidencia } from '../incidencia';
import type { EstadoFila } from '../tipos';

export interface EstadoInicial {
  readonly estado: EstadoFila;
  /** Entrada del catálogo que asignó el destino, si salió de `Banco`. */
  readonly banco?: BancoCatalogado;
  readonly incidencias: readonly Incidencia[];
}

/**
 * Regla 4 (D-016, D-034): neto exactamente cero → EXCLUIDA(NETO_CERO), INFORMACION. No se le
 * exige maestro ni datos bancarios. Un neto ilegible no es cero: nunca se excluye por inferencia.
 */
export function reglaNetoCero(linea: PayrollLine): EstadoInicial | null {
  if (linea.neto === null || !esCero(linea.neto)) {
    return null;
  }
  return {
    estado: { estado: 'EXCLUIDA', motivo: 'NETO_CERO' },
    incidencias: [
      nuevaIncidencia('NETO_CERO', 'INFORMACION', 'GLOBAL', [linea.ref], { campo: 'Neto' }),
    ],
  };
}

/**
 * Reglas 10 y 11 (D-013, D-014, D-049): `Banco` contra el catálogo cerrado, sin fuzzy matching.
 * Vacío → PENDIENTE y REQUIERE_REVISION global (el operador indica el destino). Fuera de
 * catálogo o ilegible → PENDIENTE y BLOQUEANTE global; nunca se reasigna.
 */
export function reglaBanco(
  linea: PayrollLine,
  catalogo: readonly BancoCatalogado[],
): EstadoInicial {
  const clasificacion = clasificarBanco(linea.bancoFinnegans, catalogo);
  const valores = { finnegans: linea.bancoFinnegans ?? '' };
  switch (clasificacion.tipo) {
    case 'CATALOGADO':
      return {
        estado: {
          estado: 'INCLUIDA',
          destino: clasificacion.banco.destino,
          origen: 'BANCO_FINNEGANS',
        },
        banco: clasificacion.banco,
        incidencias: [],
      };
    case 'VACIO':
      return {
        estado: { estado: 'PENDIENTE', motivo: 'BANCO_VACIO' },
        incidencias: [
          nuevaIncidencia('BANCO_VACIO', 'REQUIERE_REVISION', 'GLOBAL', [linea.ref], {
            campo: 'Banco',
            valores,
          }),
        ],
      };
    case 'NO_SOPORTADO':
      return {
        estado: { estado: 'PENDIENTE', motivo: 'BANCO_NO_SOPORTADO' },
        incidencias: [
          nuevaIncidencia('BANCO_NO_SOPORTADO', 'BLOQUEANTE', 'GLOBAL', [linea.ref], {
            campo: 'Banco',
            motivo: linea.bancoFinnegans === null ? 'CELDA_ILEGIBLE' : 'FUERA_DE_CATALOGO',
            valores,
          }),
        ],
      };
  }
}
