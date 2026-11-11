// Fachada de generación BNA (CP-F5-C). Es el único punto de `src/run/` que conecta
// perfil importado, conciliación, readiness, modelo BNA, política, mapper, serializer e
// inspector. No duplica reglas de conciliación, CBU/CUIL, importes, fixed-width ni
// contrato BNA: consume los contratos ya aprobados. La generación productiva sigue
// bloqueada por BNA-1 (`POLITICA_BNA_PRODUCTIVA` no lo resuelve) y por
// P-09/P-10 cuando la conciliación los informa. Además, una compuerta de autorización
// independiente y cerrada por construcción (`produccionBnaHabilitada`) impide devolver
// `GENERADO` aunque en el futuro se resuelva BNA-1. La cobertura de pagos se controla
// contra el conjunto asignado de la conciliación/readiness, no solo contra los R2 ya
// emitidos. Nunca dispara una descarga ni escribe archivos: devuelve bytes en memoria
// solo si TODAS las compuertas pasan.
import { claveRef } from '../domain/incidencias';
import type { CodigoIncidencia, NivelIncidencia, SourceRef } from '../domain/incidencias';
import { sumarTodos } from '../domain/money';
import type { Centavos } from '../domain/money';
import type { CompanyProfileImportado, CompanyProfileV2, CompanyProfileV3 } from '../profile';
import type {
  BnaReadiness,
  FilaConciliada,
  IncidenciaConciliada,
  MotivoGlobal,
  MotivoReadiness,
  ResultadoConciliacion,
  Totales,
} from '../reconciliation';
import { evaluarReadiness } from '../reconciliation';
import {
  REGISTRO_BNA_1,
  REGISTRO_BNA_2,
  REGISTRO_BNA_3,
  aptitudBna,
  crearSpecBna,
  inspeccionarBna,
  produccionBnaHabilitada,
  serializarBna,
} from '../banks/bna';
import {
  politicaBnaDesdeResolucionIdentificadorHaberesBna,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from './seleccionIdentificadorHaberesBna';
import { lineasBancariasEfectivasDeConciliacion } from './lineasBancariasEfectivas';

import type {
  AptitudBna,
  BnaIssueId,
  ErrorInspeccionBna,
  ErrorSerializacionBna,
  InspeccionBna,
  PagoBna,
  ParametrosEnvioBna,
  PerfilBna,
  PoliticaBna,
  PuntoPoliticaBna,
  ResolucionBna,
  TotalesBna,
} from '../banks/bna';

/** Configuración mínima que falta para que la fachada pueda evaluar BNA. */
export type MotivoConfiguracionBna =
  'PERFIL_AUSENTE' | 'PERFIL_VERSION_INCOMPATIBLE' | 'PARAMETROS_AUSENTES';

/** Por qué la conciliación no habilita el archivo BNA. */
export type MotivoConciliacionBna =
  | 'SIN_CONCILIACION'
  | 'GLOBAL_PENDIENTE'
  | 'GLOBAL_BLOQUEADA'
  | 'BLOQUEANTES_BNA'
  | 'REVISIONES_BNA';

export type MotivoSinRegistrosBna = 'BANCO_SIN_FILAS' | 'SIN_PAGOS_CONVERTIBLES';

export type MotivoMapeoBna = 'LIQUIDACION_SIN_MAPEO' | 'POLITICA_SIN_RESOLUCION';

/**
 * Motivo por el que una fila asignada a BNA no se convierte en pago. Se informa con su
 * `SourceRef` para que ninguna fila elegible desaparezca en silencio.
 */
export type MotivoNoConvertibleBna =
  | 'NETO_AUSENTE'
  | 'NETO_NO_POSITIVO'
  | 'SIN_MAESTRO'
  | 'CUIL_INVALIDO'
  | 'CBU_INVALIDO'
  | 'INCIDENCIA_BNA_BLOQUEANTE'
  | 'INCIDENCIA_BNA_EN_REVISION'
  | 'INCIDENCIA_GLOBAL_BLOQUEANTE'
  | 'INCIDENCIA_GLOBAL_EN_REVISION';

export interface FilaNoConvertibleBna {
  readonly ref: SourceRef;
  readonly motivo: MotivoNoConvertibleBna;
  /** Incidencia de conciliación que impidió el pago, si el motivo proviene de una. */
  readonly incidenciaId?: string;
}

/** Exclusión ya decidida por la conciliación (hoy solo neto cero); nunca es una omisión. */
export interface FilaExcluidaBna {
  readonly ref: SourceRef;
  readonly motivo: 'NETO_CERO';
}

/**
 * Control integral de cobertura. `asignadas` se calcula recorriendo la conciliación y se
 * contrasta con `global.bna` y con `readiness.asignadas`; no se limita a comparar el R3
 * contra los R2 ya emitidos. Los importes son `Centavos`/`bigint` en todo el cálculo.
 */
export interface CoberturaPagosBna {
  /** Filas INCLUIDA(BNA_GT_HABERES) calculadas desde la conciliación. */
  readonly asignadas: Totales;
  readonly convertidas: Totales;
  readonly noConvertibles: readonly FilaNoConvertibleBna[];
  /** Filas que la conciliación ya excluyó por una regla legítima (neto cero). */
  readonly excluidas: readonly FilaExcluidaBna[];
  /** Todas las refs asignadas y convertidas son únicas y pertenecen a una fila asignada. */
  readonly refsUnicas: boolean;
  /** Los pagos conservan el orden de las filas asignadas (ningún reordenamiento). */
  readonly ordenPreservado: boolean;
  /**
   * Para cada pago, `neto`, `cuil` y `cbu` coinciden exactamente con los datos validados
   * de su fila asignada, identificada por `claveRef`. No expone esos valores.
   */
  readonly datosCoinciden: boolean;
  /** Asignadas = convertidas + no convertibles, en cantidad e importe exacto (bigint). */
  readonly totalesCoinciden: boolean;
  /** Lo calculado desde las filas coincide con `global.bna`. */
  readonly globalCoincide: boolean;
  /** Lo calculado desde las filas coincide con `readiness.asignadas`. */
  readonly readinessCoincide: boolean;
  readonly completa: boolean;
}

export type MotivoCoberturaBna = 'FILAS_BNA_NO_CONVERTIBLES' | 'INVARIANTES_PAGOS_BNA';

/** Una fila asignada no llegó a pago o los invariantes de cantidad/importe no cierran. */
export interface CoberturaIncompletaBna extends CoberturaPagosBna {
  readonly estado: 'COBERTURA_PAGOS_INCOMPLETA';
  readonly motivo: MotivoCoberturaBna;
  readonly pendienteHomologacion: true;
}

/**
 * El contrato, la cobertura y la política pueden estar resueltos, pero la producción no
 * está autorizada. No hay bytes: la compuerta es independiente y no se abre con perfil,
 * parámetros, entorno ni propiedades adicionales de la entrada.
 */
export interface HomologacionPendienteBna {
  readonly estado: 'HOMOLOGACION_BNA_PENDIENTE';
  readonly motivo: 'HOMOLOGACION_BNA_PENDIENTE';
  readonly pendienteHomologacion: true;
}

/** Resumen sin valores observados: la fachada no expone PII en diagnósticos. */
export interface IncidenciaResumenBna {
  readonly id: string;
  readonly codigo: CodigoIncidencia;
  readonly nivel: NivelIncidencia;
  readonly refs: readonly SourceRef[];
}

export interface ConfiguracionIncompletaBna {
  readonly estado: 'CONFIGURACION_INCOMPLETA';
  readonly motivos: readonly MotivoConfiguracionBna[];
  readonly perfilVersion: '1' | '2' | '3' | null;
  readonly pendienteHomologacion: true;
}

export interface ConciliacionNoListaBna {
  readonly estado: 'CONCILIACION_NO_LISTA';
  readonly motivo: MotivoConciliacionBna;
  readonly motivosGlobales: readonly MotivoGlobal[];
  readonly motivosReadiness: readonly MotivoReadiness[];
  readonly incidencias: readonly IncidenciaResumenBna[];
  readonly pendienteHomologacion: true;
}

export interface SinRegistrosBna {
  readonly estado: 'SIN_REGISTROS';
  readonly motivo: MotivoSinRegistrosBna;
  readonly asignadas: Totales;
  readonly pendienteHomologacion: true;
}

export interface ContratoBloqueadoBna {
  readonly estado: 'CONTRATO_BNA_BLOQUEADO';
  readonly bloqueos: AptitudBna['bloqueos'];
  /** Issues documentales asociadas a los campos bloqueados (hoy BNA-1). */
  readonly referencias: readonly BnaIssueId[];
  /** Interpretaciones pendientes que afectan bytes: informativas, no bloqueos nuevos. */
  readonly interpretacionesByte: readonly BnaIssueId[];
  readonly pendienteHomologacion: true;
}

export interface MapeoNoResueltoBna {
  readonly estado: 'MAPEO_NO_RESUELTO';
  readonly motivo: MotivoMapeoBna;
  readonly puntos: readonly PuntoPoliticaBna[];
  readonly incidencias: readonly IncidenciaResumenBna[];
  readonly pendienteHomologacion: true;
}

export interface SerializacionFallidaBna {
  readonly estado: 'SERIALIZACION_FALLIDA';
  readonly errores: readonly ErrorSerializacionBna[];
  readonly pendienteHomologacion: true;
}

export interface InspeccionFallidaBna {
  readonly estado: 'INSPECCION_BNA_FALLIDA';
  readonly errores: readonly ErrorInspeccionBna[];
  readonly pendienteHomologacion: true;
}

export interface GeneradoBna {
  readonly estado: 'GENERADO';
  /** Bytes en memoria. La fachada no crea Blob, no descarga y no escribe archivos. */
  readonly bytes: Uint8Array;
  readonly totales: TotalesBna;
  readonly inspeccion: InspeccionBna;
  readonly separador: '\n' | '\r\n';
  readonly trailingSeparator: boolean;
  readonly pendienteHomologacion: true;
}

export type ResultadoNoGeneradoBna =
  | ConfiguracionIncompletaBna
  | ConciliacionNoListaBna
  | SinRegistrosBna
  | ContratoBloqueadoBna
  | CoberturaIncompletaBna
  | MapeoNoResueltoBna
  | HomologacionPendienteBna;

/** Evaluación sin serializar: distingue "listo técnicamente" de cada bloqueo. */
export interface ListoTecnicamenteBna {
  readonly estado: 'LISTO_TECNICAMENTE';
  readonly perfil: PerfilBna;
  readonly parametros: ParametrosEnvioBna;
  readonly pagos: readonly PagoBna[];
  readonly politica: PoliticaBna;
  readonly readiness: BnaReadiness;
  readonly aptitud: AptitudBna;
  /** Cobertura exacta contra el conjunto asignado, ya verificada. */
  readonly cobertura: CoberturaPagosBna;
}

export type EvaluacionGeneracionBna = ListoTecnicamenteBna | ResultadoNoGeneradoBna;

export type ResultadoGeneracionBna =
  GeneradoBna | ResultadoNoGeneradoBna | SerializacionFallidaBna | InspeccionFallidaBna;

/**
 * Entrada pública productiva. No admite política, aptitud, serializer ni inspector:
 * la fachada siempre usa la política B2 derivada sobre `POLITICA_BNA_PRODUCTIVA`,
 * `aptitudBna(crearSpecBna(...))`, `serializarBna` e `inspeccionarBna`. Las hipótesis
 * sintéticas viven solo en tests.
 */
export interface EntradaGeneracionBna {
  /** Perfil ya importado/validado. v1 es válido históricamente, pero no genera BNA. */
  readonly perfil: CompanyProfileImportado | null;
  /** Resultado de F2 con decisiones y mapeos ya aplicados; es la fuente de verdad. */
  readonly conciliacion: ResultadoConciliacion | null;
  /** Parámetros explícitos del envío: sin defaults de fecha, número, criterio, referencia ni separadores. */
  readonly parametros: ParametrosEnvioBna | null;
  /** Snapshot BNA-B1 de la corrida evaluada; sin él P-09/P-10 queda sin resolución. */
  readonly seleccionIdentificadorHaberesBna?: SnapshotSeleccionIdentificadorHaberesBna | null;
  /** Huella Finnegans vigente, obligatoria para revalidar el snapshot BNA-B1. */
  readonly huellaFinnegans?: string | null;
}

const REGISTROS_CONTRATO_BNA = [REGISTRO_BNA_1, REGISTRO_BNA_2, REGISTRO_BNA_3] as const;

/**
 * Decisión única de compatibilidad BNA (D-089): solo v2 y v3 conservan la sección
 * `bna` común. v1 no es compatible y no se migra ni se convierte. El predicado
 * permite narrowing sin casts y no consulta la sección Patagonia.
 */
function esPerfilCompatibleBna(
  perfil: CompanyProfileImportado,
): perfil is CompanyProfileV2 | CompanyProfileV3 {
  return perfil.schemaVersion === '2' || perfil.schemaVersion === '3';
}

/** Copia explícita SOLO de los cuatro datos BNA comunes a v2 y v3. */
export function perfilBnaDesdePerfil(perfil: CompanyProfileV2 | CompanyProfileV3): PerfilBna {
  return {
    cuitEmpresa: perfil.cuitEmpresa,
    cbuEmpresa: perfil.bna.cbuEmpresa,
    codigoConvenio: perfil.bna.codigoConvenio,
    moneda: perfil.bna.moneda,
  };
}

function incidenciaQueImpideElPago(fila: FilaConciliada): IncidenciaConciliada | undefined {
  return fila.incidencias.find(
    (incidencia) =>
      incidencia.resolucion === undefined &&
      (incidencia.alcance === 'BNA_GT_HABERES' || incidencia.alcance === 'GLOBAL') &&
      (incidencia.nivel === 'BLOQUEANTE' || incidencia.nivel === 'REQUIERE_REVISION'),
  );
}

function motivoDeIncidencia(incidencia: IncidenciaConciliada): MotivoNoConvertibleBna {
  const global = incidencia.alcance === 'GLOBAL';
  if (incidencia.nivel === 'BLOQUEANTE') {
    return global ? 'INCIDENCIA_GLOBAL_BLOQUEANTE' : 'INCIDENCIA_BNA_BLOQUEANTE';
  }
  return global ? 'INCIDENCIA_GLOBAL_EN_REVISION' : 'INCIDENCIA_BNA_EN_REVISION';
}

type EvaluacionFilaBna =
  | { readonly tipo: 'CONVERTIBLE'; readonly pago: PagoBna }
  | {
      readonly tipo: 'NO_CONVERTIBLE';
      readonly motivo: MotivoNoConvertibleBna;
      readonly incidenciaId?: string;
    };

/**
 * Misma conversión para la lista pública de pagos y para el control de cobertura. Cada
 * fila asignada que no se convierte conserva un motivo explícito; nunca se descarta en
 * silencio.
 */
function evaluarFilaBna(fila: FilaConciliada): EvaluacionFilaBna {
  const { neto } = fila.linea;
  if (neto === null) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'NETO_AUSENTE' };
  }
  if (neto <= 0n) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'NETO_NO_POSITIVO' };
  }
  const registro = fila.registro;
  if (registro === null) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'SIN_MAESTRO' };
  }
  if (registro.cuil === null) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'CUIL_INVALIDO' };
  }
  if (registro.cbu.estado !== 'VALIDO') {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'CBU_INVALIDO' };
  }
  const incidencia = incidenciaQueImpideElPago(fila);
  if (incidencia !== undefined) {
    return {
      tipo: 'NO_CONVERTIBLE',
      motivo: motivoDeIncidencia(incidencia),
      incidenciaId: incidencia.id,
    };
  }
  return {
    tipo: 'CONVERTIBLE',
    pago: {
      ref: fila.linea.ref,
      cuil: registro.cuil,
      cbu: registro.cbu.valor,
      neto,
      descripcion: fila.linea.descripcion,
    },
  };
}

