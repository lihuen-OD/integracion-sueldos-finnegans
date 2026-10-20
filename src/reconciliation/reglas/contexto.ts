// Contexto de una fila con destino determinado, para las reglas de banco (docs/03 §E.2).
import type { BancoCatalogado, Destino } from '../../domain/destino';
import type { PayrollLine } from '../../domain/liquidacion';

export interface FilaConDestino {
  readonly linea: PayrollLine;
  readonly destino: Destino;
  /**
   * Entrada del catálogo con la entidad esperada para el destino: la que coincidió con `Banco`
   * o, si el destino lo asignó el operador, la del catálogo para ese destino.
   */
  readonly banco: BancoCatalogado | undefined;
}
