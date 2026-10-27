// Fachada de generación Patagonia B.2 (CP-F6-C). Es el único punto de `src/run/` que
// conecta perfil importado, conciliación, readiness, modelo Patagonia, política productiva,
// mapper, serializer e inspector. No duplica reglas de conciliación, cuentas, importes,
// fixed-width ni contrato Patagonia. La generación productiva sigue bloqueada por PAT-1 y
// PAT-2: la fachada se detiene en `CONTRATO_PATAGONIA_BLOQUEADO` antes de generar bytes.
// Nunca descarga ni escribe archivos: solo devuelve bytes en memoria si todas las
// compuertas pasan.
import type { CodigoIncidencia, NivelIncidencia, SourceRef } from '../domain/incidencias';
import {
  TIPO_DOCUMENTO_CON_PROVINCIA,
  type CampoMaestro,
  type CodigoProvincia,
} from '../domain/maestro';
import type { CompanyProfileImportado, CompanyProfileV3 } from '../profile';
import type {
  FilaConciliada,
  IncidenciaConciliada,
  MotivoGlobal,
  MotivoReadiness,
  PatagoniaReadiness,
  ResultadoConciliacion,
  Totales,
} from '../reconciliation';
import { evaluarReadiness } from '../reconciliation';
import {
  POLITICA_PATAGONIA_PRODUCTIVA,
  aptitudPatagonia,
  crearSpecPatagoniaB2,
  inspeccionarPatagonia,
  serializarPatagonia,
} from '../banks/patagonia-b2';
import type {
  AptitudPatagonia,
  ErrorInspeccionPatagonia,
  ErrorSerializacionPatagonia,
  InspeccionPatagonia,
  PagoPatagonia,
  ParametrosEnvioPatagonia,
  PatagoniaIssueId,
  PerfilPatagonia,
  PoliticaPatagonia,
  PuntoPoliticaPatagonia,
  ResolucionPatagonia,
  SpecPatagonia,
  TotalesPatagonia,
} from '../banks/patagonia-b2';

/** Configuración mínima que falta para que la fachada pueda evaluar Patagonia. */
export type MotivoConfiguracionPatagonia =
  'PERFIL_AUSENTE' | 'PERFIL_V1' | 'PERFIL_V2' | 'PARAMETROS_AUSENTES';

/** Por qué la conciliación no habilita el archivo Patagonia. */
export type MotivoConciliacionPatagonia =
  | 'SIN_CONCILIACION'
  | 'GLOBAL_PENDIENTE'
  | 'GLOBAL_BLOQUEADA'
  | 'BLOQUEANTES_PATAGONIA'
  | 'REVISIONES_PATAGONIA';

export type MotivoSinRegistrosPatagonia = 'BANCO_SIN_FILAS' | 'SIN_PAGOS_CONVERTIBLES';

export type MotivoMapeoPatagonia = 'LIQUIDACION_SIN_MAPEO' | 'POLITICA_SIN_RESOLUCION';

/** Resumen sin valores observados: la fachada no expone PII en diagnósticos. */
export interface IncidenciaResumenPatagonia {
  readonly id: string;
  readonly codigo: CodigoIncidencia;
  readonly nivel: NivelIncidencia;
  readonly refs: readonly SourceRef[];
}

export interface ConfiguracionIncompletaPatagonia {
  readonly estado: 'CONFIGURACION_INCOMPLETA';
  readonly motivos: readonly MotivoConfiguracionPatagonia[];
  readonly perfilVersion: '1' | '2' | '3' | null;
  readonly pendienteHomologacion: true;
}

export interface ConciliacionNoListaPatagonia {
  readonly estado: 'CONCILIACION_NO_LISTA';
  readonly motivo: MotivoConciliacionPatagonia;
  readonly motivosGlobales: readonly MotivoGlobal[];
  readonly motivosReadiness: readonly MotivoReadiness[];
  readonly incidencias: readonly IncidenciaResumenPatagonia[];
  readonly pendienteHomologacion: true;
}

export interface SinRegistrosPatagonia {
  readonly estado: 'SIN_REGISTROS';
  readonly motivo: MotivoSinRegistrosPatagonia;
  readonly asignadas: Totales;
  readonly pendienteHomologacion: true;
}

