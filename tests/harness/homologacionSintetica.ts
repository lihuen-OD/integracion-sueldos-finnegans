// CP-F7-D1-A: harness cerrado, exclusivamente sintético y en memoria.
//
// Vive bajo tests/ y no se exporta desde src/. Su API solo acepta variantes cerradas
// creadas para probar fallos: nunca recibe corridas, perfiles, archivos, pagos ni datos
// externos. Los bytes devueltos son técnicos, sintéticos y NO HOMOLOGADOS; no se escriben.
import {
  POLITICA_BNA_PRODUCTIVA,
  inspeccionarBna,
  produccionBnaHabilitada,
  serializarBna,
  type InspeccionBna,
  type PoliticaBna,
  type TotalesBna,
} from '../../src/banks/bna';
import { POLITICA_BNA_HIPOTESIS_TECNICA } from '../../src/banks/bna/politicaHipotesis';
import {
  inspeccionarPatagonia,
  produccionPatagoniaHabilitada,
  serializarPatagonia,
  type CodigoTipoLiquidacionPatagoniaProvisional,
  type InspeccionPatagonia,
  type TotalesPatagonia,
} from '../../src/banks/patagonia-b2';
import type { LecturaFinnegans } from '../../src/domain/liquidacion';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import { conFinnegans, nuevaCorrida, type EstadoCorrida } from '../../src/run/corrida';
import { coberturaPagosBna, pagosBnaDesdeConciliacion } from '../../src/run/generacionBna';
import {
  coberturaPagosPatagonia,
  evaluarAptitudTecnicaPatagonia,
} from '../../src/run/generacionPatagonia';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  politicaBnaDesdeResolucionIdentificadorHaberesBna,
  politicaLiquidacionesDesdeSeleccionBna,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from '../../src/run/seleccionIdentificadorHaberesBna';