function pagoDeFila(fila: FilaConciliada): PagoBna | undefined {
  if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'BNA_GT_HABERES') {
    return undefined;
  }
  const evaluacion = evaluarFilaBna(fila);
  return evaluacion.tipo === 'CONVERTIBLE' ? evaluacion.pago : undefined;
}

/**
 * Pagos BNA derivados exclusivamente de la conciliación, preservando el orden de la
 * corrida y su `SourceRef`. No lee XLSX ni reimplementa reglas de F2.
 *
 * ADVERTENCIA: devuelve solo los pagos convertibles; no verifica cobertura. No es una
 * autorización de generación: la fachada usa `analizarCoberturaPagosBna` y bloquea con
 * `COBERTURA_PAGOS_INCOMPLETA` si alguna fila asignada no se convierte o si los totales
 * no coinciden con el conjunto asignado.
 */
export function pagosBnaDesdeConciliacion(resultado: ResultadoConciliacion): readonly PagoBna[] {
  const pagos: PagoBna[] = [];
  for (const fila of resultado.filas) {
    const pago = pagoDeFila(fila);
    if (pago !== undefined) {
      pagos.push(pago);
    }
  }
  return pagos;
}

interface AnalisisCoberturaBna {
  readonly cobertura: CoberturaPagosBna;
  readonly pagos: readonly PagoBna[];
}

