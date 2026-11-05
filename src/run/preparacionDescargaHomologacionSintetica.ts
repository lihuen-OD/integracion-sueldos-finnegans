// CP-F8-C: fachada browser-safe para preparar únicamente descargas sintéticas cerradas.
// No recibe ni consulta corridas, conciliaciones, perfiles, empleados, pagos o archivos externos.
import { calcularHuella } from '../import/huella';
import {
  ADVERTENCIA_ARCHIVO_SINTETICO,
  NOMBRE_ARCHIVO_BNA_SINTETICO,
  NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
  VARIANTES_BNA,
  VARIANTES_PATAGONIA,
  componerBnaHomologacionSintetica,
  componerPatagoniaHomologacionSintetica,
  type CodigoRechazoCompositorSintetico,
  type VarianteBnaSintetica,
  type VariantePatagoniaSintetica,
} from './composicionHomologacionSintetica';

export type BancoDescargaHomologacionSintetica = 'BNA' | 'PATAGONIA';
export type VarianteDescargaHomologacionSintetica =
  VarianteBnaSintetica | VariantePatagoniaSintetica;

export const TXT_SINTETICO_MIME_TYPE = 'text/plain;charset=us-ascii' as const;

export interface ResumenInspeccionDescargaSintetica {
  readonly estado: 'OK';
  readonly cantidadRegistros: number;
  readonly cantidadPagos: number;
  readonly cantidadLotes?: number;
}

interface PreparacionDescargaHomologacionSinteticaBase {
  readonly estado: 'PREPARADA';
  readonly nombreArchivo: string;
  readonly advertencia: typeof ADVERTENCIA_ARCHIVO_SINTETICO;
  readonly cantidadBytes: number;
  readonly sha256: string;
  readonly inspeccion: ResumenInspeccionDescargaSintetica;
  readonly bytes: Uint8Array;
  readonly productivo: false;
  readonly homologado: false;
}

export type PreparacionDescargaHomologacionSintetica =
  PreparacionDescargaHomologacionSinteticaBase &
    (
      | { readonly banco: 'BNA'; readonly variante: VarianteBnaSintetica }
      | { readonly banco: 'PATAGONIA'; readonly variante: VariantePatagoniaSintetica }
    );

export type CodigoRechazoPreparacionDescargaSintetica =
  | 'ARGUMENTOS_INVALIDOS'
  | 'BANCO_NO_ADMITIDO'
  | 'VARIANTE_NO_ADMITIDA'
  | 'COMPOSICION_RECHAZADA'
  | 'HUELLA_NO_DISPONIBLE';

export interface PreparacionDescargaHomologacionSinteticaRechazada {
  readonly estado: 'RECHAZADA';
  readonly codigo: CodigoRechazoPreparacionDescargaSintetica;
  /** Código técnico cerrado; nunca contiene valores de empleados, cuentas ni importes. */
  readonly motivo?: CodigoRechazoCompositorSintetico;
}

export type ResultadoPreparacionDescargaHomologacionSintetica =
  PreparacionDescargaHomologacionSintetica | PreparacionDescargaHomologacionSinteticaRechazada;

function varianteAdmitida(valor: string, variantes: readonly string[]): boolean {
  return variantes.includes(valor);
}

function entradaCerrada(argumentos: readonly unknown[]):
  | {
      readonly ok: true;
      readonly banco: 'BNA';
      readonly variante: VarianteBnaSintetica;
    }
  | {
      readonly ok: true;
      readonly banco: 'PATAGONIA';
      readonly variante: VariantePatagoniaSintetica;
    }
  | {
      readonly ok: false;
      readonly codigo: CodigoRechazoPreparacionDescargaSintetica;
    } {
  if (
    argumentos.length !== 2 ||
    typeof argumentos[0] !== 'string' ||
    typeof argumentos[1] !== 'string'
  ) {
    return { ok: false, codigo: 'ARGUMENTOS_INVALIDOS' };
  }
  const [banco, variante] = argumentos;
  if (banco !== 'BNA' && banco !== 'PATAGONIA') {
    return { ok: false, codigo: 'BANCO_NO_ADMITIDO' };
  }
  if (banco === 'BNA') {
    if (!varianteAdmitida(variante, VARIANTES_BNA)) {
      return { ok: false, codigo: 'VARIANTE_NO_ADMITIDA' };
    }
    return { ok: true, banco, variante: variante as VarianteBnaSintetica };
  }
  if (!varianteAdmitida(variante, VARIANTES_PATAGONIA)) {
    return { ok: false, codigo: 'VARIANTE_NO_ADMITIDA' };
  }
  return { ok: true, banco, variante: variante as VariantePatagoniaSintetica };
}

