// Mapper BNA puro (D-081, CP-F5-B). Sin I/O, `Date`, red, persistencia, React, ExcelJS,
// perfil ni conciliación. La geometría se toma de la spec canónica; el mapper produce
// `EntradaRegistro` para que F4 serialice. Toda decisión abierta pasa por `PoliticaBna`:
// no hay `02`/`96`, `0000`/`0003`, entidad/sucursal ni campos libres por default.
import type { Result } from '../../shared/result';
import type { EntradaRegistro } from '../fixed-width';
import type { PagoBna, ParametrosEnvioBna, PerfilBna } from './modelo';
import type {
  CamposBeneficiarioBna,
  DocumentoBna,
  EntidadSucursalBna,
  PoliticaBna,
  PuntoPoliticaBna,
  ResolucionBna,
} from './politica';
import { calcularTotalesBna, type ErrorTotalesBna, type TotalesBna } from './totales';
import {
  longitudCampoBna,
  validarConvenioBna,
  validarFechaCompensacionBna,
  validarMonedaBna,
  validarNumeroEnvioBna,
  validarTextoBna,
  type ErrorTextoBna,
} from './validacion';

export type CodigoErrorMapeoBna =
  | 'MONEDA_INVALIDA'
  | 'CONVENIO_NO_NUMERICO'
  | 'CONVENIO_LONGITUD_BNA5'
  | 'CONVENIO_LONGITUD_INVALIDA'
  | 'FECHA_COMPENSACION_INVALIDA'
  | 'NUMERO_ENVIO_INVALIDO'
  | 'REFERENCIA_INVALIDA'
  | 'POLITICA_SIN_RESOLUCION'
  | 'POLITICA_INVALIDA'
  | 'SIN_PAGOS'
  | 'NETO_NEGATIVO'
  | 'NETO_EXCEDE_LAYOUT'
  | 'TOTAL_EXCEDE_LAYOUT'
  | 'CANTIDAD_EXCEDE_LAYOUT'
  | 'CANTIDAD_INVALIDA'
  | 'ALFABETO_BNA8_INVALIDO'
  | 'LONGITUD_EXCEDIDA'
  | 'DIGITO_INVALIDO';

export interface ErrorMapeoBna {
  readonly codigo: CodigoErrorMapeoBna;
  readonly campoId?: string;
  readonly indicePago?: number;
  readonly punto?: PuntoPoliticaBna;
}

export interface ResultadoMapeoBna {
  readonly entradas: readonly EntradaRegistro[];
  readonly totales: TotalesBna;
}

function agregar(
  errores: ErrorMapeoBna[],
  codigo: CodigoErrorMapeoBna,
  ubicacion: { campoId?: string; indicePago?: number } = {},
): void {
  errores.push({
    codigo,
    ...(ubicacion.campoId === undefined ? {} : { campoId: ubicacion.campoId }),
    ...(ubicacion.indicePago === undefined ? {} : { indicePago: ubicacion.indicePago }),
  });
}

function agregarTotales(
  errores: ErrorMapeoBna[],
  erroresTotales: readonly ErrorTotalesBna[],
): void {
  for (const error of erroresTotales) {
    agregar(errores, error.codigo, {
      ...(error.indicePago === undefined ? {} : { indicePago: error.indicePago }),
    });
  }
}

