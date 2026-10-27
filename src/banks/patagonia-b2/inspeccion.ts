// Inspector Patagonia B.2 independiente (CP-F6-C). Primero usa la API pública F4 para
// validar estructura, longitudes, separadores, BOM, discriminadores y bytes. Luego
// reconstruye cantidades e importes exclusivamente desde los valores RAW del archivo.
// No recibe pagos, perfil, conciliación, política, totales de generación ni mapper.
// Verifica coherencia técnica observable, no homologación bancaria: una
// INTERPRETACION_PENDIENTE no se convierte en error por estar pendiente.
import type { Centavos } from '../../domain/money';
import type { Result } from '../../shared/result';
import { inspeccionarArchivo, type ErrorParseoArchivo, type RegistroArchivo } from '../fixed-width';
import { ID_REGISTRO_PAT_0, ID_REGISTRO_PAT_1, ID_REGISTRO_PAT_2 } from './contrato';
import { crearSpecPatagoniaB2, type ConfiguracionTecnicaPatagonia } from './spec';
import {
  validarImporteLotePatagonia,
  validarImporteNetoPatagonia,
  validarTotalPatagonia,
} from './totales';

export type CodigoErrorInspeccionPatagonia =
  | 'ARCHIVO_PATAGONIA_INVALIDO'
  | 'CANTIDAD_LOTES_DISTINTA'
  | 'CANTIDAD_DETALLE_DISTINTA'
  | 'CANTIDAD_PAGOS_DISTINTA'
  | 'IMPORTE_TOTAL_DISTINTO'
  | 'IMPORTE_LOTE_DISTINTO'
  | 'IMPORTE_DETALLE_FUERA_DE_LAYOUT'
  | 'IMPORTE_LOTE_FUERA_DE_LAYOUT'
  | 'IMPORTE_TOTAL_FUERA_DE_LAYOUT'
  | 'NUMERO_LOTE_INCONSISTENTE'
  | 'NUMERO_LOTE_REPETIDO'
  | 'EMPRESA_INCONSISTENTE'
  | 'NUMERO_ENVIO_INCONSISTENTE';

export interface ErrorInspeccionPatagonia {
  readonly codigo: CodigoErrorInspeccionPatagonia;
  readonly linea?: number;
  readonly campoId?: string;
  readonly numeroLote?: string;
  readonly erroresTecnicos?: readonly ErrorParseoArchivo[];
}

export interface LoteInspeccionadoPatagonia {
  readonly numeroLote: string;
  readonly cantidadDeclarada: number;
  readonly cantidadCalculada: number;
  readonly importeDeclarado: Centavos;
  readonly importeCalculado: Centavos;
}

export interface InspeccionPatagonia {
  readonly registros: readonly RegistroArchivo[];
  readonly cantidadLotesDeclarada: number;
  readonly cantidadLotesCalculada: number;
  readonly cantidadPagosDeclarada: number;
  readonly cantidadPagosCalculada: number;
  readonly totalDeclarado: Centavos;
  readonly totalCalculado: Centavos;
  readonly lotes: readonly LoteInspeccionadoPatagonia[];
}

interface LoteBytes {
  readonly r1: RegistroArchivo;
  readonly r2: RegistroArchivo[];
}

function valor(registro: RegistroArchivo, campoId: string): string {
  const texto = registro.valores[campoId];
  if (texto === undefined) {
    // El parser F4 de archivo entrega todos los campos de la spec.
    throw new Error(`campo Patagonia ausente en registro parseado: ${campoId}`);
  }
  return texto;
}

function requerido(registro: RegistroArchivo | undefined): RegistroArchivo {
  if (registro === undefined) {
    // El parser F4 ya garantiza el R0 inicial y al menos un R1/R2.
    throw new Error('registro Patagonia ausente en archivo parseado');
  }
  return registro;
}

function error(
  codigo: CodigoErrorInspeccionPatagonia,
  registro?: RegistroArchivo,
  campoId?: string,
  numeroLote?: string,
): ErrorInspeccionPatagonia {
  return {
    codigo,
    ...(registro === undefined ? {} : { linea: registro.linea }),
    ...(campoId === undefined ? {} : { campoId }),
    ...(numeroLote === undefined ? {} : { numeroLote }),
  };
}

function agruparLotes(registros: readonly RegistroArchivo[]): readonly LoteBytes[] {
  const lotes: { r1: RegistroArchivo; r2: RegistroArchivo[] }[] = [];
  for (const registro of registros) {
    if (registro.registroId === ID_REGISTRO_PAT_1) {
      lotes.push({ r1: registro, r2: [] });
    } else if (registro.registroId === ID_REGISTRO_PAT_2) {
      const actual = lotes[lotes.length - 1] as { r1: RegistroArchivo; r2: RegistroArchivo[] };
      actual.r2.push(registro);
    }
  }
  return lotes;
}

function importe(registro: RegistroArchivo, campoId: string): Centavos {
  return BigInt(valor(registro, campoId)) as Centavos;
}