/**
 * Clasifica todas las filas asignadas a BNA y verifica cantidad, referencias, orden e
 * importes exactos en centavos. No modifica la conciliación ni reimplementa sus reglas:
 * reutiliza `evaluarFilaBna`, la misma conversión que usa `pagosBnaDesdeConciliacion`.
 * Las exclusiones ya decididas por F2 (`EXCLUIDA(NETO_CERO)`) y los otros destinos quedan
 * fuera del universo asignado y se informan como exclusiones legítimas, nunca como
 * omisiones. La fuente independiente es `global.bna`/`readiness.asignadas`, no los R2 que
 * el propio archivo llegue a emitir.
 *
 * `pagos` es la lista que se va a auditar (la que se serializaría). Se recibe aparte para
 * que el control detecte referencias inesperadas, duplicadas o reordenadas y no sea una
 * verificación tautológica sobre la misma estructura recién construida.
 */
function analizarCoberturaPagosBna(
  resultado: ResultadoConciliacion,
  asignadasEsperadas: Totales,
  pagos: readonly PagoBna[],
): AnalisisCoberturaBna {
  const noConvertibles: FilaNoConvertibleBna[] = [];
  const excluidas: FilaExcluidaBna[] = [];
  const refsAsignadas = new Set<string>();
  const refsAsignadasEnOrden: string[] = [];
  // Datos validados por `SourceRef` para comparar cada pago con SU fila, sin construir
  // una segunda lista de pagos ni recalcular reglas bancarias.
  const datosValidados = new Map<string, PagoBna>();

  let cantidadAsignada = 0;
  let filasSinImporteAsignadas = 0;
  let importeAsignado: bigint | null = 0n;
  let importeNoConvertible: bigint | null = 0n;

  for (const fila of resultado.filas) {
    if (fila.estado.estado === 'EXCLUIDA') {
      excluidas.push({ ref: fila.linea.ref, motivo: fila.estado.motivo });
      continue;
    }
    if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'BNA_GT_HABERES') {
      continue;
    }

    cantidadAsignada += 1;
    refsAsignadas.add(claveRef(fila.linea.ref));
    refsAsignadasEnOrden.push(claveRef(fila.linea.ref));
    const { neto } = fila.linea;
    if (neto === null) {
      filasSinImporteAsignadas += 1;
      importeAsignado = null;
    } else if (importeAsignado !== null) {
      importeAsignado += neto;
    }

    const evaluacion = evaluarFilaBna(fila);
    if (evaluacion.tipo === 'CONVERTIBLE') {
      datosValidados.set(claveRef(fila.linea.ref), evaluacion.pago);
      continue;
    }

    noConvertibles.push({
      ref: fila.linea.ref,
      motivo: evaluacion.motivo,
      ...(evaluacion.incidenciaId === undefined ? {} : { incidenciaId: evaluacion.incidenciaId }),
    });
    if (neto === null) {
      importeNoConvertible = null;
    } else if (importeNoConvertible !== null) {
      importeNoConvertible += neto;
    }
  }

  const importeConvertido = sumarTodos(pagos.map((pago) => pago.neto));
  const refsConvertidas = new Set(pagos.map((pago) => claveRef(pago.ref)));
  const refsUnicas =
    refsAsignadas.size === cantidadAsignada &&
    refsConvertidas.size === pagos.length &&
    pagos.every((pago) => refsAsignadas.has(claveRef(pago.ref)));

  // Comparación por `claveRef`: detecta importes intercambiados con la misma suma,
  // CBU/CUIL sustituidos o cualquier deriva entre el pago y su fila validada.
  const datosCoinciden = pagos.every((pago) => {
    const validado = datosValidados.get(claveRef(pago.ref));
    if (validado === undefined) {
      return false;
    }
    return validado.neto === pago.neto && validado.cuil === pago.cuil && validado.cbu === pago.cbu;
  });

  // Los pagos deben ser una subsecuencia de las filas asignadas en su orden original:
  // detecta reordenamientos y referencias inesperadas sin depender de los R2 emitidos.
  let cursor = 0;
  let ordenPreservado = true;
  for (const pago of pagos) {
    const ref = claveRef(pago.ref);
    while (cursor < refsAsignadasEnOrden.length && refsAsignadasEnOrden[cursor] !== ref) {
      cursor += 1;
    }
    if (cursor === refsAsignadasEnOrden.length) {
      ordenPreservado = false;
      break;
    }
    cursor += 1;
  }

  const cantidadCoincide = cantidadAsignada === pagos.length + noConvertibles.length;
  const importeCoincide =
    importeAsignado !== null &&
    importeNoConvertible !== null &&
    importeAsignado === importeConvertido + importeNoConvertible;
  const totalesCoinciden = cantidadCoincide && importeCoincide;

  const global = resultado.global.bna;
  const globalCoincide =
    global.cantidad === cantidadAsignada &&
    global.importe === importeAsignado &&
    global.filasSinImporte === filasSinImporteAsignadas;
  const readinessCoincide =
    asignadasEsperadas.cantidad === cantidadAsignada &&
    asignadasEsperadas.importe === importeAsignado &&
    asignadasEsperadas.filasSinImporte === filasSinImporteAsignadas;

  const asignadas: Totales = {
    cantidad: cantidadAsignada,
    importe: importeAsignado === null ? null : (importeAsignado as Centavos),
    filasSinImporte: filasSinImporteAsignadas,
  };
  const convertidas: Totales = {
    cantidad: pagos.length,
    importe: importeConvertido,
    filasSinImporte: 0,
  };

  return {
    pagos,
    cobertura: {
      asignadas,
      convertidas,
      noConvertibles,
      excluidas,
      refsUnicas,
      ordenPreservado,
      datosCoinciden,
      totalesCoinciden,
      globalCoincide,
      readinessCoincide,
      completa:
        noConvertibles.length === 0 &&
        refsUnicas &&
        ordenPreservado &&
        datosCoinciden &&
        totalesCoinciden &&
        globalCoincide &&
        readinessCoincide,
    },
  };
}

