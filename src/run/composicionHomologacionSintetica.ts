// CP-F8-B: compositor browser-safe, cerrado y exclusivamente sintético.
//
// Esta API no recibe corridas, perfiles, pagos, archivos ni datos empresariales. Los únicos
// argumentos admitidos son variantes enumeradas; todo dato usado para componer vive en el
// catálogo inmutable de este módulo. No escribe, descarga, persiste ni habilita producción.
import {
  POLITICA_BNA_HIPOTESIS_TECNICA,
  POLITICA_BNA_PRODUCTIVA,
  inspeccionarBna,
  produccionBnaHabilitada,
  serializarBna,
  type InspeccionBna,
  type PoliticaBna,
  type TotalesBna,
} from '../banks/bna';
import {
  inspeccionarPatagonia,
  produccionPatagoniaHabilitada,
  serializarPatagonia,
  type CodigoTipoLiquidacionPatagoniaProvisional,
  type InspeccionPatagonia,
  type TotalesPatagonia,
} from '../banks/patagonia-b2';
import { parseCbu, type Cbu } from '../domain/cbu';
import { parseCuil, type Cuil } from '../domain/cuil';
import { parseCuitEmpresa } from '../domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../domain/destino';
import {
  descripcionSinClasificar,
  type LecturaFinnegans,
  type PayrollLine,
} from '../domain/liquidacion';
import type {
  CampoMaestro,
  LecturaMaestro,
  MasterRecord,
  TipoCuentaPatagonia,
  TipoDocumentoPatagonia,
} from '../domain/maestro';
import { parseImporte, type Centavos } from '../domain/money';
import type { CompanyProfileV2, CompanyProfileV3 } from '../profile';
import {
  conciliar,
  type PoliticaLiquidaciones,
  type ResultadoConciliacion,
} from '../reconciliation';
import { conFinnegans, nuevaCorrida, type EstadoCorrida } from './corrida';
import {
  coberturaPagosBna,
  pagosBnaDesdeConciliacion,
  perfilBnaDesdePerfil,
} from './generacionBna';
import {
  coberturaPagosPatagonia,
  evaluarAptitudTecnicaPatagonia,
  perfilPatagoniaDesdePerfil,
} from './generacionPatagonia';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  politicaBnaDesdeResolucionIdentificadorHaberesBna,
  politicaLiquidacionesDesdeSeleccionBna,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from './seleccionIdentificadorHaberesBna';