/** Verifica invariantes Patagonia sobre bytes, sin usar los objetos que los generaron. */
export function inspeccionarPatagonia(
  bytes: Uint8Array,
  configuracion: ConfiguracionTecnicaPatagonia,
): Result<InspeccionPatagonia, readonly ErrorInspeccionPatagonia[]> {
  const spec = crearSpecPatagoniaB2(configuracion);
  const parseado = inspeccionarArchivo(spec, bytes);
  if (!parseado.ok) {
    return {
      ok: false,
      error: [{ codigo: 'ARCHIVO_PATAGONIA_INVALIDO', erroresTecnicos: parseado.error }],
    };
  }

  const registros = parseado.value.registros;
  const r0 = requerido(registros.find((registro) => registro.registroId === ID_REGISTRO_PAT_0));
  const lotesBytes = agruparLotes(registros);
  const errores: ErrorInspeccionPatagonia[] = [];
  const empresa = valor(r0, 'r0_numeroEmpresa');
  const envio = valor(r0, 'r0_numeroEnvio');

  if (valor(r0, 'r0_numeroEmpresaFinal') !== empresa) {
    errores.push(error('EMPRESA_INCONSISTENTE', r0, 'r0_numeroEmpresaFinal'));
  }

  const cantidadLotesDeclarada = Number(valor(r0, 'r0_cantidadLotes'));
  if (cantidadLotesDeclarada !== lotesBytes.length) {
    errores.push(error('CANTIDAD_LOTES_DISTINTA', r0, 'r0_cantidadLotes'));
  }

  let cantidadPagosDeclarada = 0;
  let totalLotesDeclarado = 0n;
  let totalCalculado = 0n;
  const numerosLote = new Set<string>();
  const lotes: LoteInspeccionadoPatagonia[] = [];

  for (const lote of lotesBytes) {
    const numeroLote = valor(lote.r1, 'r1_numeroLote');
    if (numerosLote.has(numeroLote)) {
      errores.push(error('NUMERO_LOTE_REPETIDO', lote.r1, 'r1_numeroLote', numeroLote));
    } else {
      numerosLote.add(numeroLote);
    }

    const cantidadDeclarada = Number(valor(lote.r1, 'r1_cantidadLote'));
    const importeDeclarado = importe(lote.r1, 'r1_importeLote');
    let importeCalculado = 0n;

    for (const detalle of lote.r2) {
      if (valor(detalle, 'r2_numeroLote') !== numeroLote) {
        errores.push(error('NUMERO_LOTE_INCONSISTENTE', detalle, 'r2_numeroLote', numeroLote));
      }
      if (valor(detalle, 'r2_numeroEmpresa') !== empresa) {
        errores.push(error('EMPRESA_INCONSISTENTE', detalle, 'r2_numeroEmpresa'));
      }
      const importeDetalle = importe(detalle, 'r2_importeNeto');
      importeCalculado += importeDetalle;
      if (!validarImporteNetoPatagonia(importeDetalle).ok) {
        errores.push(error('IMPORTE_DETALLE_FUERA_DE_LAYOUT', detalle, 'r2_importeNeto'));
      }
    }

    if (valor(lote.r1, 'r1_numeroEmpresa') !== empresa) {
      errores.push(error('EMPRESA_INCONSISTENTE', lote.r1, 'r1_numeroEmpresa'));
    }
    if (valor(lote.r1, 'r1_numeroEnvio') !== envio) {
      errores.push(error('NUMERO_ENVIO_INCONSISTENTE', lote.r1, 'r1_numeroEnvio'));
    }
    if (cantidadDeclarada !== lote.r2.length) {
      errores.push(error('CANTIDAD_DETALLE_DISTINTA', lote.r1, 'r1_cantidadLote', numeroLote));
    }
    const importeCalculadoCentavos = importeCalculado as Centavos;
    if (importeDeclarado !== importeCalculadoCentavos) {
      errores.push(error('IMPORTE_LOTE_DISTINTO', lote.r1, 'r1_importeLote', numeroLote));
    }
    if (
      !validarImporteLotePatagonia(importeDeclarado).ok ||
      !validarImporteLotePatagonia(importeCalculadoCentavos).ok
    ) {
      errores.push(error('IMPORTE_LOTE_FUERA_DE_LAYOUT', lote.r1, 'r1_importeLote', numeroLote));
    }

    cantidadPagosDeclarada += cantidadDeclarada;
    totalLotesDeclarado += importeDeclarado;
    totalCalculado += importeCalculado;
    lotes.push({
      numeroLote,
      cantidadDeclarada,
      cantidadCalculada: lote.r2.length,
      importeDeclarado,
      importeCalculado: importeCalculadoCentavos,
    });
  }

  const cantidadPagosCalculada = registros.filter(
    (registro) => registro.registroId === ID_REGISTRO_PAT_2,
  ).length;
  const totalDeclarado = importe(r0, 'r0_importeLotes');
  const totalCalculadoCentavos = totalCalculado as Centavos;
  if (cantidadPagosDeclarada !== cantidadPagosCalculada) {
    errores.push(error('CANTIDAD_PAGOS_DISTINTA', r0, 'r0_cantidadLotes'));
  }
  if (totalDeclarado !== totalLotesDeclarado || totalDeclarado !== totalCalculadoCentavos) {
    errores.push(error('IMPORTE_TOTAL_DISTINTO', r0, 'r0_importeLotes'));
  }
  if (
    !validarTotalPatagonia(totalDeclarado).ok ||
    !validarTotalPatagonia(totalCalculadoCentavos).ok
  ) {
    errores.push(error('IMPORTE_TOTAL_FUERA_DE_LAYOUT', r0, 'r0_importeLotes'));
  }

  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      registros,
      cantidadLotesDeclarada,
      cantidadLotesCalculada: lotesBytes.length,
      cantidadPagosDeclarada,
      cantidadPagosCalculada,
      totalDeclarado,
      totalCalculado: totalCalculadoCentavos,
      lotes,
    },
  };
}