/**
 * Reporte público de cobertura de pagos BNA. No genera bytes ni abre la compuerta
 * productiva; permite auditar qué fila asignada no se convirtió y por qué. La lista de
 * `pagos` a auditar se puede pasar para verificar una salida concreta (orden,
 * duplicados, referencias inesperadas); por defecto se derivan de la conciliación.
 */
export function coberturaPagosBna(
  resultado: ResultadoConciliacion,
  asignadasEsperadas: Totales = resultado.global.bna,
  pagos: readonly PagoBna[] = pagosBnaDesdeConciliacion(resultado),
): CoberturaPagosBna {
  return analizarCoberturaPagosBna(resultado, asignadasEsperadas, pagos).cobertura;
}

function incidenciasBna(
  resultado: ResultadoConciliacion,
  nivel: 'BLOQUEANTE' | 'REQUIERE_REVISION',
): readonly IncidenciaConciliada[] {
  return resultado.incidencias.filter(
    (incidencia) =>
      incidencia.alcance === 'BNA_GT_HABERES' &&
      incidencia.resolucion === undefined &&
      incidencia.nivel === nivel,
  );
}

function resumenIncidencias(
  incidencias: readonly IncidenciaConciliada[],
): readonly IncidenciaResumenBna[] {
  return incidencias.map((incidencia) => ({
    id: incidencia.id,
    codigo: incidencia.codigo,
    nivel: incidencia.nivel,
    refs: incidencia.refs,
  }));
}

