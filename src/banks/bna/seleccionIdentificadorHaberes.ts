// Selección explícita del identificador de haberes BNA GT 200 para una única corrida
// (CP-F7-BNA-B1). Este módulo puro solo registra y valida decisiones: no modifica líneas,
// conciliación, política BNA, mapper, serialización ni autorización productiva.
import { DESTINOS, clasificarBanco, type Destino } from '../../domain/destino';
import { claveRef, type SourceRef } from '../../domain/incidencias';
import type { PayrollLine } from '../../domain/liquidacion';
import type { Result } from '../../shared/result';

export interface EntradaCatalogoIdentificadorHaberesBna {
  readonly codigo: '0000' | '0003';
  readonly descripcion: string;
  readonly consecuencia: string;
  readonly seleccionAutomatica: false;
}

/**
 * Catálogo cerrado documentado por BNA. Los códigos no clasifican textos de Finnegans:
 * RRHH debe elegir uno explícitamente para cada descripción exacta de la corrida.
 */
export const CATALOGO_IDENTIFICADORES_HABERES_BNA = [
  {
    codigo: '0000',
    descripcion: 'HABERES ORDINARIOS',
    consecuencia: 'SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS',
    seleccionAutomatica: false,
  },
  {
    codigo: '0003',
    descripcion: 'HABERES EXTRAORDINARIOS',
    consecuencia: 'NO SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS',
    seleccionAutomatica: false,
  },
] as const satisfies readonly EntradaCatalogoIdentificadorHaberesBna[];

export type CodigoIdentificadorHaberesBna =
  (typeof CATALOGO_IDENTIFICADORES_HABERES_BNA)[number]['codigo'];

export interface CorridaSeleccionIdentificadorHaberesBna {
  /** FileFingerprint de los bytes Finnegans observado por EstadoCorrida. */
  readonly huellaFinnegans: string;
  readonly lineas: readonly PayrollLine[];
}

export interface SeleccionIdentificadorHaberesBna {
  readonly huellaFinnegans: string;
  readonly descripcionOriginal: string;
  readonly destino: 'BNA_GT_HABERES';
  readonly codigoIdentificadorHaberes: CodigoIdentificadorHaberesBna;
}

export interface SeleccionIdentificadorHaberesBnaValidada extends SeleccionIdentificadorHaberesBna {
  readonly descripcionCodigo: string;
  readonly consecuencia: string;
  readonly seleccionAutomatica: false;
}

export interface CoberturaDescripcionBna {
  readonly descripcionOriginal: string;
  readonly cantidadFilasBna: number;
  readonly refs: readonly SourceRef[];
}

export type LiquidacionBnaPendiente = CoberturaDescripcionBna;

export interface AplicacionSeleccionesIdentificadorHaberesBna {
  readonly huellaFinnegans: string;
  /** Las mismas líneas, en el mismo orden y sin códigos bancarios incorporados. */
  readonly lineas: readonly PayrollLine[];
  readonly seleccionesValidadas: readonly SeleccionIdentificadorHaberesBnaValidada[];
  readonly cantidadesAfectadas: readonly CoberturaDescripcionBna[];
  readonly pendientes: readonly LiquidacionBnaPendiente[];
}

export type CampoSeleccionIdentificadorHaberesBna =
  'huellaFinnegans' | 'descripcionOriginal' | 'destino' | 'codigoIdentificadorHaberes';

export type ErrorSeleccionIdentificadorHaberesBna =
  | { readonly codigo: 'HUELLA_CORRIDA_INVALIDA' }
  | { readonly codigo: 'ENTRADA_NO_ES_LISTA' }
  | { readonly codigo: 'SELECCION_NO_ES_OBJETO'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'TIPO_INVALIDO';
      readonly indiceSeleccion: number;
      readonly campo: CampoSeleccionIdentificadorHaberesBna;
    }
  | {
      readonly codigo: 'CAMPO_VACIO';
      readonly indiceSeleccion: number;
      readonly campo: CampoSeleccionIdentificadorHaberesBna;
    }
  | { readonly codigo: 'DESTINO_INVALIDO'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'DESTINO_NO_ADMITIDO';
      readonly indiceSeleccion: number;
      readonly destino: Exclude<Destino, 'BNA_GT_HABERES'>;
    }
  | { readonly codigo: 'SELECCION_DESVINCULADA'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'CODIGO_FUERA_CATALOGO';
      readonly indiceSeleccion: number;
      readonly codigoIdentificadorHaberes: string;
    }
  | {
      readonly codigo: 'SELECCION_DESCONOCIDA';
      readonly indiceSeleccion: number;
      readonly descripcionOriginal: string;
    }
  | {
      readonly codigo: 'DESCRIPCION_SIN_FILAS_BNA';
      readonly indiceSeleccion: number;
      readonly descripcionOriginal: string;
    }
  | {
      readonly codigo: 'SELECCION_DUPLICADA';
      readonly descripcionOriginal: string;
      readonly destino: 'BNA_GT_HABERES';
      readonly indicesSeleccion: readonly [number, number];
    }
  | {
      readonly codigo: 'SELECCION_CONTRADICTORIA';
      readonly descripcionOriginal: string;
      readonly destino: 'BNA_GT_HABERES';
      readonly indicesSeleccion: readonly [number, number];
    }
  | { readonly codigo: 'REFERENCIA_DUPLICADA_CORRIDA'; readonly ref: SourceRef };