export interface ContratoBloqueadoPatagonia {
  readonly estado: 'CONTRATO_PATAGONIA_BLOQUEADO';
  readonly bloqueos: AptitudPatagonia['bloqueos'];
  /** Issues documentales asociadas a los campos bloqueados (hoy PAT-1 y PAT-2). */
  readonly referencias: readonly PatagoniaIssueId[];
  /** Interpretaciones pendientes que afectan bytes: informativas, no bloqueos nuevos. */
  readonly interpretacionesByte: readonly PatagoniaIssueId[];
  readonly pendienteHomologacion: true;
}

export interface MapeoNoResueltoPatagonia {
  readonly estado: 'MAPEO_NO_RESUELTO';
  readonly motivo: MotivoMapeoPatagonia;
  readonly puntos: readonly PuntoPoliticaPatagonia[];
  readonly incidencias: readonly IncidenciaResumenPatagonia[];
  readonly pendienteHomologacion: true;
}

export interface SerializacionFallidaPatagonia {
  readonly estado: 'SERIALIZACION_FALLIDA';
  readonly errores: readonly ErrorSerializacionPatagonia[];
  readonly pendienteHomologacion: true;
}

export interface InspeccionFallidaPatagonia {
  readonly estado: 'INSPECCION_PATAGONIA_FALLIDA';
  readonly errores: readonly ErrorInspeccionPatagonia[];
  readonly pendienteHomologacion: true;
}

export interface GeneradoPatagonia {
  readonly estado: 'GENERADO';
  /** Bytes en memoria. La fachada no crea Blob, no descarga y no escribe archivos. */
  readonly bytes: Uint8Array;
  readonly totales: TotalesPatagonia;
  readonly inspeccion: InspeccionPatagonia;
  readonly separador: '\n' | '\r\n';
  readonly trailingSeparator: boolean;
  readonly pendienteHomologacion: true;
}

export type ResultadoNoGeneradoPatagonia =
  | ConfiguracionIncompletaPatagonia
  | ConciliacionNoListaPatagonia
  | SinRegistrosPatagonia
  | ContratoBloqueadoPatagonia
  | MapeoNoResueltoPatagonia;

/** Evaluación sin serializar: distingue "listo técnicamente" de cada bloqueo. */
export interface ListoTecnicamentePatagonia {
  readonly estado: 'LISTO_TECNICAMENTE';
  readonly perfil: PerfilPatagonia;
  readonly parametros: ParametrosEnvioPatagonia;
  readonly pagos: readonly PagoPatagonia[];
  readonly readiness: PatagoniaReadiness;
  readonly aptitud: AptitudPatagonia;
}

export type EvaluacionGeneracionPatagonia =
  ListoTecnicamentePatagonia | ResultadoNoGeneradoPatagonia;

export type ResultadoGeneracionPatagonia =
  | GeneradoPatagonia
  | ResultadoNoGeneradoPatagonia
  | SerializacionFallidaPatagonia
  | InspeccionFallidaPatagonia;

/**
 * Entrada pública productiva. No admite política, aptitud, serializer ni inspector:
 * la fachada siempre usa `POLITICA_PATAGONIA_PRODUCTIVA`, `aptitudPatagonia(...)`,
 * `serializarPatagonia` e `inspeccionarPatagonia`.
 */
export interface EntradaGeneracionPatagonia {
  /** Perfil ya importado/validado. v1/v2 no contienen la configuración Patagonia. */
  readonly perfil: CompanyProfileImportado | null;
  /** Resultado de F2 con decisiones y mapeos ya aplicados; es la fuente de verdad. */
  readonly conciliacion: ResultadoConciliacion | null;
  /** Parámetros explícitos del envío: sin defaults de fechas, envío, concepto ni separadores. */
  readonly parametros: ParametrosEnvioPatagonia | null;
}

/** Copia explícita SOLO del número de EMPRESA validado en el perfil v3. */
export function perfilPatagoniaDesdePerfil(perfil: CompanyProfileV3): PerfilPatagonia {
  return { numeroEmpresa: perfil.patagonia.numeroEmpresa };
}

function esValido<T>(
  campo: CampoMaestro<T>,
): campo is Extract<CampoMaestro<T>, { readonly estado: 'VALIDO' }> {
  return campo.estado === 'VALIDO';
}

function impideElPago(fila: FilaConciliada): boolean {
  return fila.incidencias.some(
    (incidencia) =>
      incidencia.resolucion === undefined &&
      (incidencia.alcance === 'PATAGONIA_B2' || incidencia.alcance === 'GLOBAL') &&
      (incidencia.nivel === 'BLOQUEANTE' || incidencia.nivel === 'REQUIERE_REVISION'),
  );
}

