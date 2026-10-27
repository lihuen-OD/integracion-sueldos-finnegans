// Mapper Patagonia B.2 puro (CP-F6-B). Sin I/O, `Date`, red, persistencia, React, ExcelJS,
// perfil, conciliación ni BNA. La geometría sale de la spec; el mapper devuelve
// `EntradaRegistro[]` para que F4 serialice, pero no serializa bytes.
// Toda decisión abierta pasa por `PoliticaPatagonia`: no hay provincia por default,
// nombre compuesto, loteo, versión, comprobante ni tipo de liquidación inventados.
import { TIPO_DOCUMENTO_CON_PROVINCIA } from '../../domain/maestro';
import type { Result } from '../../shared/result';
import type { EntradaRegistro } from '../fixed-width';
import {
  ID_CAMPO_PAT_CODIGO_BANCO,
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_VERSION_LOTE,
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
} from './contrato';
import {
  validarLotesPatagonia,
  type ErrorLoteoPatagonia,
  type LotePropuestoPatagonia,
} from './loteo';
import type { PagoPatagonia, ParametrosEnvioPatagonia, PerfilPatagonia } from './modelo';
import type { NombrePatagonia } from './nombre';
import type { PoliticaPatagonia, PuntoPoliticaPatagonia, ResolucionPatagonia } from './politica';
import {
  calcularTotalesPatagonia,
  type CodigoErrorTotalesPatagonia,
  type ErrorTotalesPatagonia,
  type TotalesPatagonia,
} from './totales';
import {
  validarCodigoBancoPatagonia,
  validarCodigoSucursalPatagonia,
  validarComprobantePatagonia,
  validarConceptoPatagonia,
  validarDependenciaPatagonia,
  validarFechaPatagonia,
  validarNombrePatagonia,
  validarNumeroCuentaPatagonia,
  validarNumeroDocumentoPatagonia,
  validarNumeroEmpresaPatagonia,
  validarNumeroEnvioPatagonia,
  validarProvinciaDocumentoPatagonia,
  validarProvinciaNoAplicaPatagonia,
  validarTipoCuentaPatagonia,
  validarTipoDocumentoPatagonia,
  validarTipoLiquidacionPatagonia,
  validarVersionPatagonia,
  type ErrorComprobantePatagonia,
  type ErrorDependenciaPatagonia,
  type ErrorDigitosPatagonia,
  type ErrorFechaPatagonia,
  type ErrorNombrePatagonia,
  type ErrorNumeroEmpresaPatagonia,
  type ErrorNumeroEnvioPatagonia,
  type ErrorProvinciaPatagonia,
  type ErrorTextoPatagonia,
  type ErrorTipoCuentaPatagonia,
  type ErrorTipoDocumentoPatagonia,
  type ErrorTipoLiquidacionPatagonia,
  type ErrorVersionPatagonia,
} from './validacion';

export type CodigoErrorMapeoPatagonia =
  | ErrorNumeroEmpresaPatagonia
  | ErrorFechaPatagonia
  | ErrorNumeroEnvioPatagonia
  | ErrorTextoPatagonia
  | ErrorDigitosPatagonia
  | ErrorTipoCuentaPatagonia
  | ErrorTipoDocumentoPatagonia
  | ErrorProvinciaPatagonia
  | ErrorDependenciaPatagonia
  | ErrorNombrePatagonia
  | ErrorTipoLiquidacionPatagonia
  | ErrorComprobantePatagonia
  | ErrorVersionPatagonia
  | CodigoErrorTotalesPatagonia
  | 'POLITICA_SIN_RESOLUCION'
  | 'POLITICA_INVALIDA'
  | 'PROVINCIA_NO_CORRESPONDE';

export interface ErrorMapeoPatagonia {
  readonly codigo: CodigoErrorMapeoPatagonia;
  readonly campoId?: string;
  readonly indicePago?: number;
  readonly indiceLote?: number;
  readonly punto?: PuntoPoliticaPatagonia;
}

export interface ResultadoMapeoPatagonia {
  readonly entradas: readonly EntradaRegistro[];
  readonly totales: TotalesPatagonia;
}

interface Ubicacion {
  readonly campoId?: string;
  readonly indicePago?: number;
  readonly indiceLote?: number;
}

