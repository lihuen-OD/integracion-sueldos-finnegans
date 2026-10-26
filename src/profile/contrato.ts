// CompanyProfile v1 (D-022, D-059, P-19 ABIERTO): datos estables de la EMPRESA.
// NO contiene datos individuales de empleados (CUIL, legajo, CBU, PAT_*, liquidaciones)
// y NO decide destinos: el destino sigue viniendo de la columna `Banco` de Finnegans
// (D-012/D-014) o de una decisión ASIGNAR_DESTINO (D-013). El nombre del archivo no forma
// parte del contrato (D-059).
import type { Cbu } from '../domain/cbu';
import type { CuitEmpresaEstructural } from '../domain/cuitEmpresa';
import type { BancoCatalogado } from '../domain/destino';

/** Versión exacta del contrato. Cualquier otra se rechaza, sin migraciones (D-059). */
export const SCHEMA_VERSION_PERFIL = '1';

/** Versión del perfil v2 (D-079): configuración BNA estructural explícita. */
export const SCHEMA_VERSION_PERFIL_V2 = '2';

export interface CompanyProfile {
  readonly schemaVersion: typeof SCHEMA_VERSION_PERFIL;
  /** CUIT del empleador con estructura validada. El DV NO está verificado (D-061, P-18). */
  readonly cuitEmpresa: CuitEmpresaEstructural;
  /** Display-only (D-060): nunca entra en identidad, matching ni decisiones. */
  readonly nombreEmpresa: string | null;
  /**
   * Catálogo vigente de bancos (§C, §D.1): las entradas coinciden exactamente con el
   * catálogo cerrado de D-012/D-049; entradas extra o distintas se rechazan.
   */
  readonly catalogoBancos: readonly BancoCatalogado[];
  /**
   * Estructura aprobada (§C) pero VACÍA hasta que haya mapeos aprobados
   * (D-026, D-037, P-09, P-10). Un perfil con mapeos se rechaza en F3.
   */
  readonly mapeosLiquidacion: readonly [];
}

/**
 * Perfil v2 (D-079): el perfil v1 más la configuración BNA estructural mínima.
 * Un perfil v2 válido NO habilita la generación: BNA-1, P-09/P-10 y las demás
 * condiciones abiertas siguen aplicando. No contiene sucursal, tipo/clase documental
 * ni configuración de BNA-11/P-17.
 */
export interface CompanyProfileV2 {
  readonly schemaVersion: typeof SCHEMA_VERSION_PERFIL_V2;
  readonly cuitEmpresa: CuitEmpresaEstructural;
  readonly nombreEmpresa: string | null;
  readonly catalogoBancos: readonly BancoCatalogado[];
  readonly bna: {
    readonly cbuEmpresa: Cbu;
    readonly codigoConvenio: string;
    readonly moneda: '0' | '1';
  };
  readonly mapeosLiquidacion: readonly [];
}

/** Resultado de importar un perfil: la versión declarada decide el contrato aplicado. */
export type CompanyProfileImportado = CompanyProfile | CompanyProfileV2;
