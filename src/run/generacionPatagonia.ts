// Fachada de generación Patagonia B.2 (CP-F6-C). Es el único punto de `src/run/` que
// conecta perfil importado, conciliación, readiness, modelo Patagonia, política productiva,
// mapper, serializer e inspector. No duplica reglas de conciliación, cuentas, importes,
// fixed-width ni contrato Patagonia. PAT-1 quedó CONFIRMADA para ESPACIOS (PC-01) y
// PAT-2 para ALFANUMERICA (PC-02), que es la única hipótesis PAT-2 aceptada por esta
// fachada: `NUMERICA` se rechaza explícitamente con `HIPOTESIS_PAT2_NO_CONFIRMADA` y
// sin bytes. Aun sin bloqueos contractuales, la compuerta independiente de autorización
// (`autorizacion.ts`) mantiene la producción cerrada con `HOMOLOGACION_PATAGONIA_PENDIENTE`.
// PAT-8 se valida en el flujo: solo `001` está confirmado por el banco; los demás
// códigos del Anexo I se informan como `TIPO_DOCUMENTO_NO_CONFIRMADO` sin generar.
// Nunca descarga ni escribe archivos: solo devuelve bytes en memoria si todas las
// compuertas pasan. C5-B deriva la política de `tipoLiquidacion` desde el snapshot C5-A
// de la misma corrida, únicamente para la evaluación técnica: la generación productiva,
// el mapper, la serialización y el resto de los campos bancarios no cambian.
import { claveRef } from '../domain/incidencias';
import type { CodigoIncidencia, NivelIncidencia, SourceRef } from '../domain/incidencias';
import {
  CAMPOS_BANCARIOS,
  TIPO_DOCUMENTO_CON_PROVINCIA,
  type CampoBancario,
  type CampoMaestro,
  type CodigoProvincia,
  type DatosPatagonia,
  type TipoDocumentoPatagonia,
} from '../domain/maestro';
import { sumarTodos } from '../domain/money';
import type { Centavos } from '../domain/money';
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
  DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  aptitudPatagonia,
  construirNombrePatagonia,
  crearSpecPatagoniaB2,
  diagnosticoPoliticaPatagonia,
  estrategiaLotesPatagonia,
  inspeccionarPatagonia,
  produccionPatagoniaHabilitada,
  serializarPatagonia,
  validarComprobantePatagonia,
  validarTipoDocumentoFlujoConfirmadoPatagonia,
} from '../banks/patagonia-b2';
import type {
  AptitudPatagonia,
  ErrorComprobantePatagonia,
  ErrorConstruccionNombrePatagonia,
  ErrorInspeccionPatagonia,
  ErrorLoteoPatagonia,
  ErrorSerializacionPatagonia,
  InspeccionPatagonia,
  PagoPatagonia,
  ParametrosEnvioPatagonia,
  PatagoniaIssueId,
  PerfilPatagonia,
  PoliticaPatagonia,
  PuntoPoliticaPatagonia,
  RequisitoPoliticaPatagonia,
  ResolucionPatagonia,
  SpecPatagonia,
  TotalesPatagonia,
} from '../banks/patagonia-b2';
import {
  politicaPatagoniaDesdeResolucionPatagonia,
  resolverSeleccionLiquidacionPatagonia,
  revisionSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from './seleccionLiquidacionPatagonia';

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

/**
 * Motivo por el que una fila asignada a Patagonia no se convierte en pago. Los motivos de
 * conciliación se informan con su incidencia y campo; el control de cobertura los conserva
 * para que ninguna fila elegible desaparezca en silencio.
 */
export type MotivoNoConvertiblePatagonia =
  | 'NETO_AUSENTE'
  | 'NETO_NEGATIVO'
  | 'NETO_CERO'
  | 'SIN_MAESTRO'
  | 'INCIDENCIA_PATAGONIA_BLOQUEANTE'
  | 'INCIDENCIA_PATAGONIA_EN_REVISION'
  | 'INCIDENCIA_GLOBAL_BLOQUEANTE'
  | 'INCIDENCIA_GLOBAL_EN_REVISION'
  | 'CAMPO_PATAGONIA_FALTANTE'
  | 'CAMPO_PATAGONIA_INVALIDO'
  | 'PROVINCIA_INCOMPATIBLE';

export interface FilaNoConvertiblePatagonia {
  readonly ref: SourceRef;
  readonly motivo: MotivoNoConvertiblePatagonia;
  /** Campo bancario afectado, cuando el motivo es de datos del maestro o de una incidencia. */
  readonly campo?: CampoBancario;
  /** Incidencia de conciliación que impidió el pago, si el motivo proviene de una. */
  readonly incidenciaId?: string;
}

/** Exclusión ya decidida por la conciliación (hoy solo neto cero); nunca es una omisión. */
export interface FilaExcluidaPatagonia {
  readonly ref: SourceRef;
  readonly motivo: 'NETO_CERO';
}

export interface CoberturaPagosPatagonia {
  /** Filas INCLUIDA(PATAGONIA_B2) calculadas desde la conciliación. */
  readonly asignadas: Totales;
  readonly convertidas: Totales;
  readonly noConvertibles: readonly FilaNoConvertiblePatagonia[];
  /** Filas que la conciliación ya excluyó por una regla legítima (neto cero). */
  readonly excluidas: readonly FilaExcluidaPatagonia[];
  /** Todas las refs asignadas y convertidas son únicas y pertenecen a una fila asignada. */
  readonly refsUnicas: boolean;
  /** Asignadas = convertidas + no convertibles, en cantidad e importe exacto (bigint). */
  readonly totalesCoinciden: boolean;
  /** Lo calculado desde las filas coincide con `global.patagonia`. */
  readonly globalCoincide: boolean;
  /** Lo calculado desde las filas coincide con `readiness.asignadas`. */
  readonly readinessCoincide: boolean;
  readonly completa: boolean;
}

export type MotivoCoberturaPatagonia =
  'FILAS_PATAGONIA_NO_CONVERTIBLES' | 'INVARIANTES_PAGOS_PATAGONIA';

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
  /** Issues documentales asociadas a los campos bloqueados (vacío con C2.3). */
  readonly referencias: readonly PatagoniaIssueId[];
  /** Interpretaciones pendientes que afectan bytes: informativas, no bloqueos nuevos. */
  readonly interpretacionesByte: readonly PatagoniaIssueId[];
  readonly pendienteHomologacion: true;
}

