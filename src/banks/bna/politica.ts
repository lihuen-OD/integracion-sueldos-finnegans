// Política BNA: frontera explícita para todo valor cuya elección todavía no está
// aprobada. La política productiva devuelve SIEMPRE ausencia de resolución para BNA-1,
// BNA-2, BNA-6, P-09/P-10 y BNA-11/P-17. No contiene `02`, `96`, `0000`, `0003` ni
// defaults. Las políticas sintéticas de los tests viven fuera de `src/` y no resuelven
// ninguna pregunta bancaria (D-081).
import type { Cbu } from '../../domain/cbu';
import type { PagoBna, ParametrosEnvioBna, PerfilBna } from './modelo';

export type PuntoPoliticaBna = 'BNA-1' | 'BNA-2' | 'BNA-6' | 'P-09/P-10' | 'BNA-11/P-17';

export type ResolucionBna<T> =
  | { readonly estado: 'RESUELTO'; readonly valor: T }
  | { readonly estado: 'SIN_RESOLUCION'; readonly punto: PuntoPoliticaBna };

export function resuelto<T>(valor: T): ResolucionBna<T> {
  return { estado: 'RESUELTO', valor };
}

export function sinResolucion<T = never>(punto: PuntoPoliticaBna): ResolucionBna<T> {
  return { estado: 'SIN_RESOLUCION', punto };
}

export interface DocumentoBna {
  readonly claseDocumento: '1' | '2';
  readonly tipoDocumento: string;
}

/** BNA-6: entidad y sucursal del CBU que alimenta el registro 2. */
export interface EntidadSucursalBna {
  readonly entidad: string;
  readonly sucursal: string;
}

/** BNA-11/P-17: datos libres del beneficiario (no se asume vacío por default). */
export interface CamposBeneficiarioBna {
  readonly identificacionBeneficiario: string;
  readonly datosEmpresa: string;
}

export interface PoliticaBna {
  /** BNA-1: clase y tipo documental. La política productiva no elige `02` ni `96`. */
  readonly documento: (pago: PagoBna) => ResolucionBna<DocumentoBna>;
  /** BNA-2: CBU que alimenta el bloque 2 del registro 2. */
  readonly cbuCuenta: (pago: PagoBna) => ResolucionBna<Cbu>;
  /** BNA-6: sucursal de la cuenta de la empresa (registro 1). */
  readonly sucursalEmpresa: (perfil: PerfilBna) => ResolucionBna<string>;
  /** BNA-6: entidad y sucursal a acreditar (registro 2). */
  readonly entidadSucursal: (perfil: PerfilBna, pago: PagoBna) => ResolucionBna<EntidadSucursalBna>;
  /** P-09/P-10: código de identificador de préstamo (p. ej. 0000/0003). */
  readonly identificadorPrestamo: (pago: PagoBna) => ResolucionBna<string>;
  /** BNA-11/P-17: información criterio empresa (registro 1). */
  readonly infoCriterio: (
    perfil: PerfilBna,
    parametros: ParametrosEnvioBna,
  ) => ResolucionBna<string>;
  /** BNA-11/P-17: identificación del beneficiario y datos de empresa (registro 2). */
  readonly camposBeneficiario: (
    pago: PagoBna,
    parametros: ParametrosEnvioBna,
  ) => ResolucionBna<CamposBeneficiarioBna>;
}

/**
 * Política productiva actual: no hay respuestas aprobadas para los puntos abiertos.
 * Devolver una resolución acá sería inventar una decisión bancaria.
 */
export const POLITICA_BNA_PRODUCTIVA: PoliticaBna = {
  documento: () => sinResolucion('BNA-1'),
  cbuCuenta: () => sinResolucion('BNA-2'),
  sucursalEmpresa: () => sinResolucion('BNA-6'),
  entidadSucursal: () => sinResolucion('BNA-6'),
  identificadorPrestamo: () => sinResolucion('P-09/P-10'),
  infoCriterio: () => sinResolucion('BNA-11/P-17'),
  camposBeneficiario: () => sinResolucion('BNA-11/P-17'),
};
