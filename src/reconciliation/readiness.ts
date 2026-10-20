// Readiness independiente por banco (docs/03 §G.3, D-032). Una incidencia exclusiva de un banco
// solo afecta a ese banco; la conciliación global no cerrada (p. ej. una fila con pago y sin
// destino) afecta a ambos, porque esa fila podría terminar en cualquiera (P-24). Por eso se
// evalúa antes que SIN_REGISTROS: un banco sin filas solo es SIN_REGISTROS con la conciliación
// global CERRADA (D-057).
// En F2 ningún generador está habilitado ni hay perfil/parámetros (F3): en producción ningún
// banco llega a LISTO_PARA_GENERAR, y toda salida queda PENDIENTE DE HOMOLOGACION (D-029).
import type { Destino } from '../domain/destino';
import type { Totales } from './totales';
import type { ResultadoConciliacion } from './tipos';

/** En el orden de evaluación (docs/03 §G.3 con la precedencia de D-057). */
export type EstadoReadiness =
  | 'BLOQUEADO_POR_CONCILIACION_GLOBAL'
  | 'SIN_REGISTROS'
  | 'BLOQUEADO'
  | 'REQUIERE_REVISION'
  | 'CONFIGURACION_INCOMPLETA'
  | 'GENERADOR_NO_HABILITADO'
  | 'LISTO_PARA_GENERAR';

export type MotivoReadiness =
  | 'CONCILIACION_GLOBAL_NO_CERRADA'
  | 'SIN_REGISTROS'
  | 'BLOQUEANTES_DEL_BANCO'
  | 'REVISIONES_DEL_BANCO_SIN_RESOLVER'
  | 'CONFIGURACION_INCOMPLETA'
  | 'GENERADOR_NO_HABILITADO';

export interface BankReadiness<D extends Destino> {
  readonly destino: D;
  readonly estado: EstadoReadiness;
  /** Todas las filas asignadas a este banco (no hay exportaciones parciales). */
  readonly asignadas: Totales;
  readonly bloqueantes: number;
  readonly revisionesSinResolver: number;
  /** Todas las condiciones que impiden generar, en el orden de evaluación. */
  readonly motivos: readonly MotivoReadiness[];
  /** Siempre true hasta la homologación bancaria (D-010, D-029). */
  readonly pendienteHomologacion: true;
}

export type BnaReadiness = BankReadiness<'BNA_GT_HABERES'>;
export type PatagoniaReadiness = BankReadiness<'PATAGONIA_B2'>;

export interface ContextoReadiness {
  /** Perfil de empresa y parámetros de envío completos para el banco (F3). */
  readonly configuracionCompleta: Readonly<Record<Destino, boolean>>;
  /** Generador habilitado: ningún campo BLOQUEADA en su contrato (F5/F6, docs/04 §7). */
  readonly generadorHabilitado: Readonly<Record<Destino, boolean>>;
}

/** Único contexto de producción en F2: sin configuración ni generadores. */
export const CONTEXTO_F2: ContextoReadiness = {
  configuracionCompleta: { BNA_GT_HABERES: false, PATAGONIA_B2: false },
  generadorHabilitado: { BNA_GT_HABERES: false, PATAGONIA_B2: false },
};

const ESTADO_POR_MOTIVO: Readonly<Record<MotivoReadiness, EstadoReadiness>> = {
  CONCILIACION_GLOBAL_NO_CERRADA: 'BLOQUEADO_POR_CONCILIACION_GLOBAL',
  SIN_REGISTROS: 'SIN_REGISTROS',
  BLOQUEANTES_DEL_BANCO: 'BLOQUEADO',
  REVISIONES_DEL_BANCO_SIN_RESOLVER: 'REQUIERE_REVISION',
  CONFIGURACION_INCOMPLETA: 'CONFIGURACION_INCOMPLETA',
  GENERADOR_NO_HABILITADO: 'GENERADOR_NO_HABILITADO',
};

function readinessDe<D extends Destino>(
  destino: D,
  resultado: ResultadoConciliacion,
  contexto: ContextoReadiness,
): BankReadiness<D> {
  const asignadas =
    destino === 'BNA_GT_HABERES' ? resultado.global.bna : resultado.global.patagonia;
  const delBanco = resultado.incidencias.filter(
    (incidencia) => incidencia.alcance === destino && incidencia.resolucion === undefined,
  );
  const bloqueantes = delBanco.filter((i) => i.nivel === 'BLOQUEANTE').length;
  const revisionesSinResolver = delBanco.filter((i) => i.nivel === 'REQUIERE_REVISION').length;
  const condiciones: readonly [MotivoReadiness, boolean][] = [
    ['CONCILIACION_GLOBAL_NO_CERRADA', resultado.global.estado !== 'CERRADA'],
    ['SIN_REGISTROS', asignadas.cantidad === 0],
    ['BLOQUEANTES_DEL_BANCO', bloqueantes > 0],
    ['REVISIONES_DEL_BANCO_SIN_RESOLVER', revisionesSinResolver > 0],
    ['CONFIGURACION_INCOMPLETA', !contexto.configuracionCompleta[destino]],
    ['GENERADOR_NO_HABILITADO', !contexto.generadorHabilitado[destino]],
  ];
  const motivos = condiciones.filter(([, falla]) => falla).map(([motivo]) => motivo);
  const [primero] = motivos;
  return {
    destino,
    estado: primero === undefined ? 'LISTO_PARA_GENERAR' : ESTADO_POR_MOTIVO[primero],
    asignadas,
    bloqueantes,
    revisionesSinResolver,
    motivos,
    pendienteHomologacion: true,
  };
}

/** Readiness de cada banco, evaluada por separado sobre la misma conciliación. */
export function evaluarReadiness(
  resultado: ResultadoConciliacion,
  contexto: ContextoReadiness = CONTEXTO_F2,
): { readonly bna: BnaReadiness; readonly patagonia: PatagoniaReadiness } {
  return {
    bna: readinessDe('BNA_GT_HABERES', resultado, contexto),
    patagonia: readinessDe('PATAGONIA_B2', resultado, contexto),
  };
}
