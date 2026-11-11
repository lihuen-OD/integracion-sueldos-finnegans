// Resumen y filtros de la tabla de empleados: proyección pura de lo que el motor ya
// calculó (niveles, estados, incidencias). No crea estados de negocio ni decide destinos;
// solo agrupa conteos y permite encontrar filas para revisarlas.
import type { CodigoIncidencia } from '../domain/incidencias';
import type { FilaConciliada } from '../reconciliation';
import type { Tono } from './componentes';

export const FILTROS = [
  'TODOS',
  'ACCION',
  'BLOQUEANTES',
  'INFORMACION',
  'BNA',
  'PATAGONIA',
  'PENDIENTES',
  'EXCLUIDOS',
  'SIN_MAESTRO',
  'DATOS',
  'DUPLICADOS',
] as const;

export type FiltroEmpleados = (typeof FILTROS)[number];

export const ETIQUETA_FILTRO: Readonly<Record<FiltroEmpleados, string>> = {
  TODOS: 'Todos',
  ACCION: 'Requieren acción',
  BLOQUEANTES: 'Con bloqueos',
  INFORMACION: 'Informativos',
  BNA: 'Banco Nación',
  PATAGONIA: 'Banco Patagonia',
  PENDIENTES: 'Sin destino',
  EXCLUIDOS: 'Excluidos',
  SIN_MAESTRO: 'Nuevos o sin maestro',
  DATOS: 'Datos bancarios a revisar',
  DUPLICADOS: 'Datos duplicados',
};

const CODIGOS_DATOS_BANCARIOS: ReadonlySet<CodigoIncidencia> = new Set([
  'CBU_FALTANTE',
  'CBU_INVALIDO',
  'DATO_PATAGONIA_FALTANTE',
  'DATO_PATAGONIA_INVALIDO',
  'BANCO_INCOMPATIBLE_MAESTRO',
]);

const CODIGOS_DUPLICADOS: ReadonlySet<CodigoIncidencia> = new Set([
  'CUIL_REPETIDO_FINNEGANS',
  'CUIL_REPETIDO_MAESTRO',
  'LEGAJO_REPETIDO_MAESTRO',
]);

export function accionPendiente(fila: FilaConciliada): boolean {
  return fila.incidencias.some(
    (incidencia) => incidencia.resoluble !== undefined && incidencia.resolucion === undefined,
  );
}

function tieneCodigo(fila: FilaConciliada, codigos: ReadonlySet<CodigoIncidencia>): boolean {
  return fila.incidencias.some((incidencia) => codigos.has(incidencia.codigo));
}

export function tieneDatosBancariosARevisar(fila: FilaConciliada): boolean {
  return tieneCodigo(fila, CODIGOS_DATOS_BANCARIOS);
}

export function tieneDatosDuplicados(fila: FilaConciliada): boolean {
  return tieneCodigo(fila, CODIGOS_DUPLICADOS);
}

export function sinRegistroEnMaestro(fila: FilaConciliada): boolean {
  return fila.incidencias.some((incidencia) => incidencia.codigo === 'SIN_MAESTRO');
}

/** Fila incluida cuyos datos bancarios no tienen observaciones para revisar. */
export function datosBancariosCompletos(fila: FilaConciliada): boolean {
  return fila.estado.estado === 'INCLUIDA' && !tieneDatosBancariosARevisar(fila);
}

export function pasaFiltroEmpleado(fila: FilaConciliada, filtro: FiltroEmpleados): boolean {
  switch (filtro) {
    case 'TODOS':
      return true;
    case 'ACCION':
      return accionPendiente(fila);
    case 'BLOQUEANTES':
      return fila.nivel === 'BLOQUEANTE';
    case 'INFORMACION':
      return fila.nivel === 'INFORMACION';
    case 'BNA':
      return fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'BNA_GT_HABERES';
    case 'PATAGONIA':
      return fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'PATAGONIA_B2';
    case 'PENDIENTES':
      return fila.estado.estado === 'PENDIENTE';
    case 'EXCLUIDOS':
      return fila.estado.estado === 'EXCLUIDA';
    case 'SIN_MAESTRO':
      return sinRegistroEnMaestro(fila);
    case 'DATOS':
      return tieneDatosBancariosARevisar(fila);
    case 'DUPLICADOS':
      return tieneDatosDuplicados(fila);
  }
}

/** Busca por texto simple en legajo + nombre (búsqueda de utilidad de la pantalla). */
export function coincideBusqueda(fila: FilaConciliada, texto: string): boolean {
  if (texto.trim() === '') {
    return true;
  }
  const objetivo = `${fila.linea.legajo ?? ''} ${fila.linea.legajoApellidoNombre}`;
  return objetivo.toLowerCase().includes(texto.trim().toLowerCase());
}

export interface ResumenEmpleados {
  readonly total: number;
  readonly bna: number;
  readonly patagonia: number;
  readonly pendientes: number;
  readonly excluidos: number;
  readonly conBloqueos: number;
  readonly requierenAccion: number;
  readonly sinMaestro: number;
  readonly datosBancariosARevisar: number;
  readonly datosCompletos: number;
  readonly duplicados: number;
}

/** Conteos de la tabla, todos derivados de las filas conciliadas. */
export function resumirEmpleados(filas: readonly FilaConciliada[]): ResumenEmpleados {
  let bna = 0;
  let patagonia = 0;
  let pendientes = 0;
  let excluidos = 0;
  let conBloqueos = 0;
  let requierenAccion = 0;
  let sinMaestro = 0;
  let datosBancariosARevisar = 0;
  let datosCompletos = 0;
  let duplicados = 0;
  for (const fila of filas) {
    if (fila.estado.estado === 'INCLUIDA') {
      if (fila.estado.destino === 'BNA_GT_HABERES') bna += 1;
      else patagonia += 1;
    } else if (fila.estado.estado === 'PENDIENTE') {
      pendientes += 1;
    } else {
      excluidos += 1;
    }
    if (fila.nivel === 'BLOQUEANTE') conBloqueos += 1;
    if (accionPendiente(fila)) requierenAccion += 1;
    if (sinRegistroEnMaestro(fila)) sinMaestro += 1;
    if (tieneDatosBancariosARevisar(fila)) datosBancariosARevisar += 1;
    if (datosBancariosCompletos(fila)) datosCompletos += 1;
    if (tieneDatosDuplicados(fila)) duplicados += 1;
  }
  return {
    total: filas.length,
    bna,
    patagonia,
    pendientes,
    excluidos,
    conBloqueos,
    requierenAccion,
    sinMaestro,
    datosBancariosARevisar,
    datosCompletos,
    duplicados,
  };
}

/** Etiqueta breve del estado de los datos bancarios de una fila (solo presentación). */
export function estadoDatosBancarios(fila: FilaConciliada): {
  readonly texto: string;
  readonly tono: Tono;
} {
  if (tieneDatosBancariosARevisar(fila)) return { texto: 'Revisar', tono: 'atencion' };
  if (fila.estado.estado === 'INCLUIDA') return { texto: 'Completos', tono: 'exito' };
  if (fila.estado.estado === 'PENDIENTE') return { texto: 'Falta destino', tono: 'atencion' };
  return { texto: 'No aplica', tono: 'neutral' };
}
