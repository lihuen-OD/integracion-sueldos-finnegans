// Escenario 100 % sintético para el golden técnico BNA (CP-F5-C). No contiene
// CUIT/CUIL/CBU literales: todo se genera en tiempo de ejecución (D-042). La política y
// la aptitud sintéticas son HIPÓTESIS DE TEST y no modifican la spec, `ISSUES_BNA` ni la
// habilitación productiva. El golden compone las capas técnicas directamente: NUNCA pasa
// por la fachada productiva ni sustituye la aptitud contractual.
import type { PagoBna, ParametrosEnvioBna, PerfilBna } from '../../../src/banks/bna';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import type { CompanyProfileV2 } from '../../../src/profile';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { pagosBnaDesdeConciliacion, perfilBnaDesdePerfil } from '../../../src/run/generacionBna';
import { perfilSintetico } from '../../unit/banks/bna/auxiliares.ts';
import { escenario } from '../../unit/reconciliation/helpers.ts';
import { filaFinnegans, personas, registroBna } from './escenarios.ts';
import { createRandom } from './identities.ts';

/** Perfil v2 sintético con exactamente los cuatro datos BNA aprobados. */
export function perfilV2Golden(): CompanyProfileV2 {
  const base = perfilSintetico('4455');
  return {
    schemaVersion: '2',
    cuitEmpresa: base.cuitEmpresa,
    nombreEmpresa: 'EMPRESA SINTETICA DE PRUEBA',
    catalogoBancos: CATALOGO_BANCOS,
    bna: {
      cbuEmpresa: base.cbuEmpresa,
      codigoConvenio: base.codigoConvenio,
      moneda: base.moneda,
    },
    mapeosLiquidacion: [],
  };
}

/** Dos personas BNA con CBU e identidad sintéticos, sin incidencias bloqueantes. */
export function conciliacionGoldenBna(): ResultadoConciliacion {
  const random = createRandom(2026);
  const gente = personas(2, 2026);
  const filas = gente.map((persona) => filaFinnegans(persona));
  const registros = gente.map((persona) => registroBna(persona, random));
  return escenario(filas, registros);
}

/** Perfil técnico BNA derivado del perfil v2 sintético. */
export function perfilBnaGolden(): PerfilBna {
  return perfilBnaDesdePerfil(perfilV2Golden());
}

/** Pagos BNA derivados de la conciliación sintética, en orden y con SourceRef. */
export function pagosGoldenBna(): readonly PagoBna[] {
  return pagosBnaDesdeConciliacion(conciliacionGoldenBna());
}

/** Parámetros explícitos del golden: LF y sin separador final (hipótesis BNA-9). */
export function parametrosGoldenBna(): ParametrosEnvioBna {
  return {
    fechaCompensacion: '20261030',
    numeroEnvio: '1',
    infoCriterioEmpresa: 'PAGO DE HABERES',
    referenciaUnivoca: 'HABERES OCTUBRE',
    lineSeparator: '\n',
    trailingSeparator: false,
  };
}
