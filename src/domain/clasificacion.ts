// Clasificacion explicita de las descripciones de una unica corrida de Finnegans.
// No interpreta texto, no conoce codigos bancarios y no conserva estado entre llamadas.
import type { PayrollLine } from './liquidacion';
import type { Result } from '../shared/result';

export interface ClasificacionExplicita {
  readonly descripcionOriginal: string;
  readonly periodo: string;
  readonly tipoLiquidacionNormalizado: string;
}

export interface CantidadClasificadaPorDescripcion {
  readonly descripcionOriginal: string;
  readonly cantidadLineas: number;
}

export interface AplicacionClasificacionesExplicitas {
  readonly lineas: readonly PayrollLine[];
  readonly cantidadesAfectadas: readonly CantidadClasificadaPorDescripcion[];
}

export type CampoClasificacionExplicita =
  'descripcionOriginal' | 'periodo' | 'tipoLiquidacionNormalizado';

export type ErrorClasificacionExplicita =
  | {
      readonly codigo: 'CAMPO_VACIO';
      readonly indiceSeleccion: number;
      readonly campo: CampoClasificacionExplicita;
    }
  | {
      readonly codigo: 'SELECCION_DESCONOCIDA';
      readonly indiceSeleccion: number;
      readonly descripcionOriginal: string;
    }
  | {
      readonly codigo: 'SELECCION_DUPLICADA';
      readonly descripcionOriginal: string;
      readonly indicesSeleccion: readonly [number, number];
    }
  | {
      readonly codigo: 'SELECCION_CONTRADICTORIA';
      readonly descripcionOriginal: string;
      readonly indicesSeleccion: readonly [number, number];
    };

export type ResultadoClasificacionesExplicitas = Result<
  AplicacionClasificacionesExplicitas,
  readonly ErrorClasificacionExplicita[]
>;

const CAMPOS_REQUERIDOS: readonly CampoClasificacionExplicita[] = [
  'descripcionOriginal',
  'periodo',
  'tipoLiquidacionNormalizado',
];

function camposIguales(a: ClasificacionExplicita, b: ClasificacionExplicita): boolean {
  return a.periodo === b.periodo && a.tipoLiquidacionNormalizado === b.tipoLiquidacionNormalizado;
}

/**
 * Recalcula la clasificacion de las lineas recibidas a partir de selecciones explicitas.
 * La coincidencia de `descripcionOriginal` es exacta. Ante cualquier error no devuelve
 * lineas parciales. Tanto las lineas como las selecciones de entrada quedan intactas.
 */
export function aplicarClasificacionesExplicitas(
  lineas: readonly PayrollLine[],
  selecciones: readonly ClasificacionExplicita[],
): ResultadoClasificacionesExplicitas {
  const errores: ErrorClasificacionExplicita[] = [];
  const descripcionesDeLaCorrida = new Set(
    lineas.map((linea) => linea.descripcion.descripcionOriginal),
  );
  const primeraSeleccionPorDescripcion = new Map<
    string,
    { readonly indice: number; readonly seleccion: ClasificacionExplicita }
  >();

  selecciones.forEach((seleccion, indiceSeleccion) => {
    let tieneCampoVacio = false;
    for (const campo of CAMPOS_REQUERIDOS) {
      if (seleccion[campo].trim() === '') {
        tieneCampoVacio = true;
        errores.push({ codigo: 'CAMPO_VACIO', indiceSeleccion, campo });
      }
    }

    if (tieneCampoVacio) return;

    const primera = primeraSeleccionPorDescripcion.get(seleccion.descripcionOriginal);
    if (primera === undefined) {
      primeraSeleccionPorDescripcion.set(seleccion.descripcionOriginal, {
        indice: indiceSeleccion,
        seleccion,
      });
    } else {
      errores.push({
        codigo: camposIguales(primera.seleccion, seleccion)
          ? 'SELECCION_DUPLICADA'
          : 'SELECCION_CONTRADICTORIA',
        descripcionOriginal: seleccion.descripcionOriginal,
        indicesSeleccion: [primera.indice, indiceSeleccion],
      });
    }

    if (!descripcionesDeLaCorrida.has(seleccion.descripcionOriginal)) {
      errores.push({
        codigo: 'SELECCION_DESCONOCIDA',
        indiceSeleccion,
        descripcionOriginal: seleccion.descripcionOriginal,
      });
    }
  });

  if (errores.length > 0) return { ok: false, error: errores };

  const seleccionPorDescripcion = new Map(
    selecciones.map((seleccion) => [seleccion.descripcionOriginal, seleccion] as const),
  );
  const cantidades = new Map<string, number>();
  const nuevasLineas = lineas.map((linea): PayrollLine => {
    const descripcionOriginal = linea.descripcion.descripcionOriginal;
    const seleccion = seleccionPorDescripcion.get(descripcionOriginal);
    if (seleccion === undefined) {
      return {
        ...linea,
        descripcion: { descripcionOriginal, clasificacion: { estado: 'REGLA_PENDIENTE' } },
      };
    }

    cantidades.set(descripcionOriginal, (cantidades.get(descripcionOriginal) ?? 0) + 1);
    return {
      ...linea,
      descripcion: {
        descripcionOriginal,
        clasificacion: {
          estado: 'CLASIFICADA',
          periodo: seleccion.periodo,
          tipoLiquidacionNormalizado: seleccion.tipoLiquidacionNormalizado,
        },
      },
    };
  });

  return {
    ok: true,
    value: {
      lineas: nuevasLineas,
      cantidadesAfectadas: selecciones.map((seleccion) => ({
        descripcionOriginal: seleccion.descripcionOriginal,
        cantidadLineas: cantidades.get(seleccion.descripcionOriginal) ?? 0,
      })),
    },
  };
}
