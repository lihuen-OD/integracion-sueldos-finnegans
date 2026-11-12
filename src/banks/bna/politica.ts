// Política BNA: frontera explícita para los valores que requieren una decisión. C-2/C-3
// resuelven el CBU del beneficiario y la derivación de entidad/sucursal desde ese CBU;
// C-4 resuelve el único camino documentado de identificación (clase `1`, tipo `02` y
// CUIL). P-17 conserva una resolución interna provisional basada exclusivamente en datos
// existentes de la corrida. BNA-11 y P-09/P-10 siguen sin resolución; no hay defaults
// para ellos y la producción continúa cerrada.
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

/** Campos libres del beneficiario resueltos por la decisión interna provisional P-17. */
export interface CamposBeneficiarioBna {
  readonly identificacionBeneficiario: string;
  readonly datosEmpresa: string;
}

export interface PoliticaBna {
  /**
   * BNA-1: clase y tipo documental. La política productiva usa el único camino
   * soportado por el modelo: clase `1` + tipo `02` + CUIL, confirmado por el diseño
   * documental (p.11), no por homologación bancaria. No elige `96` ni `000`+DNI.
   */
  readonly documento: (pago: PagoBna) => ResolucionBna<DocumentoBna>;
  /** BNA-2: CBU del beneficiario que alimenta el bloque 2 del registro 2. */
  readonly cbuCuenta: (pago: PagoBna) => ResolucionBna<Cbu>;
  /** BNA-6: sucursal de la cuenta de la empresa (registro 1), CBU empresa[3:7]. */
  readonly sucursalEmpresa: (perfil: PerfilBna) => ResolucionBna<string>;
  /** BNA-6: entidad `0`+CBU[0:3] y sucursal CBU[3:7] a acreditar (registro 2). */
  readonly entidadSucursal: (perfil: PerfilBna, pago: PagoBna) => ResolucionBna<EntidadSucursalBna>;
  /** P-09/P-10: código de identificador de préstamo (p. ej. 0000/0003). */
  readonly identificadorPrestamo: (pago: PagoBna) => ResolucionBna<string>;
  /** P-17: información criterio empresa (registro 1); BNA-11 sigue pendiente. */
  readonly infoCriterio: (
    perfil: PerfilBna,
    parametros: ParametrosEnvioBna,
  ) => ResolucionBna<string>;
  /** P-17: identificación del beneficiario y datos de empresa; BNA-11 sigue pendiente. */
  readonly camposBeneficiario: (
    pago: PagoBna,
    parametros: ParametrosEnvioBna,
  ) => ResolucionBna<CamposBeneficiarioBna>;
}

/**
 * Política efectiva actual. C-2/C-3/C-4 aplican las reglas derivadas del diseño GT200;
 * P-17 sigue siendo una decisión técnica interna provisional y P-09/P-10 continúa sin
 * resolución. El mapper valida longitud y alfabeto antes de serializar.
 */
export const POLITICA_BNA_PRODUCTIVA: PoliticaBna = {
  documento: () => resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
  cbuCuenta: (pago) => resuelto(pago.cbu),
  sucursalEmpresa: (perfil) => resuelto(String(perfil.cbuEmpresa).slice(3, 7)),
  entidadSucursal: (_perfil, pago) => {
    const cbu = String(pago.cbu);
    return resuelto({
      entidad: `0${cbu.slice(0, 3)}`,
      sucursal: cbu.slice(3, 7),
    });
  },
  identificadorPrestamo: () => sinResolucion('P-09/P-10'),
  infoCriterio: (_perfil, parametros) => resuelto(parametros.infoCriterioEmpresa),
  camposBeneficiario: (pago) =>
    resuelto({
      identificacionBeneficiario: String(pago.cuil),
      datosEmpresa: '',
    }),
};