function agregar(
  errores: ErrorMapeoPatagonia[],
  codigo: CodigoErrorMapeoPatagonia,
  ubicacion: Ubicacion = {},
): void {
  errores.push({
    codigo,
    ...(ubicacion.campoId === undefined ? {} : { campoId: ubicacion.campoId }),
    ...(ubicacion.indicePago === undefined ? {} : { indicePago: ubicacion.indicePago }),
    ...(ubicacion.indiceLote === undefined ? {} : { indiceLote: ubicacion.indiceLote }),
  });
}

function validar<T, E extends CodigoErrorMapeoPatagonia>(
  errores: ErrorMapeoPatagonia[],
  resultado: Result<T, E>,
  campoId: string,
  indicePago?: number,
): T | undefined {
  if (resultado.ok) {
    return resultado.value;
  }
  agregar(errores, resultado.error, {
    campoId,
    ...(indicePago === undefined ? {} : { indicePago }),
  });
  return undefined;
}

function resolver<T>(
  errores: ErrorMapeoPatagonia[],
  resolucion: ResolucionPatagonia<T>,
  campoId: string,
  indicePago?: number,
): T | undefined {
  if (resolucion.estado === 'RESUELTO') {
    return resolucion.valor;
  }
  errores.push({
    codigo: 'POLITICA_SIN_RESOLUCION',
    punto: resolucion.punto,
    campoId,
    ...(indicePago === undefined ? {} : { indicePago }),
  });
  return undefined;
}

function agregarTotales(
  errores: ErrorMapeoPatagonia[],
  erroresTotales: readonly ErrorTotalesPatagonia[],
): void {
  for (const error of erroresTotales) {
    agregar(errores, error.codigo, {
      ...(error.indicePago === undefined ? {} : { indicePago: error.indicePago }),
      ...(error.indiceLote === undefined ? {} : { indiceLote: error.indiceLote }),
    });
  }
}

function agregarLoteo(
  errores: ErrorMapeoPatagonia[],
  erroresLoteo: readonly ErrorLoteoPatagonia[],
): void {
  for (const error of erroresLoteo) {
    agregar(errores, error.codigo, {
      ...(error.indiceLote === undefined ? {} : { indiceLote: error.indiceLote }),
      ...(error.numeroLote === undefined ? {} : { campoId: 'r1_numeroLote' }),
    });
  }
}

function validarPagoBasico(
  pago: PagoPatagonia,
  indicePago: number,
  parametros: ParametrosEnvioPatagonia,
  errores: ErrorMapeoPatagonia[],
): void {
  validar(errores, validarTipoCuentaPatagonia(pago.tipoCuenta), 'r2_tipoCuenta', indicePago);
  validar(errores, validarNumeroCuentaPatagonia(pago.numeroCuenta), 'r2_numeroCuenta', indicePago);
  validar(
    errores,
    validarCodigoBancoPatagonia(pago.codigoBanco),
    ID_CAMPO_PAT_CODIGO_BANCO,
    indicePago,
  );
  validar(
    errores,
    validarCodigoSucursalPatagonia(pago.codigoSucursal),
    'r2_codigoSucursal',
    indicePago,
  );
  validar(
    errores,
    validarTipoDocumentoPatagonia(pago.tipoDocumento),
    'r2_tipoDocumento',
    indicePago,
  );
  validar(
    errores,
    validarNumeroDocumentoPatagonia(pago.numeroDocumento),
    'r2_numeroDocumento',
    indicePago,
  );
  validar(
    errores,
    validarDependenciaPatagonia(pago.codigoDependencia, parametros.hipotesisDependenciaPat2),
    ID_CAMPO_PAT_DEPENDENCIA,
    indicePago,
  );

  if (pago.tipoDocumento === TIPO_DOCUMENTO_CON_PROVINCIA) {
    if (pago.provinciaDocumento === null) {
      agregar(errores, 'PROVINCIA_INVALIDA', {
        campoId: 'r2_provinciaDocumento',
        indicePago,
      });
    } else {
      validar(
        errores,
        validarProvinciaDocumentoPatagonia(pago.provinciaDocumento),
        'r2_provinciaDocumento',
        indicePago,
      );
    }
  } else if (pago.provinciaDocumento !== null) {
    agregar(errores, 'PROVINCIA_NO_CORRESPONDE', {
      campoId: 'r2_provinciaDocumento',
      indicePago,
    });
  }
}

interface DetalleResuelto {
  readonly tipoLiquidacion: string;
  readonly nombre: NombrePatagonia;
  readonly comprobante: string;
  readonly provincia: string;
}

