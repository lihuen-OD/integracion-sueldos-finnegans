// Escenario y entrada 100 % sintéticos para el golden técnico BNA (CP-F5-C). No contiene
// CUIT/CUIL/CBU literales: todo se genera en tiempo de ejecución (D-042). La política y
// la aptitud sintéticas son HIPÓTESIS DE TEST y no modifican la spec, `ISSUES_BNA` ni la
// habilitación productiva.
import type { AptitudBna } from '../../../src/banks/bna';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import type { CompanyProfileV2 } from '../../../src/profile';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import type { EntradaGeneracionBna } from '../../../src/run/generacionBna';
import { perfilSintetico, politicaSintetica } from '../../unit/banks/bna/auxiliares.ts';
import { escenario } from '../../unit/reconciliation/helpers.ts';
import { filaFinnegans, personas, registroBna } from './escenarios.ts';
import { createRandom } from './identities.ts';

/** Aptitud sintética: elimina los bloqueos SOLO en este test de infraestructura. */
export const APTITUD_SINTETICA_GOLDEN: AptitudBna = {
  bloqueos: [],
  interpretacionesByte: [],
  interpretacionesSinBytes: [],
  generadorHabilitado: true,
  homologacion: 'PENDIENTE_DE_HOMOLOGACION',
};

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

/** Entrada completa del golden: conciliación → facade → mapper → F4 → inspector. */
export function entradaGoldenBna(): EntradaGeneracionBna {
  return {
    perfil: perfilV2Golden(),
    conciliacion: conciliacionGoldenBna(),
    parametros: {
      fechaCompensacion: '20261030',
      numeroEnvio: '1',
      infoCriterioEmpresa: 'PAGO DE HABERES',
      referenciaUnivoca: 'HABERES OCTUBRE',
      lineSeparator: '\n',
      trailingSeparator: false,
    },
    politica: politicaSintetica(),
    aptitud: APTITUD_SINTETICA_GOLDEN,
  };
}
