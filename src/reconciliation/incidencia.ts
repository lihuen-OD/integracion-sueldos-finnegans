// Construcción de incidencias de la conciliación. El detalle nunca incluye valores: los valores
// observados viajan aparte, en `valores`, para mostrarlos al operador.
import {
  DESCRIPCION_CODIGO,
  idIncidencia,
  type AlcanceIncidencia,
  type CodigoIncidencia,
  type Incidencia,
  type NivelIncidencia,
  type SourceRef,
  type ValoresObservados,
} from '../domain/incidencias';

export interface ExtraIncidencia {
  readonly campo?: string;
  readonly motivo?: string;
  readonly valores?: ValoresObservados;
}

export function nuevaIncidencia(
  codigo: CodigoIncidencia,
  nivel: NivelIncidencia,
  alcance: AlcanceIncidencia,
  refs: readonly SourceRef[],
  extra: ExtraIncidencia = {},
): Incidencia {
  return {
    id: idIncidencia(codigo, alcance, refs, extra.campo),
    codigo,
    nivel,
    alcance,
    refs,
    ...(extra.campo === undefined ? {} : { campo: extra.campo }),
    ...(extra.motivo === undefined ? {} : { motivo: extra.motivo }),
    ...(extra.valores === undefined ? {} : { valores: extra.valores }),
    detalle: DESCRIPCION_CODIGO[codigo],
  };
}