import {
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  politicaLiquidacionesDesdeSeleccionPatagonia,
  politicaPatagoniaDesdeResolucionPatagonia,
  resolverSeleccionLiquidacionPatagonia,
  revisionSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from '../../src/run/seleccionLiquidacionPatagonia';
import { createRandom } from '../fixtures/synthetic/identities';
import { BANCO_NACION, BANCO_PATAGONIA } from '../fixtures/synthetic/finnegansLike';
import {
  filaFinnegans,
  personas,
  registroBna,
  registroPatagonia,
  type FilaFinnegans,
  type RegistroMaestro,
} from '../fixtures/synthetic/escenarios';
import { parametrosGoldenBna, perfilBnaGolden } from '../fixtures/synthetic/goldenBna';
import {
  parametrosGoldenPatagoniaAlfanumerica,
  perfilPatagoniaGolden,
  perfilV3Golden,
} from '../fixtures/synthetic/goldenPatagonia';
import { escenario } from '../unit/reconciliation/helpers';

export const ETIQUETA_HOMOLOGACION_SINTETICA =
  'CP-F7-D1-A · TECNICO SINTETICO · NO HOMOLOGADO · NO PRODUCTIVO' as const;

export type VarianteBnaSintetica =
  | 'VALIDA'
  | 'HUELLA_VENCIDA'
  | 'SELECCION_INCOMPLETA'
  | 'REVISION_INCORRECTA'
  | 'REFERENCIA_DUPLICADA'
  | 'COBERTURA_INCOMPLETA'
  | 'PARAMETROS_INVALIDOS';

export type VariantePatagoniaSintetica =
  | 'VALIDA'
  | 'HUELLA_VENCIDA'
  | 'SELECCION_INCOMPLETA'
  | 'REVISION_INCORRECTA'
  | 'COBERTURA_INCOMPLETA'
  | 'PARAMETROS_INVALIDOS';

const VARIANTES_BNA: readonly VarianteBnaSintetica[] = [
  'VALIDA',
  'HUELLA_VENCIDA',
  'SELECCION_INCOMPLETA',
  'REVISION_INCORRECTA',
  'REFERENCIA_DUPLICADA',
  'COBERTURA_INCOMPLETA',
  'PARAMETROS_INVALIDOS',
];

const VARIANTES_PATAGONIA: readonly VariantePatagoniaSintetica[] = [
  'VALIDA',
  'HUELLA_VENCIDA',
  'SELECCION_INCOMPLETA',
  'REVISION_INCORRECTA',
  'COBERTURA_INCOMPLETA',
  'PARAMETROS_INVALIDOS',
];

export type CodigoRechazoHarness =
  | 'VARIANTE_NO_ADMITIDA'
  | 'COMPUERTA_PRODUCTIVA_ABIERTA'
  | 'SNAPSHOT_INCONSISTENTE'
  | 'SELECCION_INCOMPLETA'
  | 'REVISION_INCONSISTENTE'
  | 'COBERTURA_INCOMPLETA'
  | 'APTITUD_TECNICA_RECHAZADA'
  | 'SERIALIZACION_RECHAZADA'
  | 'INSPECCION_RECHAZADA';

export interface ComposicionSinteticaRechazada {
  readonly estado: 'RECHAZADA';
  readonly banco: 'BNA_GT_200' | 'PATAGONIA_B2';
  readonly codigo: CodigoRechazoHarness;
  readonly etapa:
    | 'ENTRADA'
    | 'AUTORIZACION'
    | 'SELECCION'
    | 'REVISION'
    | 'COBERTURA'
    | 'APTITUD'
    | 'SERIALIZACION'
    | 'INSPECCION';
  /** Estado tipado, nunca un CUIL, CBU, importe ni otro valor de la fila. */
  readonly motivo?: string;
}

export interface ComposicionBnaSinteticaCompleta {
  readonly estado: 'COMPUESTA_EN_MEMORIA';
  readonly banco: 'BNA_GT_200';
  readonly etiqueta: typeof ETIQUETA_HOMOLOGACION_SINTETICA;
  readonly bytes: Uint8Array;
  readonly totales: TotalesBna;
  readonly inspeccion: InspeccionBna;
  readonly cantidadPagos: number;
  readonly coberturaCompleta: true;
  readonly politica: 'BNA_A1+BNA_B1_B2+BNA_B3';
  readonly homologado: false;
  readonly productivo: false;
}

export interface ComposicionPatagoniaSinteticaCompleta {
  readonly estado: 'COMPUESTA_EN_MEMORIA';
  readonly banco: 'PATAGONIA_B2';
  readonly etiqueta: typeof ETIQUETA_HOMOLOGACION_SINTETICA;
  readonly bytes: Uint8Array;
  readonly totales: TotalesPatagonia;
  readonly inspeccion: InspeccionPatagonia;
  readonly cantidadPagos: number;
  readonly coberturaCompleta: true;
  readonly politica: 'PATAGONIA_PRODUCTIVA+SELECCION_EXPLICITA_PROVISIONAL';
  readonly destinoCuenta: '034';
  readonly tipoDocumento: '001';
  readonly dependencia: 'ALFANUMERICA';
  readonly homologado: false;
  readonly productivo: false;
}

export type ResultadoComposicionBnaSintetica =
  ComposicionBnaSinteticaCompleta | ComposicionSinteticaRechazada;

export type ResultadoComposicionPatagoniaSintetica =
  ComposicionPatagoniaSinteticaCompleta | ComposicionSinteticaRechazada;

const HUELLA_BNA = 'cp-f7-d1-a-bna-finnegans-sintetico';
const HUELLA_PATAGONIA = 'cp-f7-d1-a-patagonia-finnegans-sintetico';
const HUELLA_MAESTRO = 'cp-f7-d1-a-maestro-sintetico';

function lecturaSintetica(conciliacion: ResultadoConciliacion): LecturaFinnegans {
  return {
    hoja: 'Liquidacion exclusivamente sintetica',
    visibilidadHoja: 'visible',
    lineas: conciliacion.filas.map((fila) => fila.linea),
    hallazgos: [],
  };
}

function rechazar(
  banco: ComposicionSinteticaRechazada['banco'],
  codigo: CodigoRechazoHarness,
  etapa: ComposicionSinteticaRechazada['etapa'],
  motivo?: string,
): ComposicionSinteticaRechazada {
  return { estado: 'RECHAZADA', banco, codigo, etapa, ...(motivo === undefined ? {} : { motivo }) };
}

interface EscenarioBnaCerrado {
  readonly conciliacion: ResultadoConciliacion;
  readonly estado: EstadoCorrida;
  readonly snapshot: SnapshotSeleccionIdentificadorHaberesBna;
}

function escenarioBnaCerrado(incompleto: boolean): EscenarioBnaCerrado {
  const random = createRandom(7101);
  const gente = personas(2, 7101);
  const filas = gente.map((persona, indice) =>
    filaFinnegans(persona, {
      Banco: BANCO_NACION,
      Descripcion: indice === 0 ? 'PRUEBA SINTETICA ORDINARIA' : 'PRUEBA SINTETICA EXTRAORDINARIA',
    }),
  );
  const registros = gente.map((persona) => registroBna(persona, random));
  const huellas = { finnegans: HUELLA_BNA, maestro: HUELLA_MAESTRO };
  const base = escenario(filas, registros, { huellas });
  const estadoBase = conFinnegans(nuevaCorrida(), lecturaSintetica(base), HUELLA_BNA);
  const entradas = [
    {
      huellaFinnegans: HUELLA_BNA,
      descripcionOriginal: 'PRUEBA SINTETICA ORDINARIA',
      destino: 'BNA_GT_HABERES' as const,
      codigoIdentificadorHaberes: '0000' as const,
    },
    {
      huellaFinnegans: HUELLA_BNA,
      descripcionOriginal: 'PRUEBA SINTETICA EXTRAORDINARIA',
      destino: 'BNA_GT_HABERES' as const,
      codigoIdentificadorHaberes: '0003' as const,
    },
  ];
  const aplicacion = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    estadoBase,
    incompleto ? entradas.slice(0, 1) : entradas,
  );
  if (!aplicacion.ok) throw new Error('fixture cerrado BNA inválido');
  const estado = aplicacion.value.estado;
  const snapshot = estado.seleccionIdentificadorHaberesBna;
  if (snapshot === null) throw new Error('fixture cerrado BNA sin snapshot');
  const conciliacion = escenario(filas, registros, {
    huellas,
    liquidaciones: politicaLiquidacionesDesdeSeleccionBna(estado),
  });
  return { conciliacion, estado, snapshot };
}

