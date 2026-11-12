// Catálogo técnico provisional y selección explícita del tipo de liquidación Patagonia B.2
// para una única corrida (CP-F7-C2.4-A2.7-C2). Este módulo es puro: no modifica líneas,
// conciliación, perfiles, políticas ni generación. Una selección válida NO es confirmación
// bancaria, homologación ni autorización productiva.
import { DESTINOS, clasificarBanco, type Destino } from '../../domain/destino';
import type { SourceRef } from '../../domain/incidencias';
import type { PayrollLine } from '../../domain/liquidacion';
import type { Result } from '../../shared/result';

export const ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA = 'DOCUMENTADO_PROVISIONAL' as const;

export type AdvertenciaCatalogoTipoLiquidacionPatagonia = 'PAT_XL_OMITE_006_007' | null;

export interface EntradaCatalogoTipoLiquidacionPatagonia {
  readonly codigo: string;
  readonly concepto: string;
  readonly estadoDocumental: typeof ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA;
  readonly fuente: 'PAT-DR_ANEXO_III';
  readonly confirmadoPorRespuestaEscrita: false;
  readonly homologado: false;
  readonly advertencia: AdvertenciaCatalogoTipoLiquidacionPatagonia;
}

/**
 * Referencia técnica provisional de PAT-DR Anexo III. PAT-XL es evidencia complementaria:
 * agrega 005 (excluido) y omite 006/007 (discrepancia conservada en esas entradas).
 */
export const CATALOGO_TIPOS_LIQUIDACION_PATAGONIA = [
  {
    codigo: '001',
    concepto: 'SUELDO',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: null,
  },
  {
    codigo: '002',
    concepto: 'S.A.C.',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: null,
  },
  {
    codigo: '003',
    concepto: 'VARIOS',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: null,
  },
  {
    codigo: '004',
    concepto: 'HONORARIOS',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: null,
  },
  {
    codigo: '006',
    concepto: 'HABERES JUBILATORIOS',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: 'PAT_XL_OMITE_006_007',
  },
  {
    codigo: '007',
    concepto: 'RENTA VITALICIA',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: 'PAT_XL_OMITE_006_007',
  },
  {
    codigo: '009',
    concepto: 'ULTIMA ACREDITACION AUTOMATICA',
    estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
    fuente: 'PAT-DR_ANEXO_III',
    confirmadoPorRespuestaEscrita: false,
    homologado: false,
    advertencia: null,
  },
] as const satisfies readonly EntradaCatalogoTipoLiquidacionPatagonia[];

export type CodigoTipoLiquidacionPatagoniaProvisional =
  (typeof CATALOGO_TIPOS_LIQUIDACION_PATAGONIA)[number]['codigo'];

export interface CorridaSeleccionLiquidacionPatagonia {
  /** FileFingerprint de los bytes Finnegans, con la misma representación de EstadoCorrida. */
  readonly huellaFinnegans: string;
  readonly lineas: readonly PayrollLine[];
}

export interface SeleccionLiquidacionPatagonia {
  readonly huellaFinnegans: string;
  readonly descripcionOriginal: string;
  readonly destino: 'PATAGONIA_B2';
  readonly codigoTipoLiquidacion: CodigoTipoLiquidacionPatagoniaProvisional;
}

export interface SeleccionLiquidacionPatagoniaValidada extends SeleccionLiquidacionPatagonia {
  readonly concepto: string;
  readonly estadoDocumental: typeof ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA;
  readonly confirmadoPorRespuestaEscrita: false;
  readonly homologado: false;
}

export interface CantidadSeleccionadaPatagonia {
  readonly descripcionOriginal: string;
  readonly cantidadFilasPatagonia: number;
  readonly refs: readonly SourceRef[];
}

export interface LiquidacionPatagoniaPendiente {
  readonly descripcionOriginal: string;
  readonly cantidadFilasPatagonia: number;
  readonly refs: readonly SourceRef[];
}