import {
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  politicaLiquidacionesDesdeSeleccionPatagonia,
  politicaPatagoniaDesdeResolucionPatagonia,
  resolverSeleccionLiquidacionPatagonia,
  revisionSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from './seleccionLiquidacionPatagonia';

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

export const VARIANTES_BNA: readonly VarianteBnaSintetica[] = Object.freeze([
  'VALIDA',
  'HUELLA_VENCIDA',
  'SELECCION_INCOMPLETA',
  'REVISION_INCORRECTA',
  'REFERENCIA_DUPLICADA',
  'COBERTURA_INCOMPLETA',
  'PARAMETROS_INVALIDOS',
]);

export const VARIANTES_PATAGONIA: readonly VariantePatagoniaSintetica[] = Object.freeze([
  'VALIDA',
  'HUELLA_VENCIDA',
  'SELECCION_INCOMPLETA',
  'REVISION_INCORRECTA',
  'COBERTURA_INCOMPLETA',
  'PARAMETROS_INVALIDOS',
]);

export type CodigoRechazoCompositorSintetico =
  | 'ARGUMENTOS_INVALIDOS'
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
  readonly codigo: CodigoRechazoCompositorSintetico;
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

const CATALOGO_SINTETICO = Object.freeze({
  huellas: Object.freeze({
    bna: 'cp-f7-d1-a-bna-finnegans-sintetico',
    patagonia: 'cp-f7-d1-a-patagonia-finnegans-sintetico',
    maestro: 'cp-f7-d1-a-maestro-sintetico',
  }),
  bna: Object.freeze({
    semilla: 7101,
    descripciones: Object.freeze([
      'PRUEBA SINTETICA ORDINARIA',
      'PRUEBA SINTETICA EXTRAORDINARIA',
    ] as const),
    identificadores: Object.freeze(['0000', '0003'] as const),
  }),
  patagonia: Object.freeze({
    semilla: 7201,
    descripciones: Object.freeze(['PRUEBA SINTETICA SUELDO', 'PRUEBA SINTETICA SAC'] as const),
    tiposLiquidacion: Object.freeze(['001', '002'] as const),
    dependencia: 'DEP001',
  }),
  parametros: Object.freeze({
    bna: Object.freeze({
      fechaCompensacion: '20261030',
      numeroEnvio: '1',
      infoCriterioEmpresa: 'PAGO DE HABERES',
      referenciaUnivoca: 'HABERES OCTUBRE',
      lineSeparator: '\n' as const,
      trailingSeparator: false,
    }),
    patagonia: Object.freeze({
      fechaPresentacion: '20261027',
      fechaAcreditacion: '20261030',
      numeroEnvio: '01',
      concepto: 'HAB.05/00',
      hipotesisRellenoPat1: 'ESPACIOS' as const,
      hipotesisDependenciaPat2: 'ALFANUMERICA' as const,
      lineSeparator: '\n' as const,
      trailingSeparator: false,
    }),
  }),
});

const APELLIDOS = Object.freeze(['Prueba', 'Ejemplo'] as const);
const NOMBRES = Object.freeze(['Ana Clara', 'Sofía Noemí'] as const);
const CUIL_WEIGHTS = Object.freeze([5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const);

interface PersonaSintetica {
  readonly cuilTexto: string;
  readonly cuil: Cuil;
  readonly apellido: string;
  readonly nombre: string;
  readonly legajo: string;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function syntheticCuil(prefix: string, dni: number): string | null {
  const base = `${prefix}${String(dni).padStart(8, '0')}`;
  const sum = CUIL_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(base[index]), 0);
  const remainder = 11 - (sum % 11);
  if (remainder === 10) return null;
  const check = remainder === 11 ? 0 : remainder;
  return `${prefix}-${base.slice(2)}-${String(check)}`;
}

function checkDigit(digits: string, cyclicWeights: string): string {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    sum += Number(digits[index]) * Number(cyclicWeights[index % cyclicWeights.length]);
  }
  return String((10 - (sum % 10)) % 10);
}

function syntheticCbu(entidad: string, sucursal: string, cuenta: string): string {
  const bloque1 = `${entidad}${sucursal}`;
  return `${bloque1}${checkDigit(bloque1, '7139')}${cuenta}${checkDigit(cuenta, '3971')}`;
}

function digitosAleatorios(random: () => number, cantidad: number): string {
  let digitos = '';
  while (digitos.length < cantidad) digitos += String(randomInt(random, 0, 9));
  return digitos;
}

function personas(cantidad: number, semilla: number): readonly PersonaSintetica[] {
  const random = createRandom(semilla);
  const people: PersonaSintetica[] = [];
  const used = new Set<string>();
  while (people.length < cantidad) {
    const index = people.length;
    const texto = syntheticCuil(index % 3 === 0 ? '27' : '20', randomInt(random, 10_000, 99_999));
    if (texto === null || used.has(texto)) continue;
    const parsed = parseCuil(texto);
    if (!parsed.ok) throw new Error('catálogo sintético con CUIL inválido');
    used.add(texto);
    people.push({
      cuilTexto: texto,
      cuil: parsed.value,
      apellido: APELLIDOS[index] ?? 'Prueba',
      nombre: NOMBRES[index] ?? 'Ana Clara',
      legajo: String(50 + index).padStart(3, '0'),
    });
  }
  return people;
}

function importe(texto: string): Centavos {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('catálogo sintético con importe inválido');
  return resultado.value;
}

function linea(
  persona: PersonaSintetica,
  indice: number,
  bancoFinnegans: string,
  descripcionOriginal: string,
): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'hoja1', fila: indice + 2 },
    cuilTexto: persona.cuilTexto,
    cuil: persona.cuil,
    legajo: persona.legajo,
    apellido: persona.apellido,
    nombre: persona.nombre,
    bancoFinnegans,
    neto: importe('420000.25'),
    componentes: {
      remunerativo: importe('500000.5'),
      noRemunerativo: importe('20000'),
      descuento: importe('100000.25'),
    },
    descripcion: descripcionSinClasificar(descripcionOriginal),
    legajoApellidoNombre: `${persona.legajo} - ${persona.apellido}, ${persona.nombre}`,
  };
}

