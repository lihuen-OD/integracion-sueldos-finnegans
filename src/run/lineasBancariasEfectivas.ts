// Vista bancaria EFECTIVA de una corrida para las selecciones técnicas de haberes.
//
// Una fila con `Banco` vacío no pertenece a ningún destino hasta que una decisión
// `ASIGNAR_DESTINO` válida del operador la incorpora a uno. La conciliación ya aplica esa
// decisión, pero las selecciones BNA/Patagonia indexaban únicamente las filas cuyo banco
// original ya estaba catalogado. Este módulo construye, sin mutar nada, una copia de las
// líneas donde SOLO esas filas reasignadas expresan el destino decidido.
//
// No interpreta descripciones, no asigna códigos y no reemplaza la decisión: reutiliza el
// mismo `decisionVigente` de F2 (misma incidencia, mismos valores observados y misma huella)
// para que una decisión vencida o en conflicto no amplíe la cobertura.
import { CATALOGO_BANCOS, clasificarBanco, type Destino } from '../domain/destino';
import { claveRef } from '../domain/incidencias';
import type { PayrollLine } from '../domain/liquidacion';
import { esCero } from '../domain/money';
import type { ResultadoConciliacion } from '../reconciliation';
import { conResolubilidad, decisionVigente, enConflicto } from '../reconciliation/decisiones';
import { nuevaIncidencia } from '../reconciliation/incidencia';
import type { EstadoCorrida } from './corrida';

/** Asignaciones válidas de filas con banco vacío, indexadas por `SourceRef` exacta. */
export type AsignacionesBancariasEfectivas = ReadonlyMap<string, Destino>;

function textoBancarioDe(destino: Destino): string {
  const banco = CATALOGO_BANCOS.find((entrada) => entrada.destino === destino);
  if (banco === undefined) {
    throw new Error(`Destino sin banco catalogado: ${destino}`);
  }
  return banco.textoFinnegans;
}

function esFilaPagable(linea: PayrollLine): boolean {
  // Misma precedencia que la regla 4: un neto cero se excluye antes de mirar el banco.
  return linea.neto === null || !esCero(linea.neto);
}

function incidenciaBancoVacio(linea: PayrollLine, huellaFinnegans: string) {
  return conResolubilidad(
    nuevaIncidencia('BANCO_VACIO', 'REQUIERE_REVISION', 'GLOBAL', [linea.ref], {
      campo: 'Banco',
      valores: { finnegans: linea.bancoFinnegans ?? '' },
    }),
    linea,
    { finnegans: huellaFinnegans, maestro: '' },
  );
}

/**
 * Decisiones `ASIGNAR_DESTINO` vigentes de la corrida, por `SourceRef`. Solo considera filas
 * pagables con banco efectivamente vacío y las revalida con el mismo criterio que la
 * conciliación. Una decisión futura o no vigente no participa.
 */
export function asignacionesBancariasValidas(
  estado: EstadoCorrida,
): AsignacionesBancariasEfectivas {
  const huella = estado.huellaFinnegans;
  if (estado.finnegans === null || huella === null) {
    return new Map();
  }
  const conflicto = enConflicto(estado.decisiones);
  const asignaciones = new Map<string, Destino>();
  for (const linea of estado.finnegans.lineas) {
    if (!esFilaPagable(linea)) continue;
    if (clasificarBanco(linea.bancoFinnegans).tipo !== 'VACIO') continue;
    const incidencia = incidenciaBancoVacio(linea, huella);
    const decision = decisionVigente(incidencia, estado.decisiones, conflicto);
    if (decision?.tipo !== 'ASIGNAR_DESTINO') continue;
    asignaciones.set(claveRef(linea.ref), decision.destino);
  }
  return asignaciones;
}

function reasignada(
  linea: PayrollLine,
  destino: Destino,
  asignaciones: AsignacionesBancariasEfectivas,
): boolean {
  return asignaciones.get(claveRef(linea.ref)) === destino;
}

function aplicarAsignaciones(
  lineas: readonly PayrollLine[],
  destino: Destino,
  asignaciones: AsignacionesBancariasEfectivas,
): readonly PayrollLine[] {
  // Sin filas reasignadas se conserva la MISMA referencia: las lecturas no se copian de
  // más y los consumidores que comparan identidad siguen viendo la línea original.
  if (!lineas.some((linea) => reasignada(linea, destino, asignaciones))) {
    return lineas;
  }
  const texto = textoBancarioDe(destino);
  return lineas.map((linea) =>
    reasignada(linea, destino, asignaciones) ? { ...linea, bancoFinnegans: texto } : linea,
  );
}

/**
 * Líneas de la corrida vistas desde un destino, incluyendo las filas vacías que una decisión
 * válida incorporó a ese destino. El resto conserva su banco original intacto: una fila
 * reasignada a BNA no aparece como Patagonia, ni al revés.
 */
export function lineasBancariasEfectivas(
  estado: EstadoCorrida,
  destino: Destino,
): readonly PayrollLine[] {
  if (estado.finnegans === null) return [];
  return aplicarAsignaciones(
    estado.finnegans.lineas,
    destino,
    asignacionesBancariasValidas(estado),
  );
}

/**
 * Variante para las fachadas de generación: la evidencia ya está en el resultado de F2
 * (`origen: DECISION_OPERADOR`). No reinterpreta decisiones ni necesita el estado completo.
 */
export function lineasBancariasEfectivasDeConciliacion(
  conciliacion: ResultadoConciliacion,
  destino: Destino,
): readonly PayrollLine[] {
  const esReasignada = (fila: ResultadoConciliacion['filas'][number]): boolean =>
    fila.estado.estado === 'INCLUIDA' &&
    fila.estado.origen === 'DECISION_OPERADOR' &&
    fila.estado.destino === destino;
  if (!conciliacion.filas.some(esReasignada)) {
    return conciliacion.filas.map((fila) => fila.linea);
  }
  const texto = textoBancarioDe(destino);
  return conciliacion.filas.map((fila) =>
    esReasignada(fila) ? { ...fila.linea, bancoFinnegans: texto } : fila.linea,
  );
}
