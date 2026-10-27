// Validaciones puras Patagonia B.2 (CP-F6-B). No resuelven preguntas abiertas: solo
// aplican formas técnicas documentadas. La fecha se valida como AAAAMMDD, sin `Date` ni
// calendario. No se transforma ningún valor: mayúsculas, acentos y relleno pertenecen a
// las capas que los deciden explícitamente.
import {
  ANEXO_I_TIPOS_DOCUMENTO,
  ANEXO_II_PROVINCIAS,
  type CodigoProvincia,
  type TipoCuentaPatagonia,
  type TipoDocumentoPatagonia,
} from '../../domain/maestro';
import type { Result } from '../../shared/result';
import { crearRegistrosPatagonia, type HipotesisDependenciaPat2 } from './spec';

export type ErrorNumeroEmpresaPatagonia = 'NUMERO_EMPRESA_INVALIDO';
export type ErrorFechaPatagonia = 'FECHA_INVALIDA';
export type ErrorNumeroEnvioPatagonia = 'NUMERO_ENVIO_INVALIDO' | 'NUMERO_ENVIO_PROHIBIDO';
export type ErrorTextoPatagonia = 'TEXTO_VACIO' | 'CARACTER_NO_ASCII' | 'LONGITUD_EXCEDIDA';
export type ErrorDigitosPatagonia = 'DIGITO_INVALIDO' | 'LONGITUD_INVALIDA';
export type ErrorTipoCuentaPatagonia = 'TIPO_CUENTA_INVALIDO';
export type ErrorTipoDocumentoPatagonia = 'TIPO_DOCUMENTO_INVALIDO';
export type ErrorProvinciaPatagonia = 'PROVINCIA_INVALIDA';
export type ErrorDependenciaPatagonia = 'DEPENDENCIA_INVALIDA';
export type ErrorNombrePatagonia =
  'NOMBRE_VACIO' | 'NOMBRE_CARACTER_NO_RESPALDADO' | 'NOMBRE_LONGITUD_EXCEDIDA';
export type ErrorTipoLiquidacionPatagonia = 'TIPO_LIQUIDACION_INVALIDO';
export type ErrorComprobantePatagonia = 'COMPROBANTE_INVALIDO';
export type ErrorVersionPatagonia = 'VERSION_INVALIDA';

/**
 * Geometría leída de la spec. Las hipótesis elegidas acá solo permiten recorrer los
 * campos para conocer longitudes; no son decisiones de serialización ni se exponen como
 * defaults del mapper.
 */
const CAMPOS_PATAGONIA = crearRegistrosPatagonia({
  hipotesisRellenoPat1: 'ESPACIOS',
  hipotesisDependenciaPat2: 'NUMERICA',
}).flatMap((registro) => registro.fields);

/** Longitud declarada por la spec canónica. No se duplican posiciones ni longitudes. */
export function longitudCampoPatagonia(campoId: string): number {
  const campo = CAMPOS_PATAGONIA.find((candidato) => candidato.id === campoId);
  if (campo === undefined) {
    throw new Error(`campo Patagonia inexistente: ${campoId}`);
  }
  return campo.declaredLength;
}

function validarDigitos(
  texto: string,
  minimo: number,
  maximo: number,
): Result<string, ErrorDigitosPatagonia> {
  if (!/^[0-9]+$/.test(texto)) {
    return { ok: false, error: 'DIGITO_INVALIDO' };
  }
  if (texto.length < minimo || texto.length > maximo) {
    return { ok: false, error: 'LONGITUD_INVALIDA' };
  }
  return { ok: true, value: texto };
}

/** Texto A: ASCII imprimible (0x20–0x7E), longitud máxima del campo. */
export function validarTextoAsciiPatagonia(
  texto: string,
  campoId: string,
  permitirVacio = false,
): Result<string, ErrorTextoPatagonia> {
  if (!/^[\x20-\x7E]*$/.test(texto)) {
    return { ok: false, error: 'CARACTER_NO_ASCII' };
  }
  if (!permitirVacio && texto === '') {
    return { ok: false, error: 'TEXTO_VACIO' };
  }
  if (texto.length > longitudCampoPatagonia(campoId)) {
    return { ok: false, error: 'LONGITUD_EXCEDIDA' };
  }
  return { ok: true, value: texto };
}

/** Número de EMPRESA: 1–4 dígitos ASCII, sin relleno ni normalización. */
export function validarNumeroEmpresaPatagonia(
  texto: string,
): Result<string, ErrorNumeroEmpresaPatagonia> {
  if (!/^[0-9]{1,4}$/.test(texto)) {
    return { ok: false, error: 'NUMERO_EMPRESA_INVALIDO' };
  }
  return { ok: true, value: texto };
}

/** Forma técnica AAAAMMDD. No valida calendario ni feriados. */
export function validarFechaPatagonia(fecha: string): Result<string, ErrorFechaPatagonia> {
  if (!/^[0-9]{8}$/.test(fecha)) {
    return { ok: false, error: 'FECHA_INVALIDA' };
  }
  return { ok: true, value: fecha };
}

/**
 * PAT-5: se aplica solo la restricción PAT-DR documentada (`99` prohibido). No se impone
 * el rango 1–70 de PAT-XL ni se decide si `00` es admisible.
 */
export function validarNumeroEnvioPatagonia(
  numero: string,
): Result<string, ErrorNumeroEnvioPatagonia> {
  if (!/^[0-9]{1,2}$/.test(numero)) {
    return { ok: false, error: 'NUMERO_ENVIO_INVALIDO' };
  }
  if (numero === '99') {
    return { ok: false, error: 'NUMERO_ENVIO_PROHIBIDO' };
  }
  return { ok: true, value: numero };
}