/**
 * PAT-2: Banco Patagonia confirmó la forma alfanumérica (15 posiciones, 85–99,
 * izquierda, espacios a la derecha). La hipótesis histórica `NUMERICA` no puede
 * generar: se rechaza explícitamente antes de mapear o serializar.
 */
export interface HipotesisPat2NoConfirmadaPatagonia {
  readonly estado: 'HIPOTESIS_PAT2_NO_CONFIRMADA';
  readonly motivo: 'HIPOTESIS_PAT2_NO_CONFIRMADA';
  readonly hipotesis: 'NUMERICA';
  readonly hipotesisConfirmada: 'ALFANUMERICA';
  readonly pendienteHomologacion: true;
}

/**
 * El contrato puede estar sin bloqueos, pero la producción no está autorizada.
 * No hay bytes: la compuerta es independiente del contrato y no se abre con
 * perfil, parámetros, entorno ni propiedades adicionales de la entrada.
 */
export interface HomologacionPendientePatagonia {
  readonly estado: 'HOMOLOGACION_PATAGONIA_PENDIENTE';
  readonly motivo: 'HOMOLOGACION_PATAGONIA_PENDIENTE';
  readonly pendienteHomologacion: true;
}

/**
 * PAT-8: el banco solo confirmó `001` para el flujo actual. Los demás códigos
 * del Anexo I siguen siendo válidos en el catálogo general, pero no están
 * confirmados para generar. No hay bytes y no se adivina el código.
 */
export interface TipoDocumentoNoConfirmadoPatagonia {
  readonly estado: 'TIPO_DOCUMENTO_NO_CONFIRMADO';
  readonly motivo: 'TIPO_DOCUMENTO_NO_CONFIRMADO';
  readonly tiposDocumento: readonly TipoDocumentoPatagonia[];
  readonly refs: readonly SourceRef[];
  readonly pendienteHomologacion: true;
}

/**
 * Una fila asignada a Patagonia no llegó a pago, o los invariantes de cantidad/importe no
 * cierran. Es un error explícito de cobertura: no se genera para un subconjunto silencioso.
 */
export interface CoberturaIncompletaPatagonia extends CoberturaPagosPatagonia {
  readonly estado: 'COBERTURA_PAGOS_INCOMPLETA';
  readonly motivo: MotivoCoberturaPatagonia;
  readonly pendienteHomologacion: true;
}

export interface MapeoNoResueltoPatagonia {
  readonly estado: 'MAPEO_NO_RESUELTO';
  readonly motivo: MotivoMapeoPatagonia;
  readonly puntos: readonly PuntoPoliticaPatagonia[];
  /** Diagnóstico de cada punto pendiente: campo, requisito, responsables y origen. */
  readonly requisitos: readonly RequisitoPoliticaPatagonia[];
  readonly incidencias: readonly IncidenciaResumenPatagonia[];
  readonly pendienteHomologacion: true;
}

/**
 * Un dato de un pago no satisface el contrato del registro, aunque la política esté
 * resuelta. Es distinto de `MAPEO_NO_RESUELTO`: no falta una decisión de política, hay un
 * valor inválido concreto. No contiene el valor observado, solo el campo y la referencia.
 */
export interface ErrorDatoPatagonia {
  readonly codigo: ErrorComprobantePatagonia;
  readonly campoId: 'r2_numeroComprobante';
  readonly ref: SourceRef;
}

export interface DatosInvalidosPatagonia {
  readonly estado: 'DATOS_PATAGONIA_INVALIDOS';
  readonly motivo: 'DATOS_PATAGONIA_INVALIDOS';
  readonly errores: readonly ErrorDatoPatagonia[];
  readonly pendienteHomologacion: true;
}

/**
 * Un apellido o nombre no satisface la decisión PAT-9/P-14: se conserva el código exacto de
 * `construirNombrePatagonia()`, el campo y la referencia, sin el valor original. No es una
 * decisión de política pendiente ni un dato de comprobante.
 */
export interface ErrorNombreDatoPatagonia {
  readonly codigo: ErrorConstruccionNombrePatagonia;
  readonly campoId: 'r2_apellidoNombre';
  readonly ref: SourceRef;
}

export interface NombreInvalidoPatagonia {
  readonly estado: 'NOMBRE_PATAGONIA_INVALIDO';
  readonly motivo: 'NOMBRE_PATAGONIA_INVALIDO';
  readonly errores: readonly ErrorNombreDatoPatagonia[];
  readonly pendienteHomologacion: true;
}

/**
 * La estrategia de lotes aprobada no puede representar la lista de pagos: está vacía o
 * excede la capacidad del formato. No es una decisión de política pendiente ni un dato de
 * un pago; se informa con los códigos tipados del módulo de loteo.
 */