function comprobanteDe(
  pago: PagoPatagonia,
  indicePago: number,
  politica: PoliticaPatagonia,
  errores: ErrorMapeoPatagonia[],
): string | undefined {
  if (pago.legajo !== null && /^[0-9]{1,7}$/.test(pago.legajo)) {
    return validar(
      errores,
      validarComprobantePatagonia(pago.legajo),
      'r2_numeroComprobante',
      indicePago,
    );
  }
  const resuelto = resolver(
    errores,
    politica.comprobanteNoInformado(pago),
    'r2_numeroComprobante',
    indicePago,
  );
  if (resuelto === undefined) {
    return undefined;
  }
  return validar(
    errores,
    validarComprobantePatagonia(resuelto),
    'r2_numeroComprobante',
    indicePago,
  );
}

function provinciaDe(
  pago: PagoPatagonia,
  indicePago: number,
  politica: PoliticaPatagonia,
  errores: ErrorMapeoPatagonia[],
): string | undefined {
  if (pago.tipoDocumento === TIPO_DOCUMENTO_CON_PROVINCIA) {
    return pago.provinciaDocumento ?? undefined;
  }
  const resuelto = resolver(
    errores,
    politica.provinciaNoAplica(pago),
    'r2_provinciaDocumento',
    indicePago,
  );
  if (resuelto === undefined) {
    return undefined;
  }
  return validar(
    errores,
    validarProvinciaNoAplicaPatagonia(resuelto),
    'r2_provinciaDocumento',
    indicePago,
  );
}

function resolverDetalle(
  pago: PagoPatagonia,
  indicePago: number,
  politica: PoliticaPatagonia,
  errores: ErrorMapeoPatagonia[],
): DetalleResuelto | undefined {
  const tipoResuelto = resolver(
    errores,
    politica.tipoLiquidacion(pago),
    'r2_tipoLiquidacion',
    indicePago,
  );
  const tipoLiquidacion =
    tipoResuelto === undefined
      ? undefined
      : validar(
          errores,
          validarTipoLiquidacionPatagonia(tipoResuelto),
          'r2_tipoLiquidacion',
          indicePago,
        );

  const nombreResuelto = resolver(errores, politica.nombre(pago), 'r2_apellidoNombre', indicePago);
  const nombreGenerado =
    nombreResuelto === undefined
      ? undefined
      : validar(
          errores,
          validarNombrePatagonia(nombreResuelto.generado),
          'r2_apellidoNombre',
          indicePago,
        );
  const nombre =
    nombreResuelto === undefined || nombreGenerado === undefined
      ? undefined
      : { ...nombreResuelto, generado: nombreGenerado };

  const comprobante = comprobanteDe(pago, indicePago, politica, errores);
  const provincia = provinciaDe(pago, indicePago, politica, errores);

  if (
    tipoLiquidacion === undefined ||
    nombre === undefined ||
    comprobante === undefined ||
    provincia === undefined
  ) {
    return undefined;
  }
  return { tipoLiquidacion, nombre, comprobante, provincia };
}

/**
 * Mapea perfil, parámetros y pagos a la secuencia R0 + (R1 + R2*)+. No serializa bytes:
 * devuelve entradas F4 y totales calculados sobre exactamente los mismos pagos y lotes.
 */
