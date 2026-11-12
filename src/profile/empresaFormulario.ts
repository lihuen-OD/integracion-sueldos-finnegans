// Formulario de configuración de la empresa: traduce datos legibles por RRHH a los
// contratos CompanyProfile v1/v2/v3 ya existentes. No agrega campos ni reglas: compone
// el documento con los mismos validadores del perfil y devuelve mensajes en lenguaje
// operativo. La versión se elige por los datos completados, nunca por una preferencia.
import { parseCbu } from '../domain/cbu';
import { parseCuitEmpresa } from '../domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../domain/destino';
import type { Result } from '../shared/result';
import type { CompanyProfileImportado } from './contrato';
import { validarPerfil, validarPerfilV2, validarPerfilV3 } from './validar';

export type CampoConfiguracionEmpresa =
  | 'cuitEmpresa'
  | 'nombreEmpresa'
  | 'bnaCbuEmpresa'
  | 'bnaCodigoConvenio'
  | 'bnaMoneda'
  | 'patagoniaNumeroEmpresa';

/** Datos que RRHH completa en pantalla. Los vacíos significan «no configurado». */
export interface DatosConfiguracionEmpresa {
  readonly cuitEmpresa: string;
  readonly nombreEmpresa: string;
  readonly bnaCbuEmpresa: string;
  readonly bnaCodigoConvenio: string;
  readonly bnaMoneda: '' | '0' | '1';
  readonly patagoniaNumeroEmpresa: string;
}

export interface ProblemaConfiguracionEmpresa {
  readonly campo: CampoConfiguracionEmpresa | 'general';
  readonly mensaje: string;
}

export interface ConfiguracionEmpresaConstruida {
  readonly perfil: CompanyProfileImportado;
  /** Qué datos bancarios quedaron incluidos en la configuración. */
  readonly alcance: 'datos-comunes' | 'banco-nacion' | 'banco-nacion-patagonia';
}

const DATOS_VACIOS: DatosConfiguracionEmpresa = {
  cuitEmpresa: '',
  nombreEmpresa: '',
  bnaCbuEmpresa: '',
  bnaCodigoConvenio: '',
  bnaMoneda: '',
  patagoniaNumeroEmpresa: '',
};

export function datosConfiguracionVacios(): DatosConfiguracionEmpresa {
  return DATOS_VACIOS;
}

/** Presenta el CUIT con guiones sin cambiar el valor canónico del contrato. */
export function formatearCuit(cuit: string): string {
  return /^[0-9]{11}$/.test(cuit)
    ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
    : cuit;
}

/** Reconstruye el formulario a partir de una configuración ya validada. */
export function datosConfiguracionDesdePerfil(
  perfil: CompanyProfileImportado | null,
): DatosConfiguracionEmpresa {
  if (perfil === null) {
    return DATOS_VACIOS;
  }
  const conBna = perfil.schemaVersion !== '1';
  return {
    cuitEmpresa: formatearCuit(perfil.cuitEmpresa),
    nombreEmpresa: perfil.nombreEmpresa ?? '',
    bnaCbuEmpresa: conBna ? perfil.bna.cbuEmpresa : '',
    bnaCodigoConvenio: conBna ? perfil.bna.codigoConvenio : '',
    bnaMoneda: conBna ? perfil.bna.moneda : '',
    patagoniaNumeroEmpresa: perfil.schemaVersion === '3' ? perfil.patagonia.numeroEmpresa : '',
  };
}

/** Texto operativo para el resumen de una configuración cargada. */
export function describirAlcance(perfil: CompanyProfileImportado): string {
  if (perfil.schemaVersion === '3') {
    return 'Datos generales, Banco Nación y Banco Patagonia';
  }
  if (perfil.schemaVersion === '2') {
    return 'Datos generales y Banco Nación';
  }
  return 'Datos generales';
}

function mensajeCuit(
  error: 'VACIO' | 'CARACTER_NO_PERMITIDO' | 'LONGITUD_INVALIDA' | 'FORMATO_INVALIDO',
): string {
  if (error === 'VACIO') {
    return 'Ingresá el CUIT de la empresa.';
  }
  if (error === 'CARACTER_NO_PERMITIDO') {
    return 'El CUIT solo puede tener números y, si querés, guiones.';
  }
  if (error === 'LONGITUD_INVALIDA') {
    return 'El CUIT debe tener 11 dígitos.';
  }
  return 'Revisá el formato del CUIT: 11 dígitos o XX-XXXXXXXX-X.';
}

function mensajeCbu(
  error:
    | 'VACIO'
    | 'CARACTER_NO_PERMITIDO'
    | 'LONGITUD_INVALIDA'
    | 'DV_BLOQUE_1_INVALIDO'
    | 'DV_BLOQUE_2_INVALIDO',
): string {
  if (error === 'CARACTER_NO_PERMITIDO') {
    return 'El CBU debe tener solo números, sin espacios ni guiones.';
  }
  if (error === 'LONGITUD_INVALIDA') {
    return 'El CBU debe tener 22 dígitos.';
  }
  if (error === 'DV_BLOQUE_1_INVALIDO' || error === 'DV_BLOQUE_2_INVALIDO') {
    return 'El CBU no pasa la verificación. Revisá los 22 dígitos.';
  }
  return 'Ingresá el CBU de la empresa.';
}

function mensajeGeneral(): string {
  return 'No pudimos validar la configuración con las reglas vigentes. Revisá los datos marcados.';
}