async function prepararBna(
  variante: VarianteBnaSintetica,
): Promise<ResultadoPreparacionDescargaHomologacionSintetica> {
  const composicion = componerBnaHomologacionSintetica(variante);
  if (composicion.estado !== 'COMPUESTA_EN_MEMORIA') {
    return { estado: 'RECHAZADA', codigo: 'COMPOSICION_RECHAZADA', motivo: composicion.codigo };
  }
  const bytes = composicion.bytes.slice();
  try {
    return Object.freeze({
      estado: 'PREPARADA',
      banco: 'BNA',
      variante,
      nombreArchivo: NOMBRE_ARCHIVO_BNA_SINTETICO,
      advertencia: ADVERTENCIA_ARCHIVO_SINTETICO,
      cantidadBytes: bytes.byteLength,
      sha256: await calcularHuella(bytes),
      inspeccion: Object.freeze({
        estado: 'OK',
        cantidadRegistros: composicion.inspeccion.registros.length,
        cantidadPagos: composicion.inspeccion.cantidadCalculada,
      }),
      bytes,
      productivo: false,
      homologado: false,
    });
  } catch {
    return { estado: 'RECHAZADA', codigo: 'HUELLA_NO_DISPONIBLE' };
  }
}

async function prepararPatagonia(
  variante: VariantePatagoniaSintetica,
): Promise<ResultadoPreparacionDescargaHomologacionSintetica> {
  const composicion = componerPatagoniaHomologacionSintetica(variante);
  if (composicion.estado !== 'COMPUESTA_EN_MEMORIA') {
    return { estado: 'RECHAZADA', codigo: 'COMPOSICION_RECHAZADA', motivo: composicion.codigo };
  }
  const bytes = composicion.bytes.slice();
  try {
    return Object.freeze({
      estado: 'PREPARADA',
      banco: 'PATAGONIA',
      variante,
      nombreArchivo: NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
      advertencia: ADVERTENCIA_ARCHIVO_SINTETICO,
      cantidadBytes: bytes.byteLength,
      sha256: await calcularHuella(bytes),
      inspeccion: Object.freeze({
        estado: 'OK',
        cantidadRegistros: composicion.inspeccion.registros.length,
        cantidadPagos: composicion.inspeccion.cantidadPagosCalculada,
        cantidadLotes: composicion.inspeccion.cantidadLotesCalculada,
      }),
      bytes,
      productivo: false,
      homologado: false,
    });
  } catch {
    return { estado: 'RECHAZADA', codigo: 'HUELLA_NO_DISPONIBLE' };
  }
}

/**
 * Única entrada pública de preparación para la UI. Exige exactamente banco y variante cerrados.
 * Devuelve bytes sintéticos en memoria; nunca crea Blob, inicia descarga ni lee estado de RRHH.
 */
export function prepararDescargaHomologacionSintetica(
  banco: 'BNA',
  variante: VarianteBnaSintetica,
): Promise<ResultadoPreparacionDescargaHomologacionSintetica>;
export function prepararDescargaHomologacionSintetica(
  banco: 'PATAGONIA',
  variante: VariantePatagoniaSintetica,
): Promise<ResultadoPreparacionDescargaHomologacionSintetica>;
export async function prepararDescargaHomologacionSintetica(
  ...argumentos: readonly unknown[]
): Promise<ResultadoPreparacionDescargaHomologacionSintetica> {
  const entrada = entradaCerrada(argumentos);
  if (!entrada.ok) return { estado: 'RECHAZADA', codigo: entrada.codigo };
  return entrada.banco === 'BNA'
    ? prepararBna(entrada.variante)
    : prepararPatagonia(entrada.variante);
}