const VACIO = Object.freeze({ estado: 'VACIO' } as const);

function campoValido<T extends string>(texto: T): CampoMaestro<T> {
  return { estado: 'VALIDO', texto, valor: texto };
}

function cbuValido(texto: string): CampoMaestro<Cbu> {
  const resultado = parseCbu(texto);
  if (!resultado.ok) throw new Error('catálogo sintético con CBU inválido');
  return { estado: 'VALIDO', texto, valor: resultado.value };
}

function registroBna(
  persona: PersonaSintetica,
  indice: number,
  random: () => number,
): MasterRecord {
  const cbu = syntheticCbu('011', digitosAleatorios(random, 4), digitosAleatorios(random, 13));
  return {
    ref: { archivo: 'MAESTRO', hoja: 'Empleados', fila: indice + 2 },
    cuilTexto: persona.cuilTexto,
    cuil: persona.cuil,
    legajo: persona.legajo,
    apellidoNombreRef: `${persona.apellido}, ${persona.nombre}`,
    cbu: cbuValido(cbu),
    patagonia: {
      tipoCuenta: VACIO,
      numeroCuenta: VACIO,
      codigoBanco: VACIO,
      codigoSucursal: VACIO,
      tipoDocumento: VACIO,
      numeroDocumento: VACIO,
      provinciaDocumento: VACIO,
      codigoDependencia: VACIO,
    },
  };
}

function registroPatagonia(
  persona: PersonaSintetica,
  indice: number,
  random: () => number,
): MasterRecord {
  return {
    ref: { archivo: 'MAESTRO', hoja: 'Empleados', fila: indice + 2 },
    cuilTexto: persona.cuilTexto,
    cuil: persona.cuil,
    legajo: persona.legajo,
    apellidoNombreRef: `${persona.apellido}, ${persona.nombre}`,
    cbu: VACIO,
    patagonia: {
      tipoCuenta: campoValido<TipoCuentaPatagonia>('2'),
      numeroCuenta: campoValido(digitosAleatorios(random, 10)),
      codigoBanco: campoValido('034'),
      codigoSucursal: campoValido(digitosAleatorios(random, 5)),
      tipoDocumento: campoValido<TipoDocumentoPatagonia>('001'),
      numeroDocumento: campoValido(digitosAleatorios(random, 8)),
      provinciaDocumento: VACIO,
      codigoDependencia: campoValido(CATALOGO_SINTETICO.patagonia.dependencia),
    },
  };
}

const TODO_MAPEADO: PoliticaLiquidaciones = Object.freeze({
  resolver: () => ({ estado: 'MAPEO_APROBADO' as const }),
});

function escenario(
  lineas: readonly PayrollLine[],
  registros: readonly MasterRecord[],
  huellas: { readonly finnegans: string; readonly maestro: string },
  liquidaciones: PoliticaLiquidaciones = TODO_MAPEADO,
): ResultadoConciliacion {
  const finnegans: LecturaFinnegans = {
    hoja: 'hoja1',
    visibilidadHoja: 'visible',
    lineas,
    hallazgos: [],
  };
  const maestro: LecturaMaestro = {
    hoja: 'Empleados',
    versionContrato: '1',
    registros,
    hallazgos: [],
  };
  return conciliar({ finnegans, maestro, huellas, liquidaciones });
}

function lecturaSintetica(conciliacion: ResultadoConciliacion): LecturaFinnegans {
  return {
    hoja: 'Liquidacion exclusivamente sintetica',
    visibilidadHoja: 'visible',
    lineas: conciliacion.filas.map((fila) => fila.linea),
    hallazgos: [],
  };
}

