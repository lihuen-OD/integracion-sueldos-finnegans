// Etiquetas humanas para la UI (CP-F3-B): la UI no encierra lógica de negocio; solo
// traduce códigos de dominio a texto comprensible para quien administra la liquidación
// (D-067: nombres humanos de bancos). Nada de esto cambia decisiones, niveles ni readiness.
import type { AlcanceIncidencia, NivelVisible, ValoresObservados } from '../domain/incidencias';
import type { Destino } from '../domain/destino';
import type { EstadoFila, MotivoNoAplicada, MotivoGlobal, TipoDecision } from '../reconciliation';
import type { EstadoReadiness, MotivoReadiness } from '../reconciliation';
import type { CampoBancario, MotivoCampoInvalido } from '../domain/maestro';

/** Lo que la vista necesita de un dato bancario (sin tipos internos en la UI). */
export type CampoMaestroVista =
  | { readonly estado: 'VACIO' }
  | { readonly estado: 'VALIDO'; readonly texto: string; readonly valor: unknown }
  | { readonly estado: 'INVALIDO'; readonly texto: string; readonly motivo: MotivoCampoInvalido };

/** Nombres humanos de los destinos (D-067). Los códigos internos solo aparecen en la
 *  vista técnica de detalle si existen. */
export const ETIQUETA_DESTINO: Readonly<Record<Destino, string>> = {
  BNA_GT_HABERES: 'Banco Nación',
  PATAGONIA_B2: 'Banco Patagonia',
};

export function etiquetaDestino(destino: Destino): string {
  return ETIQUETA_DESTINO[destino];
}

export const ETIQUETA_NIVEL: Readonly<Record<NivelVisible, string>> = {
  CORRECTO: 'Correcto',
  INFORMACION: 'Solo información',
  REQUIERE_REVISION: 'Requiere revisión',
  BLOQUEANTE: 'Bloqueante',
};

/** Estilo visual de cada nivel; simétrico entre bancos (D-067). */
export const ESTILO_NIVEL: Readonly<Record<NivelVisible, string>> = {
  CORRECTO: 'text-emerald-700',
  INFORMACION: 'text-slate-600',
  REQUIERE_REVISION: 'text-amber-700',
  BLOQUEANTE: 'text-red-700',
};

const ETIQUETA_MOTIVO_FILA: Readonly<
  Record<Exclude<EstadoFila, { estado: 'INCLUIDA' }>['motivo'], string>
> = {
  NETO_CERO: 'Neto igual a cero: no se paga en ninguna liquidación de esta corrida',
  BANCO_VACIO: 'Sin banco en Finnegans: hay que elegir el destino',
  BANCO_NO_SOPORTADO:
    'Banco fuera del catálogo: la fila queda a la espera de soporte (no se adivina el destino)',
};

function importe(centavos: bigint): string {
  const valor = centavos < 0n ? -centavos : centavos;
  const enteros = (valor / 100n).toString();
  const miles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavosTexto = (valor % 100n).toString().padStart(2, '0');
  return `${centavos < 0n ? '−' : ''}${miles},${centavosTexto}`;
}

/** Importe en pesos con centavos; `—` cuando el importe no se puede calcular. */
export function etiquetaImporte(centavos: bigint | null): string {
  return centavos === null ? '—' : importe(centavos);
}

export function etiquetaEstadoFila(estado: EstadoFila): string {
  switch (estado.estado) {
    case 'INCLUIDA':
      return `Incluida · ${ETIQUETA_DESTINO[estado.destino]}`;
    case 'EXCLUIDA':
      return `Excluida · ${ETIQUETA_MOTIVO_FILA[estado.motivo]}`;
    case 'PENDIENTE':
      return `Pendiente · ${ETIQUETA_MOTIVO_FILA[estado.motivo]}`;
  }
}

export const ETIQUETA_ESTADO_READINESS: Readonly<Record<EstadoReadiness, string>> = {
  BLOQUEADO_POR_CONCILIACION_GLOBAL: 'Esperando que la conciliación cierre',
  SIN_REGISTROS: 'Sin registros asignados',
  BLOQUEADO: 'Bloqueado',
  REQUIERE_REVISION: 'Requiere revisión',
  CONFIGURACION_INCOMPLETA: 'Configuración incompleta',
  GENERADOR_NO_HABILITADO: 'Generador no habilitado',
  LISTO_PARA_GENERAR: 'Listo para generar',
};

export const ETIQUETA_MOTIVO_READINESS: Readonly<Record<MotivoReadiness, string>> = {
  CONCILIACION_GLOBAL_NO_CERRADA: 'La conciliación global no está cerrada.',
  SIN_REGISTROS: 'No hay filas asignadas a este banco.',
  BLOQUEANTES_DEL_BANCO: 'Hay filas de este banco con bloqueos.',
  REVISIONES_DEL_BANCO_SIN_RESOLVER: 'Hay revisiones de este banco sin resolver.',
  CONFIGURACION_INCOMPLETA:
    'Falta la configuración de envío del perfil de empresa: las salidas quedan pendientes de revisión humana.',
  GENERADOR_NO_HABILITADO: 'La generación de archivos todavía no está habilitada.',
};