export interface LoteoInvalidoPatagonia {
  readonly estado: 'LOTEO_PATAGONIA_INVALIDO';
  readonly motivo: 'LOTEO_PATAGONIA_INVALIDO';
  readonly errores: readonly ErrorLoteoPatagonia[];
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
  | HipotesisPat2NoConfirmadaPatagonia
  | ConciliacionNoListaPatagonia
  | SinRegistrosPatagonia
  | ContratoBloqueadoPatagonia
  | TipoDocumentoNoConfirmadoPatagonia
  | CoberturaIncompletaPatagonia
  | HomologacionPendientePatagonia
  | MapeoNoResueltoPatagonia
  | DatosInvalidosPatagonia
  | NombreInvalidoPatagonia
  | LoteoInvalidoPatagonia;

/** Evaluación sin serializar: distingue "listo técnicamente" de cada bloqueo. */
export interface ListoTecnicamentePatagonia {
  readonly estado: 'LISTO_TECNICAMENTE';
  readonly perfil: PerfilPatagonia;
  readonly parametros: ParametrosEnvioPatagonia;
  readonly pagos: readonly PagoPatagonia[];
  readonly readiness: PatagoniaReadiness;
  readonly aptitud: AptitudPatagonia;
}

/**
 * Resultado de la evaluación técnica pública (CP-F7-C2.4-A1). Es solo lectura: no
 * serializa, no inspecciona bytes y no abre la compuerta productiva. `APTO_TECNICAMENTE`
 * significa que la corrida superó configuración, PAT-2, conciliación, readiness, contrato,
 * PAT-8, cobertura y política; NO significa que esté autorizada para generar pagos reales.
 */
export interface AptoTecnicamentePatagonia {
  readonly estado: 'APTO_TECNICAMENTE';
  readonly perfil: PerfilPatagonia;
  readonly parametros: ParametrosEnvioPatagonia;
  readonly pagos: readonly PagoPatagonia[];
  readonly readiness: PatagoniaReadiness;
  readonly aptitud: AptitudPatagonia;
  readonly aptoParaContinuar: true;
  /** La autorización productiva es independiente de la aptitud técnica. */
  readonly autorizadoParaGenerar: boolean;
  /** `null` solo si la compuerta productiva estuviera habilitada. */
  readonly motivoAutorizacion: 'HOMOLOGACION_PATAGONIA_PENDIENTE' | null;
}

/** Estados que impiden continuar; nunca incluye la compuerta de autorización. */
export type ResultadoNoAptoPatagonia = Exclude<
  ResultadoNoGeneradoPatagonia,
  HomologacionPendientePatagonia
>;

export type EvaluacionTecnicaPatagonia = AptoTecnicamentePatagonia | ResultadoNoAptoPatagonia;

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
 *
 * C5-B agrega únicamente la resolución validada de la corrida (snapshot + huella) para
 * que la evaluación técnica del tipo de liquidación consuma la misma decisión que la
 * conciliación. No es un bypass: sin snapshot y huella coherentes, C5-A devuelve la
 * política productiva sin cambios y PAT-7/P-09/P-10 sigue pendiente.
 */
export interface EntradaGeneracionPatagonia {
  /** Perfil ya importado/validado. v1/v2 no contienen la configuración Patagonia. */
  readonly perfil: CompanyProfileImportado | null;
  /** Resultado de F2 con decisiones y mapeos ya aplicados; es la fuente de verdad. */
  readonly conciliacion: ResultadoConciliacion | null;
  /** Parámetros explícitos del envío: sin defaults de fechas, envío, concepto ni separadores. */
  readonly parametros: ParametrosEnvioPatagonia | null;
  /**
   * Snapshot C2 aplicado a la corrida que produjo `conciliacion`. Opcional para conservar
   * el comportamiento histórico: sin él, la evaluación usa la política productiva.
   */
  readonly seleccionLiquidacionPatagonia?: SnapshotSeleccionLiquidacionPatagonia | null;
  /**
   * Huella Finnegans vigente de la corrida conciliada. Debe coincidir con la del snapshot;
   * si falta o difiere, la resolución C5-A falla cerrada y no se resuelve `tipoLiquidacion`.
   */
  readonly huellaFinnegans?: string | null;
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

function incidenciaQueImpideElPago(fila: FilaConciliada): IncidenciaConciliada | undefined {
  const candidatas = fila.incidencias.filter(
    (incidencia) =>
      incidencia.resolucion === undefined &&
      (incidencia.alcance === 'PATAGONIA_B2' || incidencia.alcance === 'GLOBAL') &&
      (incidencia.nivel === 'BLOQUEANTE' || incidencia.nivel === 'REQUIERE_REVISION'),
  );
  return (
    candidatas.find((incidencia) => incidencia.nivel === 'BLOQUEANTE') ??
    candidatas.find((incidencia) => incidencia.nivel === 'REQUIERE_REVISION')
  );
}

function motivoDeIncidencia(incidencia: IncidenciaConciliada): MotivoNoConvertiblePatagonia {
  if (incidencia.alcance === 'GLOBAL') {
    return incidencia.nivel === 'BLOQUEANTE'
      ? 'INCIDENCIA_GLOBAL_BLOQUEANTE'
      : 'INCIDENCIA_GLOBAL_EN_REVISION';
  }
  return incidencia.nivel === 'BLOQUEANTE'
    ? 'INCIDENCIA_PATAGONIA_BLOQUEANTE'
    : 'INCIDENCIA_PATAGONIA_EN_REVISION';
}

function campoDeIncidencia(campo: string | undefined): CampoBancario | undefined {
  if (campo === undefined || !(CAMPOS_BANCARIOS as readonly string[]).includes(campo)) {
    return undefined;
  }
  return campo as CampoBancario;
}

interface ValoresPatagonia {
  readonly tipoCuenta: PagoPatagonia['tipoCuenta'];
  readonly numeroCuenta: string;
  readonly codigoBanco: string;
  readonly codigoSucursal: string;
  readonly tipoDocumento: PagoPatagonia['tipoDocumento'];
  readonly numeroDocumento: string;
  readonly provinciaDocumento: CodigoProvincia | null;
  readonly codigoDependencia: string;
}

type MotivoCampoNoConvertible =
  'CAMPO_PATAGONIA_FALTANTE' | 'CAMPO_PATAGONIA_INVALIDO' | 'PROVINCIA_INCOMPATIBLE';

type ValidacionCamposPatagonia =
  | { readonly ok: true; readonly valores: ValoresPatagonia }
  | {
      readonly ok: false;
      readonly motivo: MotivoCampoNoConvertible;
      readonly campo: CampoBancario;
    };

function falloCampo<T>(campo: CampoBancario, valor: CampoMaestro<T>): ValidacionCamposPatagonia {
  return {
    ok: false,
    motivo: valor.estado === 'VACIO' ? 'CAMPO_PATAGONIA_FALTANTE' : 'CAMPO_PATAGONIA_INVALIDO',
    campo,
  };
}

/**
 * Misma validación que usaba `pagoDeFila`, ahora con el campo afectado para el diagnóstico de
 * cobertura. La provincia solo se consume con tipo de documento `004`; si viene informada con
 * otro tipo, la fila no se convierte y se informa `PROVINCIA_INCOMPATIBLE`.
 */
function validarCamposPatagonia(patagonia: DatosPatagonia): ValidacionCamposPatagonia {
  const tipoCuenta = patagonia.tipoCuenta;
  const numeroCuenta = patagonia.numeroCuenta;
  const codigoBanco = patagonia.codigoBanco;
  const codigoSucursal = patagonia.codigoSucursal;
  const tipoDocumento = patagonia.tipoDocumento;
  const numeroDocumento = patagonia.numeroDocumento;
  const codigoDependencia = patagonia.codigoDependencia;
  if (!esValido(tipoCuenta)) {
    return falloCampo('PAT_TIPO_CUENTA', tipoCuenta);
  }
  if (!esValido(numeroCuenta)) {
    return falloCampo('PAT_NUMERO_CUENTA', numeroCuenta);
  }
  if (!esValido(codigoBanco)) {
    return falloCampo('PAT_CODIGO_BANCO', codigoBanco);
  }
  if (!esValido(codigoSucursal)) {
    return falloCampo('PAT_CODIGO_SUCURSAL', codigoSucursal);
  }
  if (!esValido(tipoDocumento)) {
    return falloCampo('PAT_TIPO_DOCUMENTO', tipoDocumento);
  }
  if (!esValido(numeroDocumento)) {
    return falloCampo('PAT_NUMERO_DOCUMENTO', numeroDocumento);
  }
  if (!esValido(codigoDependencia)) {
    return falloCampo('PAT_CODIGO_DEPENDENCIA', codigoDependencia);
  }

  const provinciaDocumento = patagonia.provinciaDocumento;
  if (tipoDocumento.valor === TIPO_DOCUMENTO_CON_PROVINCIA) {
    if (!esValido(provinciaDocumento)) {
      return falloCampo('PAT_PROVINCIA_DOCUMENTO', provinciaDocumento);
    }
    return {
      ok: true,
      valores: {
        tipoCuenta: tipoCuenta.valor,
        numeroCuenta: numeroCuenta.valor,
        codigoBanco: codigoBanco.valor,
        codigoSucursal: codigoSucursal.valor,
        tipoDocumento: tipoDocumento.valor,
        numeroDocumento: numeroDocumento.valor,
        provinciaDocumento: provinciaDocumento.valor,
        codigoDependencia: codigoDependencia.valor,
      },
    };
  }
  if (provinciaDocumento.estado !== 'VACIO') {
    return {
      ok: false,
      motivo: 'PROVINCIA_INCOMPATIBLE',
      campo: 'PAT_PROVINCIA_DOCUMENTO',
    };
  }
  return {
    ok: true,
    valores: {
      tipoCuenta: tipoCuenta.valor,
      numeroCuenta: numeroCuenta.valor,
      codigoBanco: codigoBanco.valor,
      codigoSucursal: codigoSucursal.valor,
      tipoDocumento: tipoDocumento.valor,
      numeroDocumento: numeroDocumento.valor,
      provinciaDocumento: null,
      codigoDependencia: codigoDependencia.valor,
    },
  };
}

type EvaluacionFilaPatagonia =
  | { readonly tipo: 'CONVERTIBLE'; readonly pago: PagoPatagonia }
  | {
      readonly tipo: 'NO_CONVERTIBLE';
      readonly motivo: MotivoNoConvertiblePatagonia;
      readonly campo?: CampoBancario;
      readonly incidenciaId?: string;
    };

function evaluarFilaPatagonia(fila: FilaConciliada): EvaluacionFilaPatagonia {
  const { neto } = fila.linea;
  if (neto === null) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'NETO_AUSENTE' };
  }
  if (neto < 0n) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'NETO_NEGATIVO' };
  }
  if (neto === 0n) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'NETO_CERO' };
  }
  const registro = fila.registro;
  if (registro === null) {
    return { tipo: 'NO_CONVERTIBLE', motivo: 'SIN_MAESTRO' };
  }
  const incidencia = incidenciaQueImpideElPago(fila);
  if (incidencia !== undefined) {
    const campo = campoDeIncidencia(incidencia.campo);
    return {
      tipo: 'NO_CONVERTIBLE',
      motivo: motivoDeIncidencia(incidencia),
      incidenciaId: incidencia.id,
      ...(campo === undefined ? {} : { campo }),
    };
  }
  const campos = validarCamposPatagonia(registro.patagonia);
  if (!campos.ok) {
    return { tipo: 'NO_CONVERTIBLE', motivo: campos.motivo, campo: campos.campo };
  }
  return {
    tipo: 'CONVERTIBLE',
    pago: {
      ref: fila.linea.ref,
      neto,
      ...campos.valores,
      legajo: fila.linea.legajo,
      apellido: fila.linea.apellido,
      nombre: fila.linea.nombre,
      descripcion: fila.linea.descripcion,
    },
  };
}