function pagoDeFila(fila: FilaConciliada): PagoPatagonia | undefined {
  if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'PATAGONIA_B2') {
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
  if (impideElPago(fila)) {
    return undefined;
  }

  const patagonia = registro.patagonia;
  const tipoCuenta = patagonia.tipoCuenta;
  const numeroCuenta = patagonia.numeroCuenta;
  const codigoBanco = patagonia.codigoBanco;
  const codigoSucursal = patagonia.codigoSucursal;
  const tipoDocumento = patagonia.tipoDocumento;
  const numeroDocumento = patagonia.numeroDocumento;
  const provinciaDocumento = patagonia.provinciaDocumento;
  const codigoDependencia = patagonia.codigoDependencia;
  if (
    !esValido(tipoCuenta) ||
    !esValido(numeroCuenta) ||
    !esValido(codigoBanco) ||
    !esValido(codigoSucursal) ||
    !esValido(tipoDocumento) ||
    !esValido(numeroDocumento) ||
    !esValido(codigoDependencia)
  ) {
    return undefined;
  }

  let provincia: CodigoProvincia | null;
  if (tipoDocumento.valor === TIPO_DOCUMENTO_CON_PROVINCIA) {
    if (!esValido(provinciaDocumento)) {
      return undefined;
    }
    provincia = provinciaDocumento.valor;
  } else {
    if (provinciaDocumento.estado !== 'VACIO') {
      return undefined;
    }
    provincia = null;
  }

  return {
    ref: fila.linea.ref,
    neto,
    tipoCuenta: tipoCuenta.valor,
    numeroCuenta: numeroCuenta.valor,
    codigoBanco: codigoBanco.valor,
    codigoSucursal: codigoSucursal.valor,
    tipoDocumento: tipoDocumento.valor,
    numeroDocumento: numeroDocumento.valor,
    provinciaDocumento: provincia,
    codigoDependencia: codigoDependencia.valor,
    legajo: fila.linea.legajo,
    apellido: fila.linea.apellido,
    nombre: fila.linea.nombre,
    descripcion: fila.linea.descripcion,
  };
}

/**
 * Pagos Patagonia derivados exclusivamente de la conciliación, preservando el orden de la
 * corrida y su `SourceRef`. No lee XLSX ni reimplementa reglas de F2.
 */
export function pagosPatagoniaDesdeConciliacion(
  resultado: ResultadoConciliacion,
): readonly PagoPatagonia[] {
  const pagos: PagoPatagonia[] = [];
  for (const fila of resultado.filas) {
    const pago = pagoDeFila(fila);
    if (pago !== undefined) {
      pagos.push(pago);
    }
  }
  return pagos;
}

function incidenciasPatagonia(
  resultado: ResultadoConciliacion,
  nivel: 'BLOQUEANTE' | 'REQUIERE_REVISION',
): readonly IncidenciaConciliada[] {
  return resultado.incidencias.filter(
    (incidencia) =>
      incidencia.alcance === 'PATAGONIA_B2' &&
      incidencia.resolucion === undefined &&
      incidencia.nivel === nivel,
  );
}

function resumenIncidencias(
  incidencias: readonly IncidenciaConciliada[],
): readonly IncidenciaResumenPatagonia[] {
  return incidencias.map((incidencia) => ({
    id: incidencia.id,
    codigo: incidencia.codigo,
    nivel: incidencia.nivel,
    refs: incidencia.refs,
  }));
}

function referenciasDeBloqueos(
  bloqueos: AptitudPatagonia['bloqueos'],
  spec: SpecPatagonia,
): readonly PatagoniaIssueId[] {
  const referencias = new Set<PatagoniaIssueId>();
  for (const bloqueo of bloqueos) {
    if (bloqueo.tipo !== 'campo') {
      continue;
    }
    const registro = spec.records.find((item) => item.id === bloqueo.registroId);
    const campo = registro?.fields.find((item) => item.id === bloqueo.campoId);
    for (const issue of campo?.issues ?? []) {
      referencias.add(issue);
    }
  }
  return [...referencias];
}