function perfilV2Sintetico(): CompanyProfileV2 {
  const cuitTexto = syntheticCuil('30', 12_345_678);
  if (cuitTexto === null) throw new Error('catálogo sintético sin CUIT asignable');
  const cuit = parseCuitEmpresa(cuitTexto);
  const random = createRandom(101);
  const cbu = parseCbu(syntheticCbu('011', '0001', digitosAleatorios(random, 13)));
  if (!cuit.ok || !cbu.ok) throw new Error('perfil sintético inválido');
  return {
    schemaVersion: '2',
    cuitEmpresa: cuit.value,
    nombreEmpresa: 'EMPRESA SINTETICA DE PRUEBA',
    catalogoBancos: CATALOGO_BANCOS,
    bna: { cbuEmpresa: cbu.value, codigoConvenio: '4455', moneda: '0' },
    mapeosLiquidacion: [],
  };
}

function perfilV3Sintetico(): CompanyProfileV3 {
  const v2 = perfilV2Sintetico();
  return {
    ...v2,
    schemaVersion: '3',
    patagonia: { numeroEmpresa: '1234' },
  };
}

function rechazar(
  banco: ComposicionSinteticaRechazada['banco'],
  codigo: CodigoRechazoCompositorSintetico,
  etapa: ComposicionSinteticaRechazada['etapa'],
  motivo?: string,
): ComposicionSinteticaRechazada {
  return { estado: 'RECHAZADA', banco, codigo, etapa, ...(motivo === undefined ? {} : { motivo }) };
}

function entradaUnica<T extends string>(
  argumentos: readonly unknown[],
  variantes: readonly T[],
):
  | { readonly ok: true; readonly variante: T }
  | { readonly ok: false; readonly codigo: CodigoRechazoCompositorSintetico } {
  if (argumentos.length !== 1 || typeof argumentos[0] !== 'string') {
    return { ok: false, codigo: 'ARGUMENTOS_INVALIDOS' };
  }
  const variante = argumentos[0];
  return (variantes as readonly string[]).includes(variante)
    ? { ok: true, variante: variante as T }
    : { ok: false, codigo: 'VARIANTE_NO_ADMITIDA' };
}

interface EscenarioBnaCerrado {
  readonly conciliacion: ResultadoConciliacion;
  readonly estado: EstadoCorrida;
  readonly snapshot: SnapshotSeleccionIdentificadorHaberesBna;
}

function escenarioBnaCerrado(incompleto: boolean): EscenarioBnaCerrado {
  const catalogo = CATALOGO_SINTETICO.bna;
  const gente = personas(2, catalogo.semilla);
  const random = createRandom(catalogo.semilla);
  const lineas = gente.map((persona, indice) =>
    linea(persona, indice, 'BANCO DE LA NACION ARGENTINA', catalogo.descripciones[indice] ?? ''),
  );
  const registros = gente.map((persona, indice) => registroBna(persona, indice, random));
  const huellas = {
    finnegans: CATALOGO_SINTETICO.huellas.bna,
    maestro: CATALOGO_SINTETICO.huellas.maestro,
  };
  const base = escenario(lineas, registros, huellas);
  const estadoBase = conFinnegans(
    nuevaCorrida(),
    lecturaSintetica(base),
    CATALOGO_SINTETICO.huellas.bna,
  );
  const entradas = catalogo.descripciones.map((descripcionOriginal, indice) => ({
    huellaFinnegans: CATALOGO_SINTETICO.huellas.bna,
    descripcionOriginal,
    destino: 'BNA_GT_HABERES' as const,
    codigoIdentificadorHaberes: catalogo.identificadores[indice] ?? '0000',
  }));
  const aplicacion = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    estadoBase,
    incompleto ? entradas.slice(0, 1) : entradas,
  );
  if (!aplicacion.ok) throw new Error('catálogo sintético BNA inválido');
  const estado = aplicacion.value.estado;
  const snapshot = estado.seleccionIdentificadorHaberesBna;
  if (snapshot === null) throw new Error('catálogo sintético BNA sin snapshot');
  const conciliacion = escenario(
    lineas,
    registros,
    huellas,
    politicaLiquidacionesDesdeSeleccionBna(estado),
  );
  return { conciliacion, estado, snapshot };
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
  const catalogo = CATALOGO_SINTETICO.patagonia;
  const gente = personas(2, catalogo.semilla);
  const random = createRandom(catalogo.semilla);
  const lineas = gente.map((persona, indice) =>
    linea(persona, indice, 'BANCO PATAGONIA S.A.', catalogo.descripciones[indice] ?? ''),
  );
  const registros = gente.map((persona, indice) => registroPatagonia(persona, indice, random));
  const huellas = {
    finnegans: CATALOGO_SINTETICO.huellas.patagonia,
    maestro: CATALOGO_SINTETICO.huellas.maestro,
  };
  const base = escenario(lineas, registros, huellas);
  const estadoBase = conFinnegans(
    nuevaCorrida(),
    lecturaSintetica(base),
    CATALOGO_SINTETICO.huellas.patagonia,
  );
  const selecciones: readonly SeleccionPatagoniaCerrada[] = catalogo.descripciones.map(
    (descripcionOriginal, indice) => ({
      descripcionOriginal,
      codigoTipoLiquidacion: catalogo.tiposLiquidacion[indice] ?? '001',
    }),
  );
  const aplicacion = aplicarSeleccionesLiquidacionPatagoniaCorrida(
    estadoBase,
    (incompleto ? selecciones.slice(0, 1) : selecciones).map((seleccion) => ({
      huellaFinnegans: CATALOGO_SINTETICO.huellas.patagonia,
      destino: 'PATAGONIA_B2' as const,
      ...seleccion,
    })),
  );
  if (!aplicacion.ok) throw new Error('catálogo sintético Patagonia inválido');
  const estado = aplicacion.value.estado;
  const snapshot = estado.seleccionLiquidacionPatagonia;
  if (snapshot === null) throw new Error('catálogo sintético Patagonia sin snapshot');
  const conciliacion = escenario(
    lineas,
    registros,
    huellas,
    politicaLiquidacionesDesdeSeleccionPatagonia(estado),
  );
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