function pagoDeFila(fila: FilaConciliada): PagoPatagonia | undefined {
  if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'PATAGONIA_B2') {
    return undefined;
  }
  const evaluacion = evaluarFilaPatagonia(fila);
  return evaluacion.tipo === 'CONVERTIBLE' ? evaluacion.pago : undefined;
}

/**
 * Pagos Patagonia derivados exclusivamente de la conciliación, preservando el orden de la
 * corrida y su `SourceRef`. No lee XLSX ni reimplementa reglas de F2.
 *
 * ADVERTENCIA: devuelve solo los pagos convertibles; no verifica cobertura. No es una
 * autorización de generación: la fachada usa `analizarCoberturaPagosPatagonia` y bloquea con
 * `COBERTURA_PAGOS_INCOMPLETA` si alguna fila asignada no se convierte. No debe usarse para
 * producir un archivo por sí sola.
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

interface AnalisisCoberturaPatagonia {
  readonly cobertura: CoberturaPagosPatagonia;
  readonly pagos: readonly PagoPatagonia[];
}

/**
 * Clasifica todas las filas asignadas a Patagonia y verifica cantidad, refs únicas e importes
 * exactos en centavos. No modifica la conciliación ni reimplementa sus reglas: reutiliza
 * `evaluarFilaPatagonia`, que es la misma conversión que usa `pagosPatagoniaDesdeConciliacion`.
 * Las exclusiones ya decididas por F2 (`EXCLUIDA(NETO_CERO)`) y los otros destinos quedan fuera
 * del universo asignado y se informan como exclusiones legítimas, nunca como omisiones.
 */
