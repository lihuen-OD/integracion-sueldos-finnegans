// CUIT de la EMPRESA (D-011: no viene en Finnegans; proviene del perfil). F3 valida
// ÚNICAMENTE la estructura (D-061): el dígito verificador NO se valida aquí — su
// fuente oficial sigue pendiente (P-18) y esa validación requiere una decisión
// explícita. Este módulo NO reutiliza el validador de CUIL (que sí aplica DV según
// D-024/D-052): son reglas y contratos distintos, aunque compartan 11 dígitos.
import type { Brand } from '../shared/brand';
import type { Result } from '../shared/result';

/**
 * CUIT de empresa con estructura válida. La marca marca estructura, NO validez
 * completa: el DV no fue verificado (P-18). Solo se obtiene con `parseCuitEmpresa`.
 */
export type CuitEmpresaEstructural = Brand<string, 'CuitEmpresaEstructural'>;

export type ErrorCuitEmpresa =
  'VACIO' | 'CARACTER_NO_PERMITIDO' | 'LONGITUD_INVALIDA' | 'FORMATO_INVALIDO';

/** A) canónica: 11 dígitos ASCII consecutivos. */
const CANONICA = /^[0-9]{11}$/;
/** B) con guiones ASCII: 2 dígitos, guion, 8 dígitos, guion, 1 dígito. */
const CON_GUIONES = /^[0-9]{2}-[0-9]{8}-[0-9]$/;

function normalizar(texto: string): string {
  return texto.replace(/^ +| +$/g, '');
}

function digitosDe(valor: string): string {
  return valor.replaceAll('-', '');
}

/**
 * Validación ESTRUCTURAL del CUIT de la empresa (D-061). Igual que la N-02 de D-052
 * para los espacios de los extremos y las dos representaciones admitidas, pero SIN
 * validar el DV: una estructura con DV inválido se acepta aquí (quien haga DV tarde,
 * lo hará sobre los dígitos canónicos). Errores propios, nunca compartidos con el
 * contrato de Cuil; los errores nunca incluyen el valor.
 */
export function parseCuitEmpresa(texto: string): Result<CuitEmpresaEstructural, ErrorCuitEmpresa> {
  const valor = normalizar(texto);
  if (valor === '') {
    return { ok: false, error: 'VACIO' };
  }
  if (/[^0-9-]/.test(valor)) {
    return { ok: false, error: 'CARACTER_NO_PERMITIDO' };
  }
  if (!CANONICA.test(valor) && !CON_GUIONES.test(valor)) {
    return {
      ok: false,
      error: /^[0-9]+$/.test(valor) ? 'LONGITUD_INVALIDA' : 'FORMATO_INVALIDO',
    };
  }
  return { ok: true, value: digitosDe(valor) as CuitEmpresaEstructural };
}

/**
 * Indica si un texto de perfil representa la forma con guiones `XX-XXXXXXXX-X`.
 * Solo presentación: el valor canónico queda sin guiones, como `parseCuitEmpresa`.
 */
export function tieneFormaConGuiones(texto: string): boolean {
  return CON_GUIONES.test(normalizar(texto));
}