/**
 * Compone BNA solo con fixtures cerrados: A1 para BNA-1/2/6, B1/B2 para P-09/P-10 y
 * B3 para P-17. La política A1 nunca se instala en POLITICA_BNA_PRODUCTIVA.
 */
export function componerBnaHomologacionSintetica(
  variante: VarianteBnaSintetica = 'VALIDA',
): ResultadoComposicionBnaSintetica {
  if (!VARIANTES_BNA.includes(variante)) {
    return rechazar('BNA_GT_200', 'VARIANTE_NO_ADMITIDA', 'ENTRADA');
  }
  if (produccionBnaHabilitada()) {
    return rechazar('BNA_GT_200', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }

  const caso = escenarioBnaCerrado(variante === 'SELECCION_INCOMPLETA');
  const huellaVigente = variante === 'HUELLA_VENCIDA' ? `${HUELLA_BNA}-vencida` : HUELLA_BNA;
  const resolucion = resolverSeleccionIdentificadorHaberesBna(
    caso.snapshot,
    huellaVigente,
    caso.conciliacion.filas.map((fila) => fila.linea),
  );
  if (resolucion === null) {
    return rechazar('BNA_GT_200', 'SNAPSHOT_INCONSISTENTE', 'SELECCION');
  }
  if (resolucion.pendientes.length > 0) {
    return rechazar('BNA_GT_200', 'SELECCION_INCOMPLETA', 'SELECCION');
  }

  const revisionEsperada = revisionSeleccionIdentificadorHaberesBna(resolucion);
  const revisionConciliacion =
    variante === 'REVISION_INCORRECTA'
      ? 'revision-sintetica-deliberadamente-incorrecta'
      : caso.conciliacion.revisionSeleccionIdentificadorHaberesBna;
  if (revisionConciliacion !== revisionEsperada) {
    return rechazar('BNA_GT_200', 'REVISION_INCONSISTENTE', 'REVISION');
  }

  const pagosDerivados = pagosBnaDesdeConciliacion(caso.conciliacion);
  const primerPago = pagosDerivados[0];
  if (primerPago === undefined) throw new Error('fixture cerrado BNA sin pagos');
  const pagos =
    variante === 'REFERENCIA_DUPLICADA'
      ? [primerPago, primerPago]
      : variante === 'COBERTURA_INCOMPLETA'
        ? pagosDerivados.slice(0, 1)
        : pagosDerivados;
  const cobertura = coberturaPagosBna(caso.conciliacion, caso.conciliacion.global.bna, pagos);
  if (!cobertura.completa) {
    return rechazar('BNA_GT_200', 'COBERTURA_INCOMPLETA', 'COBERTURA');
  }

  const politicaB2B3 = politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucion);
  const politica: PoliticaBna = {
    ...POLITICA_BNA_HIPOTESIS_TECNICA,
    identificadorPrestamo: politicaB2B3.identificadorPrestamo,
    infoCriterio: POLITICA_BNA_PRODUCTIVA.infoCriterio,
    camposBeneficiario: POLITICA_BNA_PRODUCTIVA.camposBeneficiario,
  };
  const parametrosBase = parametrosGoldenBna();
  const parametros =
    variante === 'PARAMETROS_INVALIDOS'
      ? { ...parametrosBase, infoCriterioEmpresa: 'CRITERIO SINTETICO DELIBERADAMENTE INVALIDO' }
      : parametrosBase;
  const archivo = serializarBna(perfilBnaGolden(), parametros, pagos, politica);
  if (!archivo.ok) {
    return rechazar('BNA_GT_200', 'SERIALIZACION_RECHAZADA', 'SERIALIZACION');
  }
  const inspeccion = inspeccionarBna(archivo.value.bytes, parametros);
  if (!inspeccion.ok) {
    return rechazar('BNA_GT_200', 'INSPECCION_RECHAZADA', 'INSPECCION');
  }
  return {
    estado: 'COMPUESTA_EN_MEMORIA',
    banco: 'BNA_GT_200',
    etiqueta: ETIQUETA_HOMOLOGACION_SINTETICA,
    bytes: archivo.value.bytes,
    totales: archivo.value.totales,
    inspeccion: inspeccion.value,
    cantidadPagos: pagos.length,
    coberturaCompleta: true,
    politica: 'BNA_A1+BNA_B1_B2+BNA_B3',
    homologado: false,
    productivo: false,
  };
}