export function componerBnaHomologacionSintetica(
  variante: VarianteBnaSintetica,
): ResultadoComposicionBnaSintetica;
export function componerBnaHomologacionSintetica(
  ...argumentos: readonly unknown[]
): ResultadoComposicionBnaSintetica {
  const entrada = entradaUnica(argumentos, VARIANTES_BNA);
  if (!entrada.ok) return rechazar('BNA_GT_200', entrada.codigo, 'ENTRADA');
  const variante = entrada.variante;
  if (produccionBnaHabilitada()) {
    return rechazar('BNA_GT_200', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }

  const caso = escenarioBnaCerrado(variante === 'SELECCION_INCOMPLETA');
  const huellaVigente =
    variante === 'HUELLA_VENCIDA'
      ? `${CATALOGO_SINTETICO.huellas.bna}-vencida`
      : CATALOGO_SINTETICO.huellas.bna;
  const resolucion = resolverSeleccionIdentificadorHaberesBna(
    caso.snapshot,
    huellaVigente,
    caso.conciliacion.filas.map((fila) => fila.linea),
  );
  if (resolucion === null) return rechazar('BNA_GT_200', 'SNAPSHOT_INCONSISTENTE', 'SELECCION');
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
  if (primerPago === undefined) throw new Error('catálogo sintético BNA sin pagos');
  const pagos =
    variante === 'REFERENCIA_DUPLICADA'
      ? [primerPago, primerPago]
      : variante === 'COBERTURA_INCOMPLETA'
        ? pagosDerivados.slice(0, 1)
        : pagosDerivados;
  const cobertura = coberturaPagosBna(caso.conciliacion, caso.conciliacion.global.bna, pagos);
  if (!cobertura.completa) return rechazar('BNA_GT_200', 'COBERTURA_INCOMPLETA', 'COBERTURA');

  const politicaB2B3 = politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucion);
  const politica: PoliticaBna = {
    ...POLITICA_BNA_HIPOTESIS_TECNICA,
    identificadorPrestamo: politicaB2B3.identificadorPrestamo,
    infoCriterio: POLITICA_BNA_PRODUCTIVA.infoCriterio,
    camposBeneficiario: POLITICA_BNA_PRODUCTIVA.camposBeneficiario,
  };
  const parametrosBase = CATALOGO_SINTETICO.parametros.bna;
  const parametros =
    variante === 'PARAMETROS_INVALIDOS'
      ? { ...parametrosBase, infoCriterioEmpresa: 'CRITERIO SINTETICO DELIBERADAMENTE INVALIDO' }
      : parametrosBase;
  const archivo = serializarBna(
    perfilBnaDesdePerfil(perfilV2Sintetico()),
    parametros,
    pagos,
    politica,
  );
  if (!archivo.ok) return rechazar('BNA_GT_200', 'SERIALIZACION_RECHAZADA', 'SERIALIZACION');
  const inspeccion = inspeccionarBna(archivo.value.bytes, parametros);
  if (!inspeccion.ok) return rechazar('BNA_GT_200', 'INSPECCION_RECHAZADA', 'INSPECCION');
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

export function componerPatagoniaHomologacionSintetica(
  variante: VariantePatagoniaSintetica,
): ResultadoComposicionPatagoniaSintetica;
export function componerPatagoniaHomologacionSintetica(
  ...argumentos: readonly unknown[]
): ResultadoComposicionPatagoniaSintetica {
  const entrada = entradaUnica(argumentos, VARIANTES_PATAGONIA);
  if (!entrada.ok) return rechazar('PATAGONIA_B2', entrada.codigo, 'ENTRADA');
  const variante = entrada.variante;
  if (produccionPatagoniaHabilitada()) {
    return rechazar('PATAGONIA_B2', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }

  const caso = escenarioPatagoniaCerrado(variante === 'SELECCION_INCOMPLETA');
  const conciliacion =
    variante === 'COBERTURA_INCOMPLETA'
      ? romperCoberturaPatagonia(caso.conciliacion)
      : caso.conciliacion;
  const huellaVigente =
    variante === 'HUELLA_VENCIDA'
      ? `${CATALOGO_SINTETICO.huellas.patagonia}-vencida`
      : CATALOGO_SINTETICO.huellas.patagonia;
  const resolucion = resolverSeleccionLiquidacionPatagonia(
    caso.snapshot,
    huellaVigente,
    conciliacion.filas.map((fila) => fila.linea),
  );
  if (resolucion === null) return rechazar('PATAGONIA_B2', 'SNAPSHOT_INCONSISTENTE', 'SELECCION');
  const revisionEsperada = revisionSeleccionLiquidacionPatagonia(resolucion);
  const revisionConciliacion =
    variante === 'REVISION_INCORRECTA'
      ? 'revision-sintetica-deliberadamente-incorrecta'
      : conciliacion.revisionSeleccionLiquidacionPatagonia;
  if (revisionConciliacion !== revisionEsperada) {
    return rechazar('PATAGONIA_B2', 'REVISION_INCONSISTENTE', 'REVISION');
  }

  const parametrosBase = CATALOGO_SINTETICO.parametros.patagonia;
  const parametros =
    variante === 'PARAMETROS_INVALIDOS' ? { ...parametrosBase, numeroEnvio: '00' } : parametrosBase;
  const perfil = perfilV3Sintetico();
  const aptitud = evaluarAptitudTecnicaPatagonia({
    perfil,
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
    return rechazar(
      'PATAGONIA_B2',
      codigo,
      codigo === 'COBERTURA_INCOMPLETA' ? 'COBERTURA' : 'APTITUD',
      aptitud.estado,
    );
  }
  if (aptitud.autorizadoParaGenerar || produccionPatagoniaHabilitada()) {
    return rechazar('PATAGONIA_B2', 'COMPUERTA_PRODUCTIVA_ABIERTA', 'AUTORIZACION');
  }
  const cobertura = coberturaPagosPatagonia(conciliacion, aptitud.readiness.asignadas);
  if (!cobertura.completa) {
    return rechazar('PATAGONIA_B2', 'COBERTURA_INCOMPLETA', 'COBERTURA');
  }

  const politica = politicaPatagoniaDesdeResolucionPatagonia(resolucion);
  const archivo = serializarPatagonia(
    perfilPatagoniaDesdePerfil(perfil),
    parametros,
    aptitud.pagos,
    politica,
  );
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
