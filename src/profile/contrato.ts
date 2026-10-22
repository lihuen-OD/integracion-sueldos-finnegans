// CompanyProfile v1 (D-022, D-059, P-19 ABIERTO): datos estables de la EMPRESA.
// NO contiene datos individuales de empleados (CUIL, legajo, CBU, PAT_*, liquidaciones)
// y NO decide destinos: el destino sigue viniendo de la columna `Banco` de Finnegans
// (D-012/D-014) o de una decisión ASIGNAR_DESTINO (D-013). El nombre del archivo no forma
// parte del contrato (D-059).
import type { BancoCatalogado } from '../domain/destino';
import type { CuitEmpresaEstructural } from '../domain/cuitEmpresa';

/** Versión exacta del contrato. Cualquier otra se rechaza, sin migraciones (D-059). */
export const SCHEMA_VERSION_PERFIL = '1';

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