function referenciasDeBloqueos(bloqueos: AptitudBna['bloqueos']): readonly BnaIssueId[] {
  const referencias = new Set<BnaIssueId>();
  for (const bloqueo of bloqueos) {
    if (bloqueo.tipo !== 'campo') {
      continue;
    }
    const registro = REGISTROS_CONTRATO_BNA.find((item) => item.id === bloqueo.registroId);
    const campo = registro?.fields.find((item) => item.id === bloqueo.campoId);
    for (const issue of campo?.issues ?? []) {
      referencias.add(issue);
    }
  }
  return [...referencias];
}

function puntosSinResolver(
  perfil: PerfilBna,
  parametros: ParametrosEnvioBna,
  pagos: readonly PagoBna[],
  politica: PoliticaBna,
): readonly PuntoPoliticaBna[] {
  const puntos = new Set<PuntoPoliticaBna>();
  const revisar = (resolucion: ResolucionBna<unknown>): void => {
    if (resolucion.estado === 'SIN_RESOLUCION') {
      puntos.add(resolucion.punto);
    }
  };
  revisar(politica.sucursalEmpresa(perfil));
  revisar(politica.infoCriterio(perfil, parametros));
  for (const pago of pagos) {
    revisar(politica.documento(pago));
    revisar(politica.cbuCuenta(pago));
    revisar(politica.entidadSucursal(perfil, pago));
    revisar(politica.identificadorPrestamo(pago));
    revisar(politica.camposBeneficiario(pago, parametros));
  }
  return [...puntos];
}

