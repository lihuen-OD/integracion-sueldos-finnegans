// Ayudas para los tests de conciliación: escenarios sintéticos → parsers reales → conciliar.
import type { BancoCatalogado } from '../../../src/domain/destino';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import {
  conciliar,
  type FilaConciliada,
  type PoliticaLiquidaciones,
  type ResultadoConciliacion,
} from '../../../src/reconciliation';
import {
  finnegansLibro,
  maestroLibro,
  personas,
  type FilaFinnegans,
  type OpcionesLibro,
  type OpcionesMaestro,
  type PersonaSintetica,
  type RegistroMaestro,
} from '../../fixtures/synthetic/escenarios.ts';

/** Doble de test: todas las liquidaciones con mapeo aprobado. NUNCA se usa en producción. */
export const TODO_MAPEADO: PoliticaLiquidaciones = { tieneMapeoAprobado: () => true };

export interface OpcionesEscenario {
  readonly finnegans?: OpcionesLibro;
  readonly maestro?: OpcionesMaestro;
  /** Por defecto TODO_MAPEADO, para aislar cada regla; `null` = política de producción. */
  readonly liquidaciones?: PoliticaLiquidaciones | null;
  readonly catalogoBancos?: readonly BancoCatalogado[];
}

export function escenario(
  filas: readonly FilaFinnegans[],
  registros: readonly RegistroMaestro[],
  opciones: OpcionesEscenario = {},
): ResultadoConciliacion {
  const liquidaciones =
    opciones.liquidaciones === undefined ? TODO_MAPEADO : opciones.liquidaciones;
  return conciliar({
    finnegans: parseFinnegans(finnegansLibro(filas, opciones.finnegans)),
    maestro: parseMaestro(maestroLibro(registros, opciones.maestro)),
    ...(liquidaciones === null ? {} : { liquidaciones }),
    ...(opciones.catalogoBancos === undefined ? {} : { catalogoBancos: opciones.catalogoBancos }),
  });
}

export function gente(cantidad: number, semilla: number): (indice: number) => PersonaSintetica {
  const lista = personas(cantidad, semilla);
  return (indice) => {
    const persona = lista[indice];
    if (persona === undefined) {
      throw new Error('persona sintética inexistente');
    }
    return persona;
  };
}

/** `CODIGO:NIVEL:ALCANCE` de cada incidencia de la fila, para aserciones compactas. */
export function resumen(fila: FilaConciliada | undefined): string[] {
  return (fila?.incidencias ?? []).map((i) => `${i.codigo}:${i.nivel}:${i.alcance}`);
}

export function primera(resultado: ResultadoConciliacion): FilaConciliada {
  const [fila] = resultado.filas;
  if (fila === undefined) {
    throw new Error('sin filas');
  }
  return fila;
}