function analizarCoberturaPagosPatagonia(
  resultado: ResultadoConciliacion,
  asignadasEsperadas: Totales,
): AnalisisCoberturaPatagonia {
  const pagos: PagoPatagonia[] = [];
  const noConvertibles: FilaNoConvertiblePatagonia[] = [];
  const excluidas: FilaExcluidaPatagonia[] = [];
  const refsAsignadas = new Set<string>();

  let cantidadAsignada = 0;
  let filasSinImporteAsignadas = 0;
  let importeAsignado: bigint | null = 0n;
  let importeNoConvertible: bigint | null = 0n;

  for (const fila of resultado.filas) {
    if (fila.estado.estado === 'EXCLUIDA') {
      excluidas.push({ ref: fila.linea.ref, motivo: fila.estado.motivo });
      continue;
    }
    if (fila.estado.estado !== 'INCLUIDA' || fila.estado.destino !== 'PATAGONIA_B2') {
      continue;
    }

    cantidadAsignada += 1;
    refsAsignadas.add(claveRef(fila.linea.ref));
    const { neto } = fila.linea;
    if (neto === null) {
      filasSinImporteAsignadas += 1;
      importeAsignado = null;
    } else if (importeAsignado !== null) {
      importeAsignado += neto;
    }

    const evaluacion = evaluarFilaPatagonia(fila);
    if (evaluacion.tipo === 'CONVERTIBLE') {
      pagos.push(evaluacion.pago);
      continue;
    }

    noConvertibles.push({
      ref: fila.linea.ref,
      motivo: evaluacion.motivo,
      ...(evaluacion.campo === undefined ? {} : { campo: evaluacion.campo }),
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

  const cantidadCoincide = cantidadAsignada === pagos.length + noConvertibles.length;
  const importeCoincide =
    importeAsignado !== null &&
    importeNoConvertible !== null &&
    importeAsignado === importeConvertido + importeNoConvertible;
  const totalesCoinciden = cantidadCoincide && importeCoincide;

  const global = resultado.global.patagonia;
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
      totalesCoinciden,
      globalCoincide,
      readinessCoincide,
      completa:
        noConvertibles.length === 0 &&
        refsUnicas &&
        totalesCoinciden &&
        globalCoincide &&
        readinessCoincide,
    },
  };
}

/**
 * Reporte público de cobertura de pagos Patagonia. No genera bytes ni abre la compuerta
 * productiva; permite auditar qué fila asignada no se convirtió y por qué.
 */
export function coberturaPagosPatagonia(
  resultado: ResultadoConciliacion,
  asignadasEsperadas: Totales = resultado.global.patagonia,
): CoberturaPagosPatagonia {
  return analizarCoberturaPagosPatagonia(resultado, asignadasEsperadas).cobertura;
}

/**
 * Códigos del Anexo I que el banco no confirmó para el flujo actual (PAT-8).
 * Recorre solo filas convertibles: una fila inválida ya la reporta readiness y
 * no debe duplicarse acá. No transforma valores ni serializa nada.
 */
function tipoDocumentoNoConfirmado(resultado: ResultadoConciliacion): {
  readonly tipos: readonly TipoDocumentoPatagonia[];
  readonly refs: readonly SourceRef[];
} | null {
  const tipos = new Set<TipoDocumentoPatagonia>();
  const refs: SourceRef[] = [];
  for (const fila of resultado.filas) {
    const pago = pagoDeFila(fila);
    if (pago === undefined) {
      continue;
    }
    if (validarTipoDocumentoFlujoConfirmadoPatagonia(pago.tipoDocumento).ok) {
      continue;
    }
    tipos.add(pago.tipoDocumento);
    refs.push(pago.ref);
  }
  return tipos.size === 0 ? null : { tipos: [...tipos], refs };
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
    // PAT-16 solo aplica cuando el legajo está realmente ausente. Un legajo presente se
    // usa tal cual si es válido o bloquea el mapeo si es inválido; en ningún caso requiere
    // una resolución de política, así que no debe figurar como pendiente.
    if (pago.legajo === null) {
      revisar(politica.comprobanteNoInformado(pago));
    }
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

interface PreparacionTecnicaPatagonia {
  readonly estado: 'TECNICAMENTE_PREPARADA';
  readonly perfil: PerfilPatagonia;
  readonly parametros: ParametrosEnvioPatagonia;
  readonly pagos: readonly PagoPatagonia[];
  readonly readiness: PatagoniaReadiness;
  readonly aptitud: AptitudPatagonia;
  /** Política C5-A: solo `tipoLiquidacion` puede diferir de la productiva. */
  readonly politica: PoliticaPatagonia;
}

type ResultadoPreparacionTecnicaPatagonia =
  | PreparacionTecnicaPatagonia
  | { readonly estado: 'NO_APTA'; readonly resultado: ResultadoNoAptoPatagonia };

function noAptaTecnicamente(
  resultado: ResultadoNoAptoPatagonia,
): ResultadoPreparacionTecnicaPatagonia {
  return { estado: 'NO_APTA', resultado };
}

/**
 * Prepara la evaluación técnica compartida por `evaluarAptitudTecnicaPatagonia` y
 * `evaluarGeneracionPatagonia`. Recorre configuración, PAT-2, conciliación, readiness,
 * contrato, PAT-8 y cobertura (A0) sin serializar ni consultar la compuerta productiva.
 * La política y la ausencia de pagos se completan después, para conservar la precedencia
 * histórica de la fachada de generación.
 */
function prepararEvaluacionTecnica(
  entrada: EntradaGeneracionPatagonia,
): ResultadoPreparacionTecnicaPatagonia {
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
    return noAptaTecnicamente(configuracionIncompleta(motivos, perfil));
  }

  // PAT-2: solo la hipótesis alfanumérica está confirmada por el banco. La
  // histórica NUMERICA se rechaza de forma explícita antes de evaluar la
  // conciliación, mapear o serializar: no hay bytes y no se reinterpreta.
  if (parametros.hipotesisDependenciaPat2 !== 'ALFANUMERICA') {
    return noAptaTecnicamente({
      estado: 'HIPOTESIS_PAT2_NO_CONFIRMADA',
      motivo: 'HIPOTESIS_PAT2_NO_CONFIRMADA',
      hipotesis: parametros.hipotesisDependenciaPat2,
      hipotesisConfirmada: 'ALFANUMERICA',
      pendienteHomologacion: true,
    });
  }

  if (conciliacion === null) {
    return noAptaTecnicamente({
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'SIN_CONCILIACION',
      motivosGlobales: [],
      motivosReadiness: [],
      incidencias: [],
      pendienteHomologacion: true,
    });
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
    return noAptaTecnicamente({
      estado: 'CONCILIACION_NO_LISTA',
      motivo: conciliacion.global.estado === 'BLOQUEADA' ? 'GLOBAL_BLOQUEADA' : 'GLOBAL_PENDIENTE',
      motivosGlobales: conciliacion.global.motivos,
      motivosReadiness: readiness.motivos,
      incidencias: [],
      pendienteHomologacion: true,
    });
  }

  if (readiness.motivos.includes('SIN_REGISTROS')) {
    return noAptaTecnicamente({
      estado: 'SIN_REGISTROS',
      motivo: 'BANCO_SIN_FILAS',
      asignadas: readiness.asignadas,
      pendienteHomologacion: true,
    });
  }

  if (readiness.motivos.includes('BLOQUEANTES_DEL_BANCO')) {
    const bloqueantes = incidenciasPatagonia(conciliacion, 'BLOQUEANTE');
    if (bloqueantes.every((incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO')) {
      return noAptaTecnicamente({
        estado: 'MAPEO_NO_RESUELTO',
        motivo: 'LIQUIDACION_SIN_MAPEO',
        puntos: [],
        requisitos: [],
        incidencias: resumenIncidencias(bloqueantes),
        pendienteHomologacion: true,
      });
    }
    return noAptaTecnicamente({
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'BLOQUEANTES_PATAGONIA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(bloqueantes),
      pendienteHomologacion: true,
    });
  }

  if (readiness.motivos.includes('REVISIONES_DEL_BANCO_SIN_RESOLVER')) {
    return noAptaTecnicamente({
      estado: 'CONCILIACION_NO_LISTA',
      motivo: 'REVISIONES_PATAGONIA',
      motivosGlobales: [],
      motivosReadiness: readiness.motivos,
      incidencias: resumenIncidencias(incidenciasPatagonia(conciliacion, 'REQUIERE_REVISION')),
      pendienteHomologacion: true,
    });
  }

  if (readiness.motivos.includes('GENERADOR_NO_HABILITADO')) {
    return noAptaTecnicamente({
      estado: 'CONTRATO_PATAGONIA_BLOQUEADO',
      bloqueos: aptitud.bloqueos,
      referencias: referenciasDeBloqueos(aptitud.bloqueos, spec),
      interpretacionesByte: aptitud.interpretacionesByte,
      pendienteHomologacion: true,
    });
  }

  // PAT-8: el banco solo confirmó `001`. Los demás códigos del Anexo I siguen
  // siendo válidos en el catálogo general, pero no están confirmados para este
  // flujo y no se generan. No se adivina ni se reasigna el código.
  const noConfirmado = tipoDocumentoNoConfirmado(conciliacion);
  if (noConfirmado !== null) {
    return noAptaTecnicamente({
      estado: 'TIPO_DOCUMENTO_NO_CONFIRMADO',
      motivo: 'TIPO_DOCUMENTO_NO_CONFIRMADO',
      tiposDocumento: noConfirmado.tipos,
      refs: noConfirmado.refs,
      pendienteHomologacion: true,
    });
  }

  // A0: ninguna fila asignada a Patagonia puede desaparecer al convertir la
  // conciliación en pagos. Se evalúa después de readiness y PAT-8 para no
  // adelantarse a sus precedencias, y antes de la compuerta productiva para que
  // el control sea efectivo aun con la producción cerrada. No abre la compuerta
  // ni genera bytes.
  const analisis = analizarCoberturaPagosPatagonia(conciliacion, readiness.asignadas);
  if (!analisis.cobertura.completa) {
    return noAptaTecnicamente({
      estado: 'COBERTURA_PAGOS_INCOMPLETA',
      motivo:
        analisis.cobertura.noConvertibles.length > 0
          ? 'FILAS_PATAGONIA_NO_CONVERTIBLES'
          : 'INVARIANTES_PAGOS_PATAGONIA',
      ...analisis.cobertura,
      pendienteHomologacion: true,
    });
  }

  // C5-B: la política solo se habilita si la resolución C5-A es válida y su revisión
  // coincide con la que quedó estampada al conciliar. La huella del archivo no alcanza:
  // cambiar una selección no la modifica. Sin evidencia (snapshot, huella o revisión),
  // se usa la política productiva y la evaluación conserva PAT-7.
  const resolucion = resolverSeleccionLiquidacionPatagonia(
    entrada.seleccionLiquidacionPatagonia ?? null,
    entrada.huellaFinnegans ?? '',
    conciliacion.filas.map((fila) => fila.linea),
  );
  const revisionConciliacion = conciliacion.revisionSeleccionLiquidacionPatagonia ?? null;
  const politica =
    resolucion !== null &&
    revisionSeleccionLiquidacionPatagonia(resolucion) === revisionConciliacion
      ? politicaPatagoniaDesdeResolucionPatagonia(resolucion)
      : politicaPatagoniaDesdeResolucionPatagonia(null);

  return {
    estado: 'TECNICAMENTE_PREPARADA',
    perfil: perfilPatagoniaDesdePerfil(perfil),
    parametros,
    pagos: analisis.pagos,
    readiness,
    aptitud,
    politica,
  };
}

/**
 * Valida los datos del pago que no resuelve el maestro ni la conciliación. Hoy solo el
 * comprobante: se reutiliza el mismo validador del mapper, sin reimplementar la regla ni
 * serializar. El legajo `null` no es un error: lo resuelve la política PAT-16 aprobada.
 */
function erroresDatosPatagonia(pagos: readonly PagoPatagonia[]): readonly ErrorDatoPatagonia[] {
  const errores: ErrorDatoPatagonia[] = [];
  for (const pago of pagos) {
    if (pago.legajo === null) {
      continue;
    }
    const comprobante = validarComprobantePatagonia(pago.legajo);
    if (!comprobante.ok) {
      errores.push({
        codigo: comprobante.error,
        campoId: 'r2_numeroComprobante',
        ref: pago.ref,
      });
    }
  }
  return errores;
}

/**
 * Valida el nombre de cada pago con la misma decisión y el mismo constructor que usa la
 * política PAT-9/P-14, sin excepciones ni valores por defecto. Un nombre inválido bloquea
 * antes de consultar la política, de modo que no se confunde con `SIN_RESOLUCION` ni se
 * declara aptitud. Solo se conservan código, campo y referencia; nunca el valor original.
 */
function erroresNombresPatagonia(
  pagos: readonly PagoPatagonia[],
): readonly ErrorNombreDatoPatagonia[] {
  const errores: ErrorNombreDatoPatagonia[] = [];
  for (const pago of pagos) {
    const nombre = construirNombrePatagonia(
      pago.apellido,
      pago.nombre,
      DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
    );
    if (!nombre.ok) {
      errores.push({
        codigo: nombre.error,
        campoId: 'r2_apellidoNombre',
        ref: pago.ref,
      });
    }
  }
  return errores;
}

/**
 * Completa la evaluación técnica con la política efectiva y la existencia de pagos.
 * No genera bytes. Se comparte entre la fachada y la consulta pública de aptitud.
 * C5-B: la política recibida solo puede diferir de la productiva en `tipoLiquidacion`.
 */
function completarEvaluacionTecnica(
  preparacion: PreparacionTecnicaPatagonia,
): ListoTecnicamentePatagonia | ResultadoNoAptoPatagonia {
  const { perfil, parametros, pagos, readiness, aptitud, politica } = preparacion;
  if (pagos.length === 0) {
    return {
      estado: 'SIN_REGISTROS',
      motivo: 'SIN_PAGOS_CONVERTIBLES',
      asignadas: readiness.asignadas,
      pendienteHomologacion: true,
    };
  }

  // La estrategia aprobada debe poder representar la lista completa. Vacío ya se descartó
  // arriba; acá se bloquea un envío que exceda la capacidad sin declarar aptitud ni generar.
  const loteo = estrategiaLotesPatagonia(pagos);
  if (!loteo.ok) {
    return {
      estado: 'LOTEO_PATAGONIA_INVALIDO',
      motivo: 'LOTEO_PATAGONIA_INVALIDO',
      errores: loteo.error,
      pendienteHomologacion: true,
    };
  }

  // Un dato inválido no es una decisión de política pendiente. Se informa antes que
  // `MAPEO_NO_RESUELTO` para no atribuir el bloqueo a una política que sí está resuelta.
  const erroresDatos = erroresDatosPatagonia(pagos);
  if (erroresDatos.length > 0) {
    return {
      estado: 'DATOS_PATAGONIA_INVALIDOS',
      motivo: 'DATOS_PATAGONIA_INVALIDOS',
      errores: erroresDatos,
      pendienteHomologacion: true,
    };
  }

  // PAT-9/P-14 está resuelta como decisión interna, pero un nombre concreto puede no
  // satisfacerla. Se tipifica como dato inválido antes de la política y de `MAPEO_NO_RESUELTO`.
  const erroresNombres = erroresNombresPatagonia(pagos);
  if (erroresNombres.length > 0) {
    return {
      estado: 'NOMBRE_PATAGONIA_INVALIDO',
      motivo: 'NOMBRE_PATAGONIA_INVALIDO',
      errores: erroresNombres,
      pendienteHomologacion: true,
    };
  }

  const puntos = puntosSinResolver(perfil, parametros, pagos, politica);
  if (puntos.length > 0) {
    return {
      estado: 'MAPEO_NO_RESUELTO',
      motivo: 'POLITICA_SIN_RESOLUCION',
      puntos,
      requisitos: diagnosticoPoliticaPatagonia(puntos),
      incidencias: [],
      pendienteHomologacion: true,
    };
  }

  return {
    estado: 'LISTO_TECNICAMENTE',
    perfil,
    parametros,
    pagos,
    readiness,
    aptitud,
  };
}

/**
 * Consulta pública y de solo lectura del estado técnico de una corrida Patagonia.
 * Recorre configuración, PAT-2, conciliación, readiness, contrato, PAT-8, cobertura A0 y
 * la política productiva. NO serializa, no inspecciona bytes y NO abre la compuerta
 * productiva. `APTO_TECNICAMENTE` exige superar todos esos controles; aun así,
 * `autorizadoParaGenerar` sigue siendo `false` hasta que la homologación habilite la
 * compuerta productiva.
 */
export function evaluarAptitudTecnicaPatagonia(
  entrada: EntradaGeneracionPatagonia,
): EvaluacionTecnicaPatagonia {
  const preparacion = prepararEvaluacionTecnica(entrada);
  if (preparacion.estado === 'NO_APTA') {
    return preparacion.resultado;
  }

  const completada = completarEvaluacionTecnica(preparacion);
  if (completada.estado !== 'LISTO_TECNICAMENTE') {
    return completada;
  }

  const autorizada = produccionPatagoniaHabilitada();
  return {
    estado: 'APTO_TECNICAMENTE',
    perfil: completada.perfil,
    parametros: completada.parametros,
    pagos: completada.pagos,
    readiness: completada.readiness,
    aptitud: completada.aptitud,
    aptoParaContinuar: true,
    autorizadoParaGenerar: autorizada,
    motivoAutorizacion: autorizada ? null : 'HOMOLOGACION_PATAGONIA_PENDIENTE',
  };
}

/**
 * Evalúa todas las compuertas sin serializar. La readiness existente se compone con la
 * aptitud contractual: no se crea una segunda readiness. Conserva la precedencia de la
 * fachada: la autorización productiva se consulta antes de la política y de los pagos.
 */
export function evaluarGeneracionPatagonia(
  entrada: EntradaGeneracionPatagonia,
): EvaluacionGeneracionPatagonia {
  const preparacion = prepararEvaluacionTecnica(entrada);
  if (preparacion.estado === 'NO_APTA') {
    return preparacion.resultado;
  }

  // Los bloqueos contractuales ya se evaluaron y PAT-2 está en su hipótesis
  // confirmada. La autorización productiva es una compuerta separada: no se
  // deriva del contrato, del perfil, de los parámetros ni de ninguna propiedad
  // de la entrada.
  if (!produccionPatagoniaHabilitada()) {
    return {
      estado: 'HOMOLOGACION_PATAGONIA_PENDIENTE',
      motivo: 'HOMOLOGACION_PATAGONIA_PENDIENTE',
      pendienteHomologacion: true,
    };
  }

  return completarEvaluacionTecnica(preparacion);
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
      const puntos = puntosDeErrores(archivo.error);
      return {
        estado: 'MAPEO_NO_RESUELTO',
        motivo: 'POLITICA_SIN_RESOLUCION',
        puntos,
        requisitos: diagnosticoPoliticaPatagonia(puntos),
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