function configuracionIncompleta(
  motivos: readonly MotivoConfiguracionBna[],
  perfil: CompanyProfileImportado | null,
): ConfiguracionIncompletaBna {
  return {
    estado: 'CONFIGURACION_INCOMPLETA',
    motivos,
    perfilVersion: perfil === null ? null : perfil.schemaVersion,
    pendienteHomologacion: true,
  };
}

/**
 * Evalúa todas las compuertas sin serializar. La readiness existente se compone con la
 * aptitud contractual: no se crea una segunda readiness. Incluye el control de cobertura
 * contra el conjunto asignado y, al final, la compuerta independiente de autorización.
 */
export function evaluarGeneracionBna(entrada: EntradaGeneracionBna): EvaluacionGeneracionBna {
  const { perfil, conciliacion, parametros } = entrada;
  const perfilCompatible = perfil !== null && esPerfilCompatibleBna(perfil) ? perfil : null;
  const motivos: MotivoConfiguracionBna[] = [];
  if (perfil === null) {
    motivos.push('PERFIL_AUSENTE');
  } else if (perfilCompatible === null) {
    motivos.push('PERFIL_VERSION_INCOMPATIBLE');
  }
  if (parametros === null) {
    motivos.push('PARAMETROS_AUSENTES');
  }
  if (perfilCompatible === null || parametros === null) {
    return configuracionIncompleta(motivos, perfil);
  }
  if (conciliacion === null) {
    return {
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'SIN_CONCILIACION',
      motivosGlobales: [],
      motivosReadiness: [],
      incidencias: [],
      pendienteHomologacion: true,
    };
  }

  const aptitud = aptitudBna(crearSpecBna(parametros));
  const readiness = evaluarReadiness(conciliacion, {
    configuracionCompleta: { BNA_GT_HABERES: true, PATAGONIA_B2: false },
    generadorHabilitado: {
      BNA_GT_HABERES: aptitud.generadorHabilitado,
      PATAGONIA_B2: false,
    },
  }).bna;

  if (readiness.motivos.includes('CONCILIACION_GLOBAL_NO_CERRADA')) {
    return {
      estado: 'CONCILIACION_NO_LISTA',
      motivo: conciliacion.global.estado === 'BLOQUEADA' ? 'GLOBAL_BLOQUEADA' : 'GLOBAL_PENDIENTE',
      motivosGlobales: conciliacion.global.motivos,
      motivosReadiness: readiness.motivos,
      incidencias: [],
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('SIN_REGISTROS')) {
    return {
      estado: 'SIN_REGISTROS',
      motivo: 'BANCO_SIN_FILAS',
      asignadas: readiness.asignadas,
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('BLOQUEANTES_DEL_BANCO')) {
    const bloqueantes = incidenciasBna(conciliacion, 'BLOQUEANTE');
    if (bloqueantes.every((incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO')) {
      return {
        estado: 'MAPEO_NO_RESUELTO',
        motivo: 'LIQUIDACION_SIN_MAPEO',
        puntos: [],
        incidencias: resumenIncidencias(bloqueantes),
        pendienteHomologacion: true,
      };
    }
    return {
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'BLOQUEANTES_BNA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(bloqueantes),
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('REVISIONES_DEL_BANCO_SIN_RESOLVER')) {
    return {
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'REVISIONES_BNA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(incidenciasBna(conciliacion, 'REQUIERE_REVISION')),
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('GENERADOR_NO_HABILITADO')) {
    return {
      estado: 'CONTRATO_BNA_BLOQUEADO',
      bloqueos: aptitud.bloqueos,
      referencias: referenciasDeBloqueos(aptitud.bloqueos),
      interpretacionesByte: aptitud.interpretacionesByte,
      pendienteHomologacion: true,
    };
  }

  const perfilBna = perfilBnaDesdePerfil(perfilCompatible);

  // Cobertura integral: el conjunto esperado es el asignado por la conciliación,
  // contrastado con `global.bna` y `readiness.asignadas`; no se limita a los R2 ya
  // emitidos. Se evalúa antes de la compuerta para que una omisión, duplicación o
  // diferencia de importe nunca quede oculta por la homologación pendiente.
  const analisis = analizarCoberturaPagosBna(
    conciliacion,
    readiness.asignadas,
    pagosBnaDesdeConciliacion(conciliacion),
  );
  if (!analisis.cobertura.completa) {
    return {
      estado: 'COBERTURA_PAGOS_INCOMPLETA',
      motivo:
        analisis.cobertura.noConvertibles.length > 0
          ? 'FILAS_BNA_NO_CONVERTIBLES'
          : 'INVARIANTES_PAGOS_BNA',
      ...analisis.cobertura,
      pendienteHomologacion: true,
    };
  }

  const { pagos } = analisis;

  // BNA-B2: el identificador solo se compone si el snapshot completo vuelve a validar
  // contra las líneas conciliadas y su revisión coincide con la estampada al conciliar.
  // La política derivada conserva sin cambios BNA-1, BNA-2, BNA-6 y la resolución
  // provisional P-17 de la política efectiva.
  const resolucionIdentificador = resolverSeleccionIdentificadorHaberesBna(
    entrada.seleccionIdentificadorHaberesBna ?? null,
    entrada.huellaFinnegans ?? '',
    lineasBancariasEfectivasDeConciliacion(conciliacion, 'BNA_GT_HABERES'),
  );
  const revisionConciliacion = conciliacion.revisionSeleccionIdentificadorHaberesBna ?? null;
  const resolucionVigente =
    resolucionIdentificador !== null &&
    resolucionIdentificador.pendientes.length === 0 &&
    revisionSeleccionIdentificadorHaberesBna(resolucionIdentificador) === revisionConciliacion
      ? resolucionIdentificador
      : null;
  const politica = politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucionVigente);
  const puntos = puntosSinResolver(perfilBna, parametros, pagos, politica);
  if (puntos.length > 0) {
    return {
      estado: 'MAPEO_NO_RESUELTO',
      motivo: 'POLITICA_SIN_RESOLUCION',
      puntos,
      incidencias: [],
      pendienteHomologacion: true,
    };
  }

  // Compuerta independiente de homologación/autorización. No se deriva del contrato,
  // del perfil, de los parámetros ni de ninguna propiedad de la entrada, y se evalúa
  // al final para conservar el diagnóstico de contrato, cobertura y política. Aun con
  // BNA-1 resuelto, impide `LISTO_TECNICAMENTE` y, por lo tanto, `GENERADO`.
  if (!produccionBnaHabilitada()) {
    return {
      estado: 'HOMOLOGACION_BNA_PENDIENTE',
      motivo: 'HOMOLOGACION_BNA_PENDIENTE',
      pendienteHomologacion: true,
    };
  }

  return {
    estado: 'LISTO_TECNICAMENTE',
    perfil: perfilBna,
    parametros,
    pagos,
    politica,
    readiness,
    aptitud,
    cobertura: analisis.cobertura,
  };
}

function puntosDeErrores(errores: readonly ErrorSerializacionBna[]): readonly PuntoPoliticaBna[] {
  const puntos = new Set<PuntoPoliticaBna>();
  for (const error of errores) {
    if ('punto' in error) {
      puntos.add(error.punto);
    }
  }
  return [...puntos];
}

/**
 * Genera bytes solo si la evaluación está técnicamente lista. Después de serializar
 * inspecciona de forma independiente; si falla, no devuelve archivo. No descarga.
 */
export function generarBna(entrada: EntradaGeneracionBna): ResultadoGeneracionBna {
  const evaluacion = evaluarGeneracionBna(entrada);
  if (evaluacion.estado !== 'LISTO_TECNICAMENTE') {
    return evaluacion;
  }

  const archivo = serializarBna(
    evaluacion.perfil,
    evaluacion.parametros,
    evaluacion.pagos,
    evaluacion.politica,
  );
  if (!archivo.ok) {
    if (
      archivo.error.some((error) => 'codigo' in error && error.codigo === 'POLITICA_SIN_RESOLUCION')
    ) {
      return {
        estado: 'MAPEO_NO_RESUELTO',
        motivo: 'POLITICA_SIN_RESOLUCION',
        puntos: puntosDeErrores(archivo.error),
        incidencias: [],
        pendienteHomologacion: true,
      };
    }
    return {
      estado: 'SERIALIZACION_FALLIDA',
      errores: archivo.error,
      pendienteHomologacion: true,
    };
  }

  const inspeccion = inspeccionarBna(archivo.value.bytes, evaluacion.parametros);
  if (!inspeccion.ok) {
    return {
      estado: 'INSPECCION_BNA_FALLIDA',
      errores: inspeccion.error,
      pendienteHomologacion: true,
    };
  }

  return {
    estado: 'GENERADO',
    bytes: archivo.value.bytes,
    totales: archivo.value.totales,
    inspeccion: inspeccion.value,
    separador: evaluacion.parametros.lineSeparator,
    trailingSeparator: evaluacion.parametros.trailingSeparator,
    pendienteHomologacion: true,
  };
}