export interface AplicacionSeleccionesLiquidacionPatagonia {
  readonly huellaFinnegans: string;
  /** Las mismas líneas, en el mismo orden y sin códigos bancarios incorporados. */
  readonly lineas: readonly PayrollLine[];
  readonly seleccionesValidadas: readonly SeleccionLiquidacionPatagoniaValidada[];
  readonly cantidadesAfectadas: readonly CantidadSeleccionadaPatagonia[];
  readonly pendientes: readonly LiquidacionPatagoniaPendiente[];
}

export type CampoSeleccionLiquidacionPatagonia =
  'huellaFinnegans' | 'descripcionOriginal' | 'destino' | 'codigoTipoLiquidacion';

export type ErrorSeleccionLiquidacionPatagonia =
  | { readonly codigo: 'HUELLA_CORRIDA_INVALIDA' }
  | { readonly codigo: 'ENTRADA_NO_ES_LISTA' }
  | { readonly codigo: 'SELECCION_NO_ES_OBJETO'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'TIPO_INVALIDO';
      readonly indiceSeleccion: number;
      readonly campo: CampoSeleccionLiquidacionPatagonia;
    }
  | {
      readonly codigo: 'CAMPO_VACIO';
      readonly indiceSeleccion: number;
      readonly campo: CampoSeleccionLiquidacionPatagonia;
    }
  | { readonly codigo: 'DESTINO_INVALIDO'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'DESTINO_NO_ADMITIDO';
      readonly indiceSeleccion: number;
      readonly destino: Exclude<Destino, 'PATAGONIA_B2'>;
    }
  | { readonly codigo: 'SELECCION_DESVINCULADA'; readonly indiceSeleccion: number }
  | {
      readonly codigo: 'CODIGO_FUERA_CATALOGO';
      readonly indiceSeleccion: number;
      readonly codigoTipoLiquidacion: string;
    }
  | {
      readonly codigo: 'SELECCION_DESCONOCIDA';
      readonly indiceSeleccion: number;
      readonly descripcionOriginal: string;
    }
  | {
      readonly codigo: 'DESCRIPCION_SIN_FILAS_PATAGONIA';
      readonly indiceSeleccion: number;
      readonly descripcionOriginal: string;
    }
  | {
      readonly codigo: 'SELECCION_DUPLICADA';
      readonly descripcionOriginal: string;
      readonly destino: 'PATAGONIA_B2';
      readonly indicesSeleccion: readonly [number, number];
    }
  | {
      readonly codigo: 'SELECCION_CONTRADICTORIA';
      readonly descripcionOriginal: string;
      readonly destino: 'PATAGONIA_B2';
      readonly indicesSeleccion: readonly [number, number];
    };

export type ResultadoSeleccionesLiquidacionPatagonia = Result<
  AplicacionSeleccionesLiquidacionPatagonia,
  readonly ErrorSeleccionLiquidacionPatagonia[]
>;

const CAMPOS_SELECCION = [
  'huellaFinnegans',
  'descripcionOriginal',
  'destino',
  'codigoTipoLiquidacion',
] as const satisfies readonly CampoSeleccionLiquidacionPatagonia[];

type EntradaCatalogoProvisional = (typeof CATALOGO_TIPOS_LIQUIDACION_PATAGONIA)[number];

const catalogoPorCodigo: ReadonlyMap<string, EntradaCatalogoProvisional> = new Map(
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.map((entrada) => [entrada.codigo, entrada] as const),
);

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esDestino(valor: string): valor is Destino {
  return (DESTINOS as readonly string[]).includes(valor);
}

function filasPatagoniaPorDescripcion(
  lineas: readonly PayrollLine[],
): ReadonlyMap<string, readonly PayrollLine[]> {
  const resultado = new Map<string, PayrollLine[]>();
  for (const linea of lineas) {
    const banco = clasificarBanco(linea.bancoFinnegans);
    if (banco.tipo !== 'CATALOGADO' || banco.banco.destino !== 'PATAGONIA_B2') continue;
    const descripcion = linea.descripcion.descripcionOriginal;
    resultado.set(descripcion, [...(resultado.get(descripcion) ?? []), linea]);
  }
  return resultado;
}