interface SeleccionPatagoniaCerrada {
  readonly descripcionOriginal: string;
  readonly codigoTipoLiquidacion: CodigoTipoLiquidacionPatagoniaProvisional;
}

interface EscenarioPatagoniaCerrado {
  readonly conciliacion: ResultadoConciliacion;
  readonly snapshot: SnapshotSeleccionLiquidacionPatagonia;
}

function escenarioPatagoniaCerrado(incompleto: boolean): EscenarioPatagoniaCerrado {
  const random = createRandom(7201);
  const gente = personas(2, 7201);
  const filas: readonly FilaFinnegans[] = gente.map((persona, indice) =>
    filaFinnegans(persona, {
      Banco: BANCO_PATAGONIA,
      Descripcion: indice === 0 ? 'PRUEBA SINTETICA SUELDO' : 'PRUEBA SINTETICA SAC',
    }),
  );
  const registros: readonly RegistroMaestro[] = gente.map((persona) =>
    registroPatagonia(persona, random, { PAT_CODIGO_DEPENDENCIA: 'DEP001' }),
  );
  const huellas = { finnegans: HUELLA_PATAGONIA, maestro: HUELLA_MAESTRO };
  const base = escenario(filas, registros, { huellas });
  const estadoBase = conFinnegans(nuevaCorrida(), lecturaSintetica(base), HUELLA_PATAGONIA);
  const selecciones: readonly SeleccionPatagoniaCerrada[] = [
    { descripcionOriginal: 'PRUEBA SINTETICA SUELDO', codigoTipoLiquidacion: '001' },
    { descripcionOriginal: 'PRUEBA SINTETICA SAC', codigoTipoLiquidacion: '002' },
  ];
  const aplicacion = aplicarSeleccionesLiquidacionPatagoniaCorrida(
    estadoBase,
    (incompleto ? selecciones.slice(0, 1) : selecciones).map((seleccion) => ({
      huellaFinnegans: HUELLA_PATAGONIA,
      destino: 'PATAGONIA_B2' as const,
      ...seleccion,
    })),
  );
  if (!aplicacion.ok) throw new Error('fixture cerrado Patagonia inválido');
  const estado = aplicacion.value.estado;
  const snapshot = estado.seleccionLiquidacionPatagonia;
  if (snapshot === null) throw new Error('fixture cerrado Patagonia sin snapshot');
  const conciliacion = escenario(filas, registros, {
    huellas,
    liquidaciones: politicaLiquidacionesDesdeSeleccionPatagonia(estado),
  });
  return { conciliacion, snapshot };
}

function romperCoberturaPatagonia(conciliacion: ResultadoConciliacion): ResultadoConciliacion {
  return {
    ...conciliacion,
    global: {
      ...conciliacion.global,
      patagonia: {
        ...conciliacion.global.patagonia,
        cantidad: conciliacion.global.patagonia.cantidad + 1,
      },
    },
  };
}

/**
 * Compone el primer alcance Patagonia exclusivamente con destino 034, PAT-2 alfanumérica,
 * PAT-8=001 y selección provisional explícita. No modela corresponsales ni PAT-17.
 */