export type ResultadoSeleccionesIdentificadorHaberesBna = Result<
  AplicacionSeleccionesIdentificadorHaberesBna,
  readonly ErrorSeleccionIdentificadorHaberesBna[]
>;

const CAMPOS_SELECCION = [
  'huellaFinnegans',
  'descripcionOriginal',
  'destino',
  'codigoIdentificadorHaberes',
] as const satisfies readonly CampoSeleccionIdentificadorHaberesBna[];

type EntradaCatalogo = (typeof CATALOGO_IDENTIFICADORES_HABERES_BNA)[number];

const catalogoPorCodigo: ReadonlyMap<string, EntradaCatalogo> = new Map(
  CATALOGO_IDENTIFICADORES_HABERES_BNA.map((entrada) => [entrada.codigo, entrada] as const),
);

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esDestino(valor: string): valor is Destino {
  return (DESTINOS as readonly string[]).includes(valor);
}

function esLineaBna(linea: PayrollLine): boolean {
  const banco = clasificarBanco(linea.bancoFinnegans);
  return banco.tipo === 'CATALOGADO' && banco.banco.destino === 'BNA_GT_HABERES';
}

function filasBnaPorDescripcion(
  lineas: readonly PayrollLine[],
): ReadonlyMap<string, readonly PayrollLine[]> {
  const resultado = new Map<string, PayrollLine[]>();
  for (const linea of lineas) {
    if (!esLineaBna(linea)) continue;
    const descripcion = linea.descripcion.descripcionOriginal;
    resultado.set(descripcion, [...(resultado.get(descripcion) ?? []), linea]);
  }
  return resultado;
}

/** Identifica descripciones BNA por igualdad exacta, conservando orden y SourceRef. */
export function identificarDescripcionesLiquidacionBna(
  lineas: readonly PayrollLine[],
): readonly LiquidacionBnaPendiente[] {
  return [...filasBnaPorDescripcion(lineas)].map(([descripcionOriginal, filas]) => ({
    descripcionOriginal,
    cantidadFilasBna: filas.length,
    refs: filas.map((linea) => linea.ref),
  }));
}

function referenciasDuplicadasBna(
  lineas: readonly PayrollLine[],
): ErrorSeleccionIdentificadorHaberesBna[] {
  const vistas = new Set<string>();
  const informadas = new Set<string>();
  const errores: ErrorSeleccionIdentificadorHaberesBna[] = [];
  for (const linea of lineas) {
    if (!esLineaBna(linea)) continue;
    const clave = claveRef(linea.ref);
    if (vistas.has(clave) && !informadas.has(clave)) {
      informadas.add(clave);
      errores.push({ codigo: 'REFERENCIA_DUPLICADA_CORRIDA', ref: linea.ref });
    }
    vistas.add(clave);
  }
  return errores;
}

/**
 * Valida selecciones contra una única corrida. La clave es
 * (`descripcionOriginal` exacta, `BNA_GT_HABERES`): una selección cubre todas las filas BNA
 * de esa clave y nunca filas Patagonia. Ante cualquier error falla sin resultado parcial.
 */