function puntosSinResolver(
  perfil: PerfilPatagonia,
  parametros: ParametrosEnvioPatagonia,
  pagos: readonly PagoPatagonia[],
  politica: PoliticaPatagonia,
): readonly PuntoPoliticaPatagonia[] {
  const puntos = new Set<PuntoPoliticaPatagonia>();
  const revisar = (resolucion: ResolucionPatagonia<unknown>): void => {
    if (resolucion.estado === 'SIN_RESOLUCION') {
      puntos.add(resolucion.punto);
    }
  };
  revisar(politica.loteo(pagos));
  revisar(politica.versionLote(perfil, parametros));
  for (const pago of pagos) {
    revisar(politica.tipoLiquidacion(pago));
    revisar(politica.nombre(pago));
    revisar(politica.provinciaNoAplica(pago));
    revisar(politica.comprobanteNoInformado(pago));
  }
  return [...puntos];
}

function configuracionIncompleta(
  motivos: readonly MotivoConfiguracionPatagonia[],
  perfil: CompanyProfileImportado | null,
): ConfiguracionIncompletaPatagonia {
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
export function evaluarGeneracionPatagonia(
  entrada: EntradaGeneracionPatagonia,
): EvaluacionGeneracionPatagonia {
  const { perfil, conciliacion, parametros } = entrada;
  const motivos: MotivoConfiguracionPatagonia[] = [];
  if (perfil === null) {
    motivos.push('PERFIL_AUSENTE');
  } else if (perfil.schemaVersion === '1') {
    motivos.push('PERFIL_V1');
  } else if (perfil.schemaVersion === '2') {
    motivos.push('PERFIL_V2');
  }
  if (parametros === null) {
    motivos.push('PARAMETROS_AUSENTES');
  }
  if (perfil?.schemaVersion !== '3' || parametros === null) {
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

  const spec = crearSpecPatagoniaB2(parametros);
  const aptitud = aptitudPatagonia(spec);
  const readiness = evaluarReadiness(conciliacion, {
    configuracionCompleta: { BNA_GT_HABERES: false, PATAGONIA_B2: true },
    generadorHabilitado: {
      BNA_GT_HABERES: false,
      PATAGONIA_B2: aptitud.generadorHabilitado,
    },
  }).patagonia;

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
    const bloqueantes = incidenciasPatagonia(conciliacion, 'BLOQUEANTE');
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
      motivo: 'BLOQUEANTES_PATAGONIA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(bloqueantes),
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('REVISIONES_DEL_BANCO_SIN_RESOLVER')) {
    return {
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'REVISIONES_PATAGONIA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(incidenciasPatagonia(conciliacion, 'REQUIERE_REVISION')),
      pendienteHomologacion: true,
    };
  }

  if (readiness.motivos.includes('GENERADOR_NO_HABILITADO')) {
    return {
      estado: 'CONTRATO_PATAGONIA_BLOQUEADO',
      bloqueos: aptitud.bloqueos,
      referencias: referenciasDeBloqueos(aptitud.bloqueos, spec),
      interpretacionesByte: aptitud.interpretacionesByte,
      pendienteHomologacion: true,
    };
  }

  const perfilPatagonia = perfilPatagoniaDesdePerfil(perfil);
  const pagos = pagosPatagoniaDesdeConciliacion(conciliacion);
  if (pagos.length === 0) {
    return {
      estado: 'SIN_REGISTROS',
      motivo: 'SIN_PAGOS_CONVERTIBLES',
      asignadas: readiness.asignadas,
      pendienteHomologacion: true,
    };
  }

  const puntos = puntosSinResolver(
    perfilPatagonia,
    parametros,
    pagos,
    POLITICA_PATAGONIA_PRODUCTIVA,
  );
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
    perfil: perfilPatagonia,
    parametros,
    pagos,
    readiness,
    aptitud,
  };
}

function puntosDeErrores(
  errores: readonly ErrorSerializacionPatagonia[],
): readonly PuntoPoliticaPatagonia[] {
  const puntos = new Set<PuntoPoliticaPatagonia>();
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
export function generarPatagonia(
  entrada: EntradaGeneracionPatagonia,
): ResultadoGeneracionPatagonia {
  const evaluacion = evaluarGeneracionPatagonia(entrada);
  if (evaluacion.estado !== 'LISTO_TECNICAMENTE') {
    return evaluacion;
  }

  const archivo = serializarPatagonia(
    evaluacion.perfil,
    evaluacion.parametros,
    evaluacion.pagos,
    POLITICA_PATAGONIA_PRODUCTIVA,
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

  const inspeccion = inspeccionarPatagonia(archivo.value.bytes, evaluacion.parametros);
  if (!inspeccion.ok) {
    return {
      estado: 'INSPECCION_PATAGONIA_FALLIDA',
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