export const ETIQUETA_MOTIVO_GLOBAL: Readonly<Record<MotivoGlobal, string>> = {
  BLOQUEANTES_GLOBALES: 'Hay filas con bloqueantes.',
  IMPORTE_NO_CALCULABLE: 'No se puede calcular algún importe.',
  INVARIANTE_CANTIDAD: 'No cuadran las cantidades de filas.',
  INVARIANTE_IMPORTE: 'No cuadran los importes.',
  FILAS_PENDIENTES: 'Hay filas pendientes (sin destino o excluidas de revisión).',
  REVISIONES_GLOBALES_SIN_RESOLVER: 'Hay revisiones globales sin resolver.',
};

export const ETIQUETA_MOTIVO_NO_APLICADA: Readonly<Record<MotivoNoAplicada, string>> = {
  INCIDENCIA_INEXISTENTE: 'La incidencia ya no existe en la conciliación actual.',
  NO_RESOLUBLE_POR_ESTE_TIPO: 'El tipo de decisión no resuelve esa incidencia.',
  DATOS_CAMBIARON:
    'Los datos que la decisión observó ya no son los vigentes: se debe decidir de nuevo.',
  DECISIONES_EN_CONFLICTO: 'Hay otra decisión que entra en conflicto con esta.',
};

/** Alcance de una incidencia en palabras (la agrupación es solo presentación). */
export function etiquetaAlcance(alcance: AlcanceIncidencia): string {
  return alcance === 'GLOBAL' ? 'Toda la corrida' : ETIQUETA_DESTINO[alcance];
}

/** Valor que diferencia un grupo colapsado: los valores observados que el motor ya
 *  entregó, sin claves ni adornos; si no hay ninguno, no se inventa texto. */
export function etiquetaValoresGrupo(valores: ValoresObservados | undefined): string {
  return (valores === undefined ? [] : Object.values(valores))
    .filter((valor) => valor.trim() !== '')
    .join(' · ');
}

/** Estado de la conciliación global en palabras. */
export const ETIQUETA_ESTADO_GLOBAL: Readonly<
  Record<'CERRADA' | 'PENDIENTE' | 'BLOQUEADA', string>
> = {
  CERRADA: 'Conciliación cerrada',
  PENDIENTE: 'Conciliación pendiente',
  BLOQUEADA: 'Conciliación bloqueada',
};

/** Títulos de las secciones de incidencias vistas por el operador (proyección visual). */
export const ETIQUETA_SECCION = {
  ACCION: 'Requiere tu acción',
  BLOQUEOS: 'Bloqueos',
  INFORMACION: 'Información',
  RESUELTAS: 'Resueltas',
} as const;

/** Qué hizo el operador, en palabras (los IDs técnicos quedan fuera de la vista). */
export function etiquetaDecision(decision: {
  readonly tipo: TipoDecision;
  readonly destino?: Destino;
}): string {
  return decision.tipo === 'ASIGNAR_DESTINO'
    ? `Banco asignado: ${ETIQUETA_DESTINO[decision.destino ?? 'BNA_GT_HABERES']}`
    : 'Revisión confirmada por el operador';
}

/** Etiquetas humanas de los campos bancarios del maestro (agrupadas por banco en la UI).
 *  No cambian validación ni requiredness: solo el texto visible. */
export const ETIQUETA_CAMPO_MAESTRO: Readonly<Record<CampoBancario, string>> = {
  CBU: 'CBU',
  PAT_TIPO_CUENTA: 'Tipo de cuenta',
  PAT_NUMERO_CUENTA: 'Número de cuenta',
  PAT_CODIGO_BANCO: 'Código de banco',
  PAT_CODIGO_SUCURSAL: 'Código de sucursal',
  PAT_TIPO_DOCUMENTO: 'Tipo de documento',
  PAT_NUMERO_DOCUMENTO: 'Número de documento',
  PAT_PROVINCIA_DOCUMENTO: 'Provincia del documento',
  PAT_CODIGO_DEPENDENCIA: 'Código de dependencia',
};

/** Motivos de Dato invalidado en palabras (nunca contienen valores; docs/03 §B.3). */
export const ETIQUETA_MOTIVO_CAMPO_BANCARIO: Readonly<Record<MotivoCampoInvalido, string>> = {
  CARACTER_NO_PERMITIDO: 'solo se admiten dígitos',
  LONGITUD_INVALIDA: 'la longitud no es la esperada',
  FUERA_DE_CATALOGO: 'el código no está en la lista aprobada',
  DV_BLOQUE_1_INVALIDO: 'el dígito verificador del primer bloque no cuadra',
  DV_BLOQUE_2_INVALIDO: 'el dígito verificador del segundo bloque no cuadra',
  CELDA_NUMERICA: 'la celda estaba cargada como número de Excel',
  FORMULA: 'la celda tenía una fórmula',
  TIPO_DE_CELDA: 'la celda no es de texto',
  NO_CORRESPONDE_AL_TIPO_DOCUMENTO: 'la provincia solo corresponde con tipo de documento 004',
};

/** Valor de un dato bancario del maestro en palabras: texto tal cual, vacío o inválido. */
export function etiquetaCampoMaestro(campo: CampoMaestroVista): string {
  if (campo.estado === 'VACIO') {
    return '(vacío)';
  }
  return campo.texto === '' ? '(ilegible como texto)' : campo.texto;
}