export function aplicarSeleccionesIdentificadorHaberesBna(
  corrida: CorridaSeleccionIdentificadorHaberesBna,
  entrada: unknown,
): ResultadoSeleccionesIdentificadorHaberesBna {
  if (corrida.huellaFinnegans.trim() === '') {
    return { ok: false, error: [{ codigo: 'HUELLA_CORRIDA_INVALIDA' }] };
  }
  if (!Array.isArray(entrada)) {
    return { ok: false, error: [{ codigo: 'ENTRADA_NO_ES_LISTA' }] };
  }
  const referenciasDuplicadas = referenciasDuplicadasBna(corrida.lineas);
  if (referenciasDuplicadas.length > 0) {
    return { ok: false, error: referenciasDuplicadas };
  }

  const errores: ErrorSeleccionIdentificadorHaberesBna[] = [];
  const selecciones: SeleccionIdentificadorHaberesBnaValidada[] = [];
  const descripcionesCorrida = new Set(
    corrida.lineas.map((linea) => linea.descripcion.descripcionOriginal),
  );
  const filasBna = filasBnaPorDescripcion(corrida.lineas);
  const primeraPorDescripcion = new Map<
    string,
    { readonly indice: number; readonly seleccion: SeleccionIdentificadorHaberesBnaValidada }
  >();

  entrada.forEach((valor: unknown, indiceSeleccion) => {
    if (!esObjeto(valor)) {
      errores.push({ codigo: 'SELECCION_NO_ES_OBJETO', indiceSeleccion });
      return;
    }

    let tiposValidos = true;
    for (const campo of CAMPOS_SELECCION) {
      if (typeof valor[campo] !== 'string') {
        tiposValidos = false;
        errores.push({ codigo: 'TIPO_INVALIDO', indiceSeleccion, campo });
      }
    }
    if (!tiposValidos) return;

    const cruda = valor as Record<CampoSeleccionIdentificadorHaberesBna, string>;
    let hayVacios = false;
    for (const campo of CAMPOS_SELECCION) {
      if (cruda[campo].trim() === '') {
        hayVacios = true;
        errores.push({ codigo: 'CAMPO_VACIO', indiceSeleccion, campo });
      }
    }
    if (hayVacios) return;

    if (!esDestino(cruda.destino)) {
      errores.push({ codigo: 'DESTINO_INVALIDO', indiceSeleccion });
      return;
    }
    if (cruda.destino !== 'BNA_GT_HABERES') {
      errores.push({
        codigo: 'DESTINO_NO_ADMITIDO',
        indiceSeleccion,
        destino: cruda.destino,
      });
      return;
    }
    if (cruda.huellaFinnegans !== corrida.huellaFinnegans) {
      errores.push({ codigo: 'SELECCION_DESVINCULADA', indiceSeleccion });
      return;
    }

    const catalogo = catalogoPorCodigo.get(cruda.codigoIdentificadorHaberes);
    if (catalogo === undefined) {
      errores.push({
        codigo: 'CODIGO_FUERA_CATALOGO',
        indiceSeleccion,
        codigoIdentificadorHaberes: cruda.codigoIdentificadorHaberes,
      });
      return;
    }
    if (!descripcionesCorrida.has(cruda.descripcionOriginal)) {
      errores.push({
        codigo: 'SELECCION_DESCONOCIDA',
        indiceSeleccion,
        descripcionOriginal: cruda.descripcionOriginal,
      });
      return;
    }
    if (!filasBna.has(cruda.descripcionOriginal)) {
      errores.push({
        codigo: 'DESCRIPCION_SIN_FILAS_BNA',
        indiceSeleccion,
        descripcionOriginal: cruda.descripcionOriginal,
      });
      return;
    }

    const seleccion: SeleccionIdentificadorHaberesBnaValidada = {
      huellaFinnegans: cruda.huellaFinnegans,
      descripcionOriginal: cruda.descripcionOriginal,
      destino: 'BNA_GT_HABERES',
      codigoIdentificadorHaberes: catalogo.codigo,
      descripcionCodigo: catalogo.descripcion,
      consecuencia: catalogo.consecuencia,
      seleccionAutomatica: false,
    };
    const primera = primeraPorDescripcion.get(seleccion.descripcionOriginal);
    if (primera !== undefined) {
      errores.push({
        codigo:
          primera.seleccion.codigoIdentificadorHaberes === seleccion.codigoIdentificadorHaberes
            ? 'SELECCION_DUPLICADA'
            : 'SELECCION_CONTRADICTORIA',
        descripcionOriginal: seleccion.descripcionOriginal,
        destino: 'BNA_GT_HABERES',
        indicesSeleccion: [primera.indice, indiceSeleccion],
      });
      return;
    }
    primeraPorDescripcion.set(seleccion.descripcionOriginal, {
      indice: indiceSeleccion,
      seleccion,
    });
    selecciones.push(seleccion);
  });

  if (errores.length > 0) return { ok: false, error: errores };

  const seleccionadas = new Set(selecciones.map((seleccion) => seleccion.descripcionOriginal));
  const resumen = (descripcionOriginal: string): CoberturaDescripcionBna => {
    const lineas = filasBna.get(descripcionOriginal) ?? [];
    return {
      descripcionOriginal,
      cantidadFilasBna: lineas.length,
      refs: lineas.map((linea) => linea.ref),
    };
  };

  return {
    ok: true,
    value: {
      huellaFinnegans: corrida.huellaFinnegans,
      lineas: corrida.lineas,
      seleccionesValidadas: selecciones,
      cantidadesAfectadas: selecciones.map((seleccion) => resumen(seleccion.descripcionOriginal)),
      pendientes: [...filasBna.keys()]
        .filter((descripcion) => !seleccionadas.has(descripcion))
        .map(resumen),
    },
  };
}