/**
 * Compone el documento mínimo compatible con los contratos existentes:
 * - solo datos generales → v1;
 * - datos de Banco Nación → v2;
 * - datos de Banco Nación y Patagonia → v3.
 * Patagonia exige los datos de Banco Nación porque el contrato v3 conserva ambos bloques.
 */
export function construirConfiguracionEmpresa(
  datos: DatosConfiguracionEmpresa,
): Result<ConfiguracionEmpresaConstruida, readonly ProblemaConfiguracionEmpresa[]> {
  const problemas: ProblemaConfiguracionEmpresa[] = [];
  const cuit = parseCuitEmpresa(datos.cuitEmpresa);
  if (!cuit.ok) {
    problemas.push({ campo: 'cuitEmpresa', mensaje: mensajeCuit(cuit.error) });
  }

  const nombre = datos.nombreEmpresa.replace(/^ +| +$/g, '');
  const usaPatagonia = datos.patagoniaNumeroEmpresa !== '';
  const usaBna =
    datos.bnaCbuEmpresa !== '' ||
    datos.bnaCodigoConvenio !== '' ||
    datos.bnaMoneda !== '' ||
    usaPatagonia;

  if (usaBna && nombre === '') {
    problemas.push({
      campo: 'nombreEmpresa',
      mensaje:
        'Ingresá el nombre o la razón social para guardar datos de Banco Nación o Patagonia.',
    });
  }

  let cbu: ReturnType<typeof parseCbu> | null = null;
  if (usaBna) {
    if (datos.bnaCbuEmpresa === '') {
      problemas.push({
        campo: 'bnaCbuEmpresa',
        mensaje: 'Ingresá el CBU de la cuenta de la empresa en Banco Nación.',
      });
    } else {
      cbu = parseCbu(datos.bnaCbuEmpresa);
      if (!cbu.ok) {
        problemas.push({ campo: 'bnaCbuEmpresa', mensaje: mensajeCbu(cbu.error) });
      }
    }

    if (datos.bnaCodigoConvenio === '') {
      problemas.push({
        campo: 'bnaCodigoConvenio',
        mensaje: 'Ingresá el código de convenio que asigna Banco Nación.',
      });
    } else if (!/^[0-9]+$/.test(datos.bnaCodigoConvenio)) {
      problemas.push({
        campo: 'bnaCodigoConvenio',
        mensaje: 'El código de convenio debe tener solo números.',
      });
    } else if (datos.bnaCodigoConvenio.length !== 4 && datos.bnaCodigoConvenio.length !== 8) {
      problemas.push({
        campo: 'bnaCodigoConvenio',
        mensaje: 'El código de convenio debe tener 4 u 8 dígitos.',
      });
    }

    if (datos.bnaMoneda === '') {
      problemas.push({
        campo: 'bnaMoneda',
        mensaje: 'Elegí la moneda de la cuenta de Banco Nación.',
      });
    }

    if (usaPatagonia && !/^[0-9]{1,4}$/.test(datos.patagoniaNumeroEmpresa)) {
      problemas.push({
        campo: 'patagoniaNumeroEmpresa',
        mensaje: 'El número de empresa de Banco Patagonia debe tener entre 1 y 4 dígitos.',
      });
    }
  }

  if (problemas.length > 0 || !cuit.ok) {
    return { ok: false, error: problemas };
  }

  if (!usaBna) {
    const validado = validarPerfil({
      schemaVersion: '1',
      cuitEmpresa: cuit.value,
      nombreEmpresa: nombre === '' ? null : nombre,
      catalogoBancos: [...CATALOGO_BANCOS],
      mapeosLiquidacion: [],
    });
    if (!validado.ok) {
      return { ok: false, error: [{ campo: 'general', mensaje: mensajeGeneral() }] };
    }
    return {
      ok: true,
      value: { perfil: validado.value, alcance: 'datos-comunes' },
    };
  }

  if (cbu === null || !cbu.ok || datos.bnaMoneda === '') {
    return { ok: false, error: [{ campo: 'general', mensaje: mensajeGeneral() }] };
  }

  const bna = {
    cbuEmpresa: cbu.value,
    codigoConvenio: datos.bnaCodigoConvenio,
    moneda: datos.bnaMoneda,
  };

  if (usaPatagonia) {
    const validado = validarPerfilV3({
      schemaVersion: '3',
      cuitEmpresa: cuit.value,
      nombreEmpresa: nombre,
      catalogoBancos: [...CATALOGO_BANCOS],
      bna,
      patagonia: { numeroEmpresa: datos.patagoniaNumeroEmpresa },
      mapeosLiquidacion: [],
    });
    if (!validado.ok) {
      return { ok: false, error: [{ campo: 'general', mensaje: mensajeGeneral() }] };
    }
    return {
      ok: true,
      value: { perfil: validado.value, alcance: 'banco-nacion-patagonia' },
    };
  }

  const validado = validarPerfilV2({
    schemaVersion: '2',
    cuitEmpresa: cuit.value,
    nombreEmpresa: nombre,
    catalogoBancos: [...CATALOGO_BANCOS],
    bna,
    mapeosLiquidacion: [],
  });
  if (!validado.ok) {
    return { ok: false, error: [{ campo: 'general', mensaje: mensajeGeneral() }] };
  }
  return {
    ok: true,
    value: { perfil: validado.value, alcance: 'banco-nacion' },
  };
}
