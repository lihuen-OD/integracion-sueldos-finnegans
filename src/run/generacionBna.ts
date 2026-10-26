// Fachada de generación BNA (CP-F5-C). Es el único punto de `src/run/` que conecta
// perfil importado, conciliación, readiness, modelo BNA, política, mapper, serializer e
// inspector. No duplica reglas de conciliación, CBU/CUIL, importes, fixed-width ni
// contrato BNA: consume los contratos ya aprobados. La generación productiva sigue
// bloqueada por BNA-1 (`POLITICA_BNA_PRODUCTIVA` no resuelve ningún punto abierto) y por
// P-09/P-10 cuando la conciliación los informa. Nunca dispara una descarga ni escribe
// archivos: devuelve bytes en memoria solo si TODAS las compuertas pasan.
import type { CodigoIncidencia, NivelIncidencia, SourceRef } from '../domain/incidencias';
import type { CompanyProfileImportado, CompanyProfileV2 } from '../profile';
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
  POLITICA_BNA_PRODUCTIVA,
  REGISTRO_BNA_1,
  REGISTRO_BNA_2,
  REGISTRO_BNA_3,
  aptitudBna,
  crearSpecBna,
  inspeccionarBna,
  serializarBna,
} from '../banks/bna';
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
export type MotivoConfiguracionBna = 'PERFIL_AUSENTE' | 'PERFIL_V1' | 'PARAMETROS_AUSENTES';

/** Por qué la conciliación no habilita el archivo BNA. */
export type MotivoConciliacionBna =
  | 'SIN_CONCILIACION'
  | 'GLOBAL_PENDIENTE'
  | 'GLOBAL_BLOQUEADA'
  | 'BLOQUEANTES_BNA'
  | 'REVISIONES_BNA';

export type MotivoSinRegistrosBna = 'BANCO_SIN_FILAS' | 'SIN_PAGOS_CONVERTIBLES';

export type MotivoMapeoBna = 'LIQUIDACION_SIN_MAPEO' | 'POLITICA_SIN_RESOLUCION';

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
  readonly perfilVersion: '1' | '2' | null;
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
  | MapeoNoResueltoBna;

/** Evaluación sin serializar: distingue "listo técnicamente" de cada bloqueo. */
export interface ListoTecnicamenteBna {
  readonly estado: 'LISTO_TECNICAMENTE';
  readonly perfil: PerfilBna;
  readonly parametros: ParametrosEnvioBna;
  readonly pagos: readonly PagoBna[];
  readonly politica: PoliticaBna;
  readonly readiness: BnaReadiness;
  readonly aptitud: AptitudBna;
}

export type EvaluacionGeneracionBna = ListoTecnicamenteBna | ResultadoNoGeneradoBna;

export type ResultadoGeneracionBna =
  GeneradoBna | ResultadoNoGeneradoBna | SerializacionFallidaBna | InspeccionFallidaBna;

/**
 * Entrada pública productiva. No admite política, aptitud, serializer ni inspector:
 * la fachada siempre usa `POLITICA_BNA_PRODUCTIVA`, `aptitudBna(crearSpecBna(...))`,
 * `serializarBna` e `inspeccionarBna`. Las hipótesis sintéticas viven solo en tests.
 */
export interface EntradaGeneracionBna {
  /** Perfil ya importado/validado. v1 es válido históricamente, pero no genera BNA. */
  readonly perfil: CompanyProfileImportado | null;
  /** Resultado de F2 con decisiones y mapeos ya aplicados; es la fuente de verdad. */
  readonly conciliacion: ResultadoConciliacion | null;
  /** Parámetros explícitos del envío: sin defaults de fecha, número, criterio, referencia ni separadores. */
  readonly parametros: ParametrosEnvioBna | null;
}

const REGISTROS_CONTRATO_BNA = [REGISTRO_BNA_1, REGISTRO_BNA_2, REGISTRO_BNA_3] as const;

/** Copia explícita SOLO de los cuatro datos BNA ya validados en el perfil v2. */
export function perfilBnaDesdePerfil(perfil: CompanyProfileV2): PerfilBna {
  return {
    cuitEmpresa: perfil.cuitEmpresa,
    cbuEmpresa: perfil.bna.cbuEmpresa,
    codigoConvenio: perfil.bna.codigoConvenio,
    moneda: perfil.bna.moneda,
  };
}

function impideElPago(fila: FilaConciliada): boolean {
  return fila.incidencias.some(
    (incidencia) =>
      incidencia.resolucion === undefined &&
      (incidencia.alcance === 'BNA_GT_HABERES' || incidencia.alcance === 'GLOBAL') &&
      (incidencia.nivel === 'BLOQUEANTE' || incidencia.nivel === 'REQUIERE_REVISION'),
  );
}

function pagoDeFila(fila: FilaConciliada): PagoBna | undefined {
  if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'BNA_GT_HABERES') {
    return undefined;
  }
  const { neto } = fila.linea;
  if (neto === null || neto <= 0n) {
    return undefined;
  }
  const registro = fila.registro;
  if (registro === null) {
    return undefined;
  }
  if (registro.cuil === null || registro.cbu.estado !== 'VALIDO') {
    return undefined;
  }
  if (impideElPago(fila)) {
    return undefined;
  }
  return {
    ref: fila.linea.ref,
    cuil: registro.cuil,
    cbu: registro.cbu.valor,
    neto,
    descripcion: fila.linea.descripcion,
  };
}

/**
 * Pagos BNA derivados exclusivamente de la conciliación, preservando el orden de la
 * corrida y su `SourceRef`. No lee XLSX ni reimplementa reglas de F2.
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
 * aptitud contractual: no se crea una segunda readiness.
 */
export function evaluarGeneracionBna(entrada: EntradaGeneracionBna): EvaluacionGeneracionBna {
  const { perfil, conciliacion, parametros } = entrada;
  const motivos: MotivoConfiguracionBna[] = [];
  if (perfil === null) {
    motivos.push('PERFIL_AUSENTE');
  } else if (perfil.schemaVersion !== '2') {
    motivos.push('PERFIL_V1');
  }
  if (parametros === null) {
    motivos.push('PARAMETROS_AUSENTES');
  }
  if (perfil?.schemaVersion !== '2' || parametros === null) {
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

  const perfilBna = perfilBnaDesdePerfil(perfil);
  const pagos = pagosBnaDesdeConciliacion(conciliacion);
  if (pagos.length === 0) {
    return {
      estado: 'SIN_REGISTROS',
      motivo: 'SIN_PAGOS_CONVERTIBLES',
      asignadas: readiness.asignadas,
      pendienteHomologacion: true,
    };
  }

  const politica = POLITICA_BNA_PRODUCTIVA;
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

  return {
    estado: 'LISTO_TECNICAMENTE',
    perfil: perfilBna,
    parametros,
    pagos,
    politica,
    readiness,
    aptitud,
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