function agregarTexto(
  errores: ErrorMapeoBna[],
  resultado: Result<string, ErrorTextoBna>,
  campoId: string,
  indicePago?: number,
): string | undefined {
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
  errores: ErrorMapeoBna[],
  resolucion: ResolucionBna<T>,
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

function codigoExacto(
  errores: ErrorMapeoBna[],
  valor: string,
  campoId: string,
  indicePago?: number,
): boolean {
  if (!/^[0-9]+$/.test(valor) || valor.length !== longitudCampoBna(campoId)) {
    agregar(errores, 'POLITICA_INVALIDA', {
      campoId,
      ...(indicePago === undefined ? {} : { indicePago }),
    });
    return false;
  }
  return true;
}

function validarDocumento(
  errores: ErrorMapeoBna[],
  documento: DocumentoBna,
  indicePago: number,
): boolean {
  const clase: string = documento.claseDocumento;
  if (clase !== '1' && clase !== '2') {
    agregar(errores, 'POLITICA_INVALIDA', {
      campoId: 'r2_claseDocumento',
      indicePago,
    });
    return false;
  }
  return codigoExacto(errores, documento.tipoDocumento, 'r2_tipoDocumento', indicePago);
}

function validarSucursalEmpresa(errores: ErrorMapeoBna[], sucursal: string): string | undefined {
  return codigoExacto(errores, sucursal, 'r1_sucursalEmpresa') ? sucursal : undefined;
}

function validarEntidadSucursal(
  errores: ErrorMapeoBna[],
  valor: EntidadSucursalBna,
  indicePago: number,
): EntidadSucursalBna | undefined {
  const entidad = codigoExacto(errores, valor.entidad, 'r2_entidad', indicePago)
    ? valor.entidad
    : undefined;
  const sucursal = codigoExacto(errores, valor.sucursal, 'r2_sucursal', indicePago)
    ? valor.sucursal
    : undefined;
  return entidad === undefined || sucursal === undefined ? undefined : { entidad, sucursal };
}

function validarCamposBeneficiario(
  errores: ErrorMapeoBna[],
  valor: CamposBeneficiarioBna,
  indicePago: number,
): CamposBeneficiarioBna | undefined {
  const identificacion = agregarTexto(
    errores,
    validarTextoBna(valor.identificacionBeneficiario, 'r2_identificacionBeneficiario'),
    'r2_identificacionBeneficiario',
    indicePago,
  );
  const datos = agregarTexto(
    errores,
    validarTextoBna(valor.datosEmpresa, 'r2_datosEmpresa'),
    'r2_datosEmpresa',
    indicePago,
  );
  if (identificacion === undefined || datos === undefined) {
    return undefined;
  }
  return { identificacionBeneficiario: identificacion, datosEmpresa: datos };
}

/**
 * Mapea un perfil, parámetros y pagos a la secuencia R1 + R2* + R3. No serializa bytes:
 * devuelve entradas F4 y totales calculados sobre exactamente la misma lista.
 */
export function mapearBna(
  perfil: PerfilBna,
  parametros: ParametrosEnvioBna,
  pagos: readonly PagoBna[],
  politica: PoliticaBna,
): Result<ResultadoMapeoBna, readonly ErrorMapeoBna[]> {
  const errores: ErrorMapeoBna[] = [];

  const moneda = validarMonedaBna(perfil.moneda);
  if (!moneda.ok) {
    agregar(errores, moneda.error);
  }
  const convenio = validarConvenioBna(perfil.codigoConvenio);
  if (!convenio.ok) {
    agregar(errores, convenio.error, { campoId: 'r1_codigoConvenio' });
  }
  const fecha = validarFechaCompensacionBna(parametros.fechaCompensacion);
  if (!fecha.ok) {
    agregar(errores, fecha.error, { campoId: 'r1_fechaCompensacion' });
  }
  const numeroEnvio = validarNumeroEnvioBna(parametros.numeroEnvio);
  if (!numeroEnvio.ok) {
    agregar(errores, numeroEnvio.error, { campoId: 'r1_numeroEnvio' });
  }
  const referenciaValidada = validarTextoBna(parametros.referenciaUnivoca, 'r2_referencia');
  let referencia: string | undefined;
  if (referenciaValidada.ok && referenciaValidada.value !== '') {
    referencia = referenciaValidada.value;
  } else if (referenciaValidada.ok) {
    agregar(errores, 'REFERENCIA_INVALIDA', { campoId: 'r2_referencia' });
  } else {
    referencia = agregarTexto(errores, referenciaValidada, 'r2_referencia');
  }

  const totales = calcularTotalesBna(pagos);
  if (!totales.ok) {
    agregarTotales(errores, totales.error);
  }

  if (
    errores.length > 0 ||
    !moneda.ok ||
    !convenio.ok ||
    !fecha.ok ||
    !numeroEnvio.ok ||
    referencia === undefined ||
    !totales.ok
  ) {
    return { ok: false, error: errores };
  }

  const sucursalResuelta = resolver(
    errores,
    politica.sucursalEmpresa(perfil),
    'r1_sucursalEmpresa',
  );
  const sucursalEmpresa =
    sucursalResuelta === undefined ? undefined : validarSucursalEmpresa(errores, sucursalResuelta);

  const infoResuelta = resolver(
    errores,
    politica.infoCriterio(perfil, parametros),
    'r1_infoCriterioEmpresa',
  );
  const infoCriterio =
    infoResuelta === undefined
      ? undefined
      : agregarTexto(
          errores,
          validarTextoBna(infoResuelta, 'r1_infoCriterioEmpresa'),
          'r1_infoCriterioEmpresa',
        );

  const entradasR2: EntradaRegistro[] = [];
  pagos.forEach((pago, indicePago) => {
    const documentoResuelto = resolver(
      errores,
      politica.documento(pago),
      'r2_tipoDocumento',
      indicePago,
    );
    const documento =
      documentoResuelto !== undefined && validarDocumento(errores, documentoResuelto, indicePago)
        ? documentoResuelto
        : undefined;

    const cbuResuelto = resolver(errores, politica.cbuCuenta(pago), 'r2_bloque2Cuenta', indicePago);

    const entidadResuelta = resolver(
      errores,
      politica.entidadSucursal(perfil, pago),
      'r2_entidad',
      indicePago,
    );
    const entidadSucursal =
      entidadResuelta === undefined
        ? undefined
        : validarEntidadSucursal(errores, entidadResuelta, indicePago);

    const prestamoResuelto = resolver(
      errores,
      politica.identificadorPrestamo(pago),
      'r2_identificadorPrestamo',
      indicePago,
    );
    const prestamo =
      prestamoResuelto !== undefined &&
      codigoExacto(errores, prestamoResuelto, 'r2_identificadorPrestamo', indicePago)
        ? prestamoResuelto
        : undefined;

    const beneficiarioResuelto = resolver(
      errores,
      politica.camposBeneficiario(pago, parametros),
      'r2_identificacionBeneficiario',
      indicePago,
    );
    const beneficiario =
      beneficiarioResuelto === undefined
        ? undefined
        : validarCamposBeneficiario(errores, beneficiarioResuelto, indicePago);

    if (
      documento === undefined ||
      cbuResuelto === undefined ||
      entidadSucursal === undefined ||
      prestamo === undefined ||
      beneficiario === undefined
    ) {
      return;
    }

    const cbu = String(cbuResuelto);
    entradasR2.push({
      recordId: 'BNA_R2',
      valores: {
        r2_entidad: entidadSucursal.entidad,
        r2_sucursal: entidadSucursal.sucursal,
        r2_dvBloque1: cbu.slice(7, 8),
        r2_bloque2Cuenta: cbu.slice(8, 22),
        r2_importe: String(pago.neto),
        r2_referencia: referencia,
        r2_identificacionBeneficiario: beneficiario.identificacionBeneficiario,
        r2_claseDocumento: documento.claseDocumento,
        r2_tipoDocumento: documento.tipoDocumento,
        r2_numeroDocumento: String(pago.cuil),
        r2_datosEmpresa: beneficiario.datosEmpresa,
        r2_identificadorPrestamo: prestamo,
      },
    });
  });

  if (errores.length > 0 || sucursalEmpresa === undefined || infoCriterio === undefined) {
    return { ok: false, error: errores };
  }

  const cbuEmpresa = String(perfil.cbuEmpresa);
  const entradas: EntradaRegistro[] = [
    {
      recordId: 'BNA_R1',
      valores: {
        r1_identificacionEmpresa: String(perfil.cuitEmpresa),
        r1_sucursalEmpresa: sucursalEmpresa,
        r1_bloque2CbuEmpresa: cbuEmpresa.slice(8, 22),
        r1_moneda: moneda.value,
        r1_fechaCompensacion: fecha.value,
        r1_infoCriterioEmpresa: infoCriterio,
        r1_codigoConvenio: convenio.value,
        r1_numeroEnvio: numeroEnvio.value,
      },
    },
    ...entradasR2,
    {
      recordId: 'BNA_R3',
      valores: {
        r3_totalImporte: String(totales.value.totalImporte),
        r3_totalCantidad: String(totales.value.cantidad),
      },
    },
  ];
  return { ok: true, value: { entradas, totales: totales.value } };
}