/** Concepto: ASCII imprimible, no vacío y hasta 10 posiciones. PAT-12 sigue abierta. */
export function validarConceptoPatagonia(concepto: string): Result<string, ErrorTextoPatagonia> {
  return validarTextoAsciiPatagonia(concepto, 'r1_concepto');
}

export function validarTipoCuentaPatagonia(
  valor: string,
): Result<TipoCuentaPatagonia, ErrorTipoCuentaPatagonia> {
  if (valor !== '1' && valor !== '2') {
    return { ok: false, error: 'TIPO_CUENTA_INVALIDO' };
  }
  return { ok: true, value: valor };
}

export function validarNumeroCuentaPatagonia(valor: string): Result<string, ErrorDigitosPatagonia> {
  return validarDigitos(valor, 1, 10);
}

/** Código de banco del maestro: exactamente 3 dígitos (no se exige que sea 034). */
export function validarCodigoBancoPatagonia(valor: string): Result<string, ErrorDigitosPatagonia> {
  return validarDigitos(valor, 3, 3);
}

export function validarCodigoSucursalPatagonia(
  valor: string,
): Result<string, ErrorDigitosPatagonia> {
  return validarDigitos(valor, 1, 5);
}

/** Anexo I de PAT-DR. PAT-8 sigue abierta: no se aplica la omisión de 004 de PAT-XL. */
export function validarTipoDocumentoPatagonia(
  valor: string,
): Result<TipoDocumentoPatagonia, ErrorTipoDocumentoPatagonia> {
  const entrada = ANEXO_I_TIPOS_DOCUMENTO.find((item) => item.codigo === valor);
  if (entrada === undefined) {
    return { ok: false, error: 'TIPO_DOCUMENTO_INVALIDO' };
  }
  return { ok: true, value: entrada.codigo };
}

export function validarNumeroDocumentoPatagonia(
  valor: string,
): Result<string, ErrorDigitosPatagonia> {
  return validarDigitos(valor, 1, 17);
}

/** Anexo II de PAT-DR, solo para el tipo de documento que exige provincia. */
export function validarProvinciaDocumentoPatagonia(
  valor: string,
): Result<CodigoProvincia, ErrorProvinciaPatagonia> {
  const entrada = ANEXO_II_PROVINCIAS.find((item) => item.codigo === valor);
  if (entrada === undefined) {
    return { ok: false, error: 'PROVINCIA_INVALIDA' };
  }
  return { ok: true, value: entrada.codigo };
}

/**
 * PAT-4: el campo es N de 2 posiciones. La política debe resolver un valor de dos dígitos;
 * el mapper no convierte espacios ni inventa `00`.
 */
export function validarProvinciaNoAplicaPatagonia(
  valor: string,
): Result<string, ErrorProvinciaPatagonia> {
  if (!/^[0-9]{2}$/.test(valor)) {
    return { ok: false, error: 'PROVINCIA_INVALIDA' };
  }
  return { ok: true, value: valor };
}

/** PAT-2: la forma depende de la hipótesis técnica explícita; no hay default. */
export function validarDependenciaPatagonia(
  valor: string,
  hipotesis: HipotesisDependenciaPat2,
): Result<string, ErrorDependenciaPatagonia> {
  if (valor.length === 0 || valor.length > longitudCampoPatagonia('r2_codigoDependencia')) {
    return { ok: false, error: 'DEPENDENCIA_INVALIDA' };
  }
  const valido = hipotesis === 'NUMERICA' ? /^[0-9]+$/.test(valor) : /^[\x20-\x7E]+$/.test(valor);
  if (!valido) {
    return { ok: false, error: 'DEPENDENCIA_INVALIDA' };
  }
  return { ok: true, value: valor };
}

/** Nombre generado por la política: solo A–Z y espacio, no vacío, máximo 20. */
export function validarNombrePatagonia(texto: string): Result<string, ErrorNombrePatagonia> {
  if (texto === '') {
    return { ok: false, error: 'NOMBRE_VACIO' };
  }
  if (!/^[A-Z ]+$/.test(texto)) {
    return { ok: false, error: 'NOMBRE_CARACTER_NO_RESPALDADO' };
  }
  if (texto.length > longitudCampoPatagonia('r2_apellidoNombre')) {
    return { ok: false, error: 'NOMBRE_LONGITUD_EXCEDIDA' };
  }
  return { ok: true, value: texto };
}

/** PAT-7 sigue abierta: se valida forma de 3 dígitos, no se impone un catálogo DR/XL. */
export function validarTipoLiquidacionPatagonia(
  valor: string,
): Result<string, ErrorTipoLiquidacionPatagonia> {
  if (!/^[0-9]{3}$/.test(valor)) {
    return { ok: false, error: 'TIPO_LIQUIDACION_INVALIDO' };
  }
  return { ok: true, value: valor };
}

export function validarComprobantePatagonia(
  valor: string,
): Result<string, ErrorComprobantePatagonia> {
  if (!/^[0-9]{1,7}$/.test(valor)) {
    return { ok: false, error: 'COMPROBANTE_INVALIDO' };
  }
  return { ok: true, value: valor };
}

/** PAT-15: campo A de 8. Se admite vacío (se serializará como espacios) sin inventar valor. */
export function validarVersionPatagonia(valor: string): Result<string, ErrorVersionPatagonia> {
  if (valor.length > longitudCampoPatagonia('r1_version') || !/^[\x20-\x7E]*$/.test(valor)) {
    return { ok: false, error: 'VERSION_INVALIDA' };
  }
  return { ok: true, value: valor };
}