/**
 * Valida y recalcula selecciones desde las líneas originales de una única corrida. La clave
 * es (`descripcionOriginal` exacta, `PATAGONIA_B2`). Una descripción no puede expresar dos
 * conceptos distintos dentro de Patagonia: dos códigos para esa clave se rechazan como
 * contradicción y el caso requiere una selección más granular en un checkpoint posterior.
 *
 * `entrada` es `unknown` para validar también el borde de runtime. Ante cualquier error no
 * devuelve selecciones, cantidades ni pendientes parciales y nunca modifica sus argumentos.
 */
export function aplicarSeleccionesLiquidacionPatagonia(
  corrida: CorridaSeleccionLiquidacionPatagonia,
  entrada: unknown,
): ResultadoSeleccionesLiquidacionPatagonia {
  if (corrida.huellaFinnegans.trim() === '') {
    return { ok: false, error: [{ codigo: 'HUELLA_CORRIDA_INVALIDA' }] };
  }
  if (!Array.isArray(entrada)) {
    return { ok: false, error: [{ codigo: 'ENTRADA_NO_ES_LISTA' }] };
  }

  const errores: ErrorSeleccionLiquidacionPatagonia[] = [];
  const selecciones: SeleccionLiquidacionPatagoniaValidada[] = [];
  const descripcionesCorrida = new Set(
    corrida.lineas.map((linea) => linea.descripcion.descripcionOriginal),
  );
  const filasPatagonia = filasPatagoniaPorDescripcion(corrida.lineas);
  const primeraPorDescripcion = new Map<
    string,
    { readonly indice: number; readonly seleccion: SeleccionLiquidacionPatagoniaValidada }
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

    const cruda = valor as Record<CampoSeleccionLiquidacionPatagonia, string>;
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
    if (cruda.destino !== 'PATAGONIA_B2') {
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

    const catalogo = catalogoPorCodigo.get(cruda.codigoTipoLiquidacion);
    if (catalogo === undefined) {
      errores.push({
        codigo: 'CODIGO_FUERA_CATALOGO',
        indiceSeleccion,
        codigoTipoLiquidacion: cruda.codigoTipoLiquidacion,
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
    if (!filasPatagonia.has(cruda.descripcionOriginal)) {
      errores.push({
        codigo: 'DESCRIPCION_SIN_FILAS_PATAGONIA',
        indiceSeleccion,
        descripcionOriginal: cruda.descripcionOriginal,
      });
      return;
    }

    const seleccion: SeleccionLiquidacionPatagoniaValidada = {
      huellaFinnegans: cruda.huellaFinnegans,
      descripcionOriginal: cruda.descripcionOriginal,
      destino: 'PATAGONIA_B2',
      codigoTipoLiquidacion: catalogo.codigo,
      concepto: catalogo.concepto,
      estadoDocumental: catalogo.estadoDocumental,
      confirmadoPorRespuestaEscrita: false,
      homologado: false,
    };
    const primera = primeraPorDescripcion.get(seleccion.descripcionOriginal);
    if (primera !== undefined) {
      errores.push({
        codigo:
          primera.seleccion.codigoTipoLiquidacion === seleccion.codigoTipoLiquidacion
            ? 'SELECCION_DUPLICADA'
            : 'SELECCION_CONTRADICTORIA',
        descripcionOriginal: seleccion.descripcionOriginal,
        destino: 'PATAGONIA_B2',
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
  const resumen = (descripcionOriginal: string): CantidadSeleccionadaPatagonia => {
    const lineas = filasPatagonia.get(descripcionOriginal) ?? [];
    return {
      descripcionOriginal,
      cantidadFilasPatagonia: lineas.length,
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
      pendientes: [...filasPatagonia.keys()]
        .filter((descripcion) => !seleccionadas.has(descripcion))
        .map((descripcion) => resumen(descripcion)),
    },
  };
}