export function componerPatagoniaHomologacionSintetica(
  variante: VariantePatagoniaSintetica = 'VALIDA',
): ResultadoComposicionPatagoniaSintetica {
  if (!VARIANTES_PATAGONIA.includes(variante)) {
    return rechazar('PATAGONIA_B2', 'VARIANTE_NO_ADMITIDA', 'ENTRADA');
  }
  if (produccionPatagoniaHabilitada()) {
    return rechazar('PATAGONIA_B2', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }

  const caso = escenarioPatagoniaCerrado(variante === 'SELECCION_INCOMPLETA');
  const conciliacion =
    variante === 'COBERTURA_INCOMPLETA'
      ? romperCoberturaPatagonia(caso.conciliacion)
      : caso.conciliacion;
  const huellaVigente =
    variante === 'HUELLA_VENCIDA' ? `${HUELLA_PATAGONIA}-vencida` : HUELLA_PATAGONIA;
  const resolucion = resolverSeleccionLiquidacionPatagonia(
    caso.snapshot,
    huellaVigente,
    conciliacion.filas.map((fila) => fila.linea),
  );
  if (resolucion === null) {
    return rechazar('PATAGONIA_B2', 'SNAPSHOT_INCONSISTENTE', 'SELECCION');
  }
  const revisionEsperada = revisionSeleccionLiquidacionPatagonia(resolucion);
  const revisionConciliacion =
    variante === 'REVISION_INCORRECTA'
      ? 'revision-sintetica-deliberadamente-incorrecta'
      : conciliacion.revisionSeleccionLiquidacionPatagonia;
  if (revisionConciliacion !== revisionEsperada) {
    return rechazar('PATAGONIA_B2', 'REVISION_INCONSISTENTE', 'REVISION');
  }

  const parametrosBase = parametrosGoldenPatagoniaAlfanumerica();
  const parametros =
    variante === 'PARAMETROS_INVALIDOS' ? { ...parametrosBase, numeroEnvio: '00' } : parametrosBase;
  const aptitud = evaluarAptitudTecnicaPatagonia({
    perfil: perfilV3Golden(),
    conciliacion,
    parametros,
    seleccionLiquidacionPatagonia: caso.snapshot,
    huellaFinnegans: huellaVigente,
  });
  if (aptitud.estado !== 'APTO_TECNICAMENTE') {
    const codigo =
      aptitud.estado === 'COBERTURA_PAGOS_INCOMPLETA'
        ? 'COBERTURA_INCOMPLETA'
        : aptitud.estado === 'MAPEO_NO_RESUELTO'
          ? 'SELECCION_INCOMPLETA'
          : 'APTITUD_TECNICA_RECHAZADA';
    const etapa = codigo === 'COBERTURA_INCOMPLETA' ? 'COBERTURA' : 'APTITUD';
    return rechazar('PATAGONIA_B2', codigo, etapa, aptitud.estado);
  }
  if (aptitud.autorizadoParaGenerar || produccionPatagoniaHabilitada()) {
    return rechazar('PATAGONIA_B2', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }
  const cobertura = coberturaPagosPatagonia(conciliacion, aptitud.readiness.asignadas);
  if (!cobertura.completa) {
    return rechazar('PATAGONIA_B2', 'COBERTURA_INCOMPLETA', 'COBERTURA');
  }

  const politica = politicaPatagoniaDesdeResolucionPatagonia(resolucion);
  const archivo = serializarPatagonia(perfilPatagoniaGolden(), parametros, aptitud.pagos, politica);
  if (!archivo.ok) {
    return rechazar('PATAGONIA_B2', 'SERIALIZACION_RECHAZADA', 'SERIALIZACION');
  }
  const inspeccion = inspeccionarPatagonia(archivo.value.bytes, parametros);
  if (!inspeccion.ok) {
    return rechazar('PATAGONIA_B2', 'INSPECCION_RECHAZADA', 'INSPECCION');
  }
  return {
    estado: 'COMPUESTA_EN_MEMORIA',
    banco: 'PATAGONIA_B2',
    etiqueta: ETIQUETA_HOMOLOGACION_SINTETICA,
    bytes: archivo.value.bytes,
    totales: archivo.value.totales,
    inspeccion: inspeccion.value,
    cantidadPagos: aptitud.pagos.length,
    coberturaCompleta: true,
    politica: 'PATAGONIA_PRODUCTIVA+SELECCION_EXPLICITA_PROVISIONAL',
    destinoCuenta: '034',
    tipoDocumento: '001',
    dependencia: 'ALFANUMERICA',
    homologado: false,
    productivo: false,
  };
}