export function mapearPatagonia(
  perfil: PerfilPatagonia,
  parametros: ParametrosEnvioPatagonia,
  pagos: readonly PagoPatagonia[],
  politica: PoliticaPatagonia,
): Result<ResultadoMapeoPatagonia, readonly ErrorMapeoPatagonia[]> {
  const errores: ErrorMapeoPatagonia[] = [];

  const numeroEmpresa = validar(
    errores,
    validarNumeroEmpresaPatagonia(perfil.numeroEmpresa),
    'r0_numeroEmpresa',
  );
  const fechaPresentacion = validar(
    errores,
    validarFechaPatagonia(parametros.fechaPresentacion),
    'r0_fechaPresentacion',
  );
  const fechaAcreditacion = validar(
    errores,
    validarFechaPatagonia(parametros.fechaAcreditacion),
    'r1_fechaAcreditacion',
  );
  const numeroEnvio = validar(
    errores,
    validarNumeroEnvioPatagonia(parametros.numeroEnvio),
    'r0_numeroEnvio',
  );
  const concepto = validar(errores, validarConceptoPatagonia(parametros.concepto), 'r1_concepto');

  if (pagos.length === 0) {
    agregar(errores, 'SIN_PAGOS');
  }
  pagos.forEach((pago, indicePago) => {
    validarPagoBasico(pago, indicePago, parametros, errores);
  });

  if (
    errores.length > 0 ||
    numeroEmpresa === undefined ||
    fechaPresentacion === undefined ||
    fechaAcreditacion === undefined ||
    numeroEnvio === undefined ||
    concepto === undefined
  ) {
    return { ok: false, error: errores };
  }

  const lotesResueltos = resolver(errores, politica.loteo(pagos), 'r1_numeroLote');
  if (lotesResueltos === undefined) {
    return { ok: false, error: errores };
  }
  if (!Array.isArray(lotesResueltos)) {
    agregar(errores, 'POLITICA_INVALIDA', { campoId: 'r1_numeroLote' });
    return { ok: false, error: errores };
  }
  const lotes: readonly LotePropuestoPatagonia[] = lotesResueltos;
  const validacionLotes = validarLotesPatagonia(lotes, pagos);
  if (!validacionLotes.ok) {
    agregarLoteo(errores, validacionLotes.error);
    return { ok: false, error: errores };
  }

  const totales = calcularTotalesPatagonia(pagos, lotes);
  if (!totales.ok) {
    agregarTotales(errores, totales.error);
    return { ok: false, error: errores };
  }

  const versionResuelta = resolver(
    errores,
    politica.versionLote(perfil, parametros),
    ID_CAMPO_PAT_VERSION_LOTE,
  );
  const version =
    versionResuelta === undefined
      ? undefined
      : validar(errores, validarVersionPatagonia(versionResuelta), ID_CAMPO_PAT_VERSION_LOTE);

  const detalles: readonly (DetalleResuelto | undefined)[] = pagos.map((pago, indicePago) =>
    resolverDetalle(pago, indicePago, politica, errores),
  );

  if (errores.length > 0 || version === undefined) {
    return { ok: false, error: errores };
  }

  const entradas: EntradaRegistro[] = [
    {
      recordId: ID_REGISTRO_PAT_0,
      valores: {
        r0_numeroEmpresa: numeroEmpresa,
        r0_fechaPresentacion: fechaPresentacion,
        r0_numeroEnvio: numeroEnvio,
        r0_cantidadLotes: String(totales.value.cantidadLotes),
        r0_importeLotes: String(totales.value.totalImporte),
        r0_numeroEmpresaFinal: numeroEmpresa,
      },
    },
  ];

  let indicePagoGlobal = 0;
  lotes.forEach((lote, indiceLote) => {
    entradas.push({
      recordId: ID_REGISTRO_PAT_1,
      valores: {
        r1_numeroLote: lote.numeroLote,
        r1_concepto: concepto,
        r1_cantidadLote: String(lote.pagos.length),
        r1_importeLote: String(totales.value.importesPorLote[indiceLote]),
        r1_fechaAcreditacion: fechaAcreditacion,
        r1_numeroEnvio: numeroEnvio,
        r1_version: version,
        r1_numeroEmpresa: numeroEmpresa,
      },
    });
    for (const pago of lote.pagos) {
      const detalle = detalles[indicePagoGlobal];
      indicePagoGlobal += 1;
      if (detalle === undefined) {
        // La cobertura ya fue validada; esta guarda evita emitir un registro incompleto.
        agregar(errores, 'POLITICA_INVALIDA', {
          campoId: 'r2_numeroLote',
          indiceLote,
        });
        continue;
      }
      entradas.push({
        recordId: ID_REGISTRO_PAT_2,
        valores: {
          r2_numeroLote: lote.numeroLote,
          r2_tipoCuenta: pago.tipoCuenta,
          r2_numeroCuenta: pago.numeroCuenta,
          r2_importeNeto: String(pago.neto),
          r2_numeroComprobante: detalle.comprobante,
          r2_apellidoNombre: detalle.nombre.generado,
          r2_codigoBanco: pago.codigoBanco,
          r2_codigoSucursal: pago.codigoSucursal,
          r2_tipoDocumento: pago.tipoDocumento,
          r2_numeroDocumento: pago.numeroDocumento,
          r2_provinciaDocumento: detalle.provincia,
          r2_codigoDependencia: pago.codigoDependencia,
          r2_tipoLiquidacion: detalle.tipoLiquidacion,
          r2_numeroEmpresa: numeroEmpresa,
        },
      });
    }
  });

  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      entradas,
      totales: totales.value,
    },
  };
}
